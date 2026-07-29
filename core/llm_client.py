import asyncio
import random
import time
import httpx
from typing import List, Dict, Any, Optional, Tuple
from core.cleaner import clean_llm_response

class LLMClient:
    def __init__(self, endpoint: str, api_key: str = "lm-studio", api_type: str = "openai", timeout: float = 180.0):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.api_type = api_type.lower()
        self.timeout = timeout

    async def fetch_models(self) -> List[str]:
        """Queries endpoint dynamically for available installed models."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                url = self.endpoint if self.endpoint.endswith("/models") else f"{self.endpoint}/models"
                if "/v1" not in url:
                    url = f"{self.endpoint}/v1/models"
                headers = {"Authorization": f"Bearer {self.api_key}"}
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                    if models:
                        return models
            except Exception:
                pass

            try:
                base_url = self.endpoint.replace("/v1", "")
                url = f"{base_url}/api/tags"
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                    if models:
                        return models
            except Exception:
                pass

        return []

    async def check_connection(self) -> Tuple[bool, str]:
        """Tests connection to remote endpoint and returns status."""
        try:
            models = await self.fetch_models()
            if models:
                return True, f"Connecté ! Modèles détectés ({len(models)}): {', '.join(models[:3])}"
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(self.endpoint)
                if resp.status_code < 500:
                    return True, "Serveur joignable."
            return False, "Le serveur n'a pas renvoyé de réponse valide."
        except Exception as e:
            return False, f"Erreur de connexion : {str(e)}"

    async def translate_chunk(
        self,
        system_prompt: str,
        text_chunk: str,
        model: str,
        temperature: float = 0.3,
        max_retries: int = 3
    ) -> str:
        """
        Sends a single translation chunk request with exponential backoff retries.
        """
        last_exception = None

        for attempt in range(1, max_retries + 1):
            try:
                if self.api_type == "ollama" and not self.endpoint.endswith("/v1"):
                    translated = await self._call_ollama_native(system_prompt, text_chunk, model, temperature)
                else:
                    translated = await self._call_openai_spec(system_prompt, text_chunk, model, temperature)
                
                cleaned = clean_llm_response(translated)
                if cleaned:
                    return cleaned
                raise ValueError("Réponse LLM vide après nettoyage.")
            except Exception as e:
                last_exception = e
                err_str = str(e)
                # Don't retry if it's an unrecoverable memory overflow error
                if "insufficient system resources" in err_str:
                    raise RuntimeError(err_str)

                if attempt < max_retries:
                    sleep_time = (2 ** attempt) + random.uniform(0.5, 1.5)
                    await asyncio.sleep(sleep_time)

        raise RuntimeError(f"Échec de la traduction après {max_retries} essais: {str(last_exception)}")

    async def _call_openai_spec(self, system_prompt: str, user_text: str, model: str, temperature: float) -> str:
        url = self.endpoint
        if not url.endswith("/chat/completions"):
            url = f"{url}/chat/completions" if url.endswith("/v1") else f"{url}/v1/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Voici le texte à traduire :\n\n{user_text}"}
        ]
        if any(k in model.lower() for k in ["qwen", "deepseek", "r1", "think"]):
            messages.append({"role": "assistant", "content": "<think>\n</think>\n"})

        payload_standard = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1500,
            "frequency_penalty": 0.15,
            "repetition_penalty": 1.15,
            "stream": False
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload_standard, headers=headers)
            
            # 2. If Jinja template rejects system role, retry with single combined user message
            if resp.status_code != 200 and ("Jinja template" in resp.text or "Conversations must start" in resp.text):
                user_messages = [
                    {"role": "user", "content": f"{system_prompt}\n\nVoici le texte à traduire :\n\n{user_text}"}
                ]
                if any(k in model.lower() for k in ["qwen", "deepseek", "r1", "think"]):
                    user_messages.append({"role": "assistant", "content": "<think>\n</think>\n"})

                payload_user = {
                    "model": model,
                    "messages": user_messages,
                    "temperature": temperature,
                    "max_tokens": 1500,
                    "frequency_penalty": 0.15,
                    "repetition_penalty": 1.15,
                    "stream": False
                }
                resp = await client.post(url, json=payload_user, headers=headers)

            # 3. If Jinja template STILL fails (TranslateGemma / Gemma 2 raw prompt models), fallback to /v1/completions
            if resp.status_code != 200 and ("Jinja template" in resp.text or "jinja" in resp.text.lower()):
                raw_url = url.replace("/chat/completions", "/completions")
                raw_prompt = f"<start_of_turn>user\n{system_prompt}\n\nVoici le texte à traduire :\n\n{user_text}<end_of_turn>\n<start_of_turn>model\n"
                payload_raw = {
                    "model": model,
                    "prompt": raw_prompt,
                    "temperature": temperature,
                    "max_tokens": 1500,
                    "frequency_penalty": 0.15,
                    "repetition_penalty": 1.15,
                    "stream": False
                }
                resp = await client.post(raw_url, json=payload_raw, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["text"]

            if resp.status_code != 200:
                err_detail = ""
                try:
                    err_json = resp.json()
                    if isinstance(err_json, dict):
                        err_detail = err_json.get("error", {}).get("message") or err_json.get("error") or str(err_json)
                except Exception:
                    err_detail = resp.text

                raise RuntimeError(f"LM Studio API Error ({resp.status_code}): {err_detail or 'Bad Request'}")

            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _call_ollama_native(self, system_prompt: str, user_text: str, model: str, temperature: float) -> str:
        base_url = self.endpoint.replace("/v1", "")
        url = f"{base_url}/api/chat"

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Voici le texte à traduire :\n\n{user_text}"}
            ],
            "options": {
                "temperature": temperature,
                "num_predict": 1500
            },
            "stream": False
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                err_detail = ""
                try:
                    err_json = resp.json()
                    err_detail = err_json.get("error") or str(err_json)
                except Exception:
                    err_detail = resp.text
                raise RuntimeError(f"Ollama API Error ({resp.status_code}): {err_detail or 'Bad Request'}")

            data = resp.json()
            return data["message"]["content"]
