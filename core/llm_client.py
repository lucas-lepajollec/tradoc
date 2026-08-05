import asyncio
import random
import time
import httpx
from typing import List, Dict, Any, Optional, Tuple
from core.cleaner import clean_llm_response

class ProviderDownError(RuntimeError):
    """Raised when the remote LLM server is unreachable, connection refused, or timed out."""
    pass

def pad_system_prompt_for_cache(prompt: str, target_tokens: int) -> str:
    """
    Appends a static, harmless but highly relevant guideline padding block to system prompt
    to guarantee it meets the minimum token threshold (e.g. 1024 or 2048 tokens) required 
    by cloud APIs to trigger Prompt Caching. Since the padding is 100% static across all segments,
    it caches immediately and reduces input pricing by up to 90%.
    """
    # 1 token is approx. 3.2 characters in French/English mix
    current_est = int(len(prompt) / 3.2)
    if current_est >= target_tokens:
        return prompt

    padding_guidelines = (
        "\n\n[PROMPT_CACHE_ENFORCEMENT_GUIDELINES_START]\n"
        "To ensure stylistic consistency, fluid formatting, and structural integrity:\n"
        "1. Strictly enforce French typographic conventions: non-breaking spaces before colons, semi-colons, question/exclamation marks.\n"
        "2. Keep character names, pronouns, and locations completely consistent throughout the entire book. Never change names.\n"
        "3. Keep dialog markers uniform (use standard French dialogue dashes '-' instead of English quote marks where appropriate).\n"
        "4. Avoid raw literalism: translate idioms into natural French equivalents. Use professional literary publishing registers.\n"
        "5. Retain all HTML inline nodes (<p>, <i>, <em>, <b>, <strong>) in their exact corresponding positions.\n"
        "6. Do not split, merge, or omit paragraphs. Every single sentence in the source must have a corresponding translated output.\n"
        "7. Never output any system comments, meta-explanations, or thoughts. Output ONLY the translated text.\n"
        "8. Double check gender agreement for adjectives and participles based on the surrounding book context.\n"
        "9. Make sure formatting is clean and invalid HTML entities are resolved.\n"
        "[PROMPT_CACHE_ENFORCEMENT_GUIDELINES_END]"
    )

    # Repeat padding block if needed to safely cross the threshold
    result = prompt
    while int(len(result) / 3.2) < target_tokens:
        result += padding_guidelines

    return result

class LLMClient:
    def __init__(self, endpoint: str, api_key: str = "lm-studio", api_type: str = "openai", timeout: float = 180.0):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.api_type = api_type.lower()
        self.timeout = timeout

    async def fetch_models(self) -> List[str]:
        """Queries endpoint dynamically for available installed models."""
        t = self.api_type.lower()
        
        # Hardcoded fallback list for providers that don't support dynamic listing or for offline safety
        if t in ["claude", "anthropic"]:
            return ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"]
        if t == "glm":
            return ["glm-4", "glm-4-flash", "glm-4v", "glm-3-turbo"]

        # Resolve target base URL
        base_url = self.endpoint.rstrip("/")
        local_markers = ["localhost", "127.0.0.1", "192.168.", "10.", "172.16.", "::1", "0.0.0.0"]
        is_local_endpoint = any(m in base_url.lower() for m in local_markers) or t in ["lm-studio", "ollama"]

        if t == "openai" and not is_local_endpoint:
            base_url = "https://api.openai.com/v1"
        elif t == "deepseek":
            base_url = "https://api.deepseek.com/v1"
        elif t == "openrouter":
            base_url = "https://openrouter.ai/api/v1"
        elif t == "minimax":
            base_url = "https://api.minimax.chat/v1"
        elif t == "kimi":
            base_url = "https://api.moonshot.cn/v1"
        elif t == "gemini":
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai/v1"

        candidate_urls = []
        if base_url.endswith("/v1"):
            candidate_urls = [f"{base_url}/models", f"{base_url[:-3]}/models", f"{base_url[:-3]}/api/tags"]
        else:
            candidate_urls = [f"{base_url}/v1/models", f"{base_url}/models", f"{base_url}/api/tags"]

        async with httpx.AsyncClient(timeout=10.0) as client:
            for url in candidate_urls:
                try:
                    headers = {}
                    if self.api_key and self.api_key.strip():
                        headers["Authorization"] = f"Bearer {self.api_key.strip()}"
                    
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        if isinstance(data, dict):
                            if "data" in data and isinstance(data["data"], list):
                                models = [m.get("id") for m in data["data"] if isinstance(m, dict) and m.get("id")]
                                if models:
                                    return sorted(models)
                            elif "models" in data and isinstance(data["models"], list):
                                models = [m.get("name") or m.get("id") for m in data["models"] if isinstance(m, dict) and (m.get("name") or m.get("id"))]
                                if models:
                                    return sorted(models)
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
        max_retries: int = 3,
        check_cancelled = None
    ) -> str:
        """
        Sends a single translation chunk request with exponential backoff retries.
        """
        last_exception = None
        
        # Dynamic output limit based on input length and endpoint type
        input_est_tokens = len(text_chunk) // 3
        is_local = self.api_type.lower() in ["lm-studio", "ollama"] or any(m in self.endpoint.lower() for m in ["localhost", "127.0.0.1", "192.168.", "10.", "172.16."])
        
        if is_local:
            # For local GPU servers (LM Studio / Ollama), keep max_tokens realistic so prompt_tokens + max_tokens <= n_ctx
            max_output_tokens = min(3000, max(1200, int(input_est_tokens * 1.35)))
        else:
            # Ensure a high minimum of 4500 tokens for Cloud APIs to avoid truncation on dense/list chunks
            max_output_tokens = min(8192, max(4500, int(input_est_tokens * 1.5)))

        for attempt in range(1, max_retries + 1):
            if check_cancelled:
                await check_cancelled()
            try:
                t = self.api_type.lower()
                if t == "ollama" and not self.endpoint.endswith("/v1"):
                    translated = await self._call_ollama_native(system_prompt, text_chunk, model, temperature, max_output_tokens)
                elif t in ["claude", "anthropic"]:
                    translated = await self._call_claude_native(system_prompt, text_chunk, model, temperature, max_output_tokens)
                else:
                    translated = await self._call_openai_spec(system_prompt, text_chunk, model, temperature, max_output_tokens)
                
                cleaned = clean_llm_response(translated)
                if cleaned:
                    return cleaned
                
                # Debug output to help identify why the cleaning returned an empty string
                print(f"[TraDoc LLM Debug] ⚠️ Réponse vide après nettoyage. Sortie brute (1000 premiers caractères): {repr(translated[:1000])}")
                raise ValueError("Réponse LLM vide après nettoyage.")
            except (httpx.ConnectError, httpx.ConnectTimeout, httpx.NetworkError, httpx.RemoteProtocolError) as e:
                raise ProviderDownError(f"Le serveur LLM n'est plus accessible ({self.endpoint}): {str(e)}")
            except Exception as e:
                last_exception = e
                err_str = str(e)
                if "502" in err_str or "503" in err_str or "504" in err_str or "Connection refused" in err_str:
                    raise ProviderDownError(f"Le serveur LLM distant s'est déconnecté: {err_str}")

                if "insufficient system resources" in err_str:
                    raise RuntimeError(err_str)

                if attempt < max_retries:
                    if check_cancelled:
                        await check_cancelled()
                    sleep_time = (2 ** attempt) + random.uniform(0.5, 1.5)
                    await asyncio.sleep(sleep_time)

        raise RuntimeError(f"Échec de la traduction après {max_retries} essais: {str(last_exception)}")

    async def _call_openai_spec(self, system_prompt: str, user_text: str, model: str, temperature: float, max_tokens: int) -> str:
        t = self.api_type.lower()
        base_url = self.endpoint

        if t == "openai":
            base_url = "https://api.openai.com/v1"
        elif t == "deepseek":
            base_url = "https://api.deepseek.com/v1"
        elif t == "openrouter":
            base_url = "https://openrouter.ai/api/v1"
        elif t == "minimax":
            base_url = "https://api.minimax.chat/v1"
        elif t == "kimi":
            base_url = "https://api.moonshot.cn/v1"
        elif t == "glm":
            base_url = "https://open.bigmodel.cn/api/paas/v4"
        elif t == "gemini":
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai/v1"

        url = base_url
        if not url.endswith("/chat/completions"):
            url = f"{url}/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }

        # Extra headers for OpenRouter (SOTA 2026 specs)
        if t == "openrouter":
            headers["HTTP-Referer"] = "https://github.com/lucas-lepajollec/tradoc"
            headers["X-Title"] = "TraDoc"

        # Enforce Prompt Caching by padding system prompt for Cloud endpoints to guarantee cache hits (ignored for local servers to save context/VRAM)
        local_markers = ["localhost", "127.0.0.1", "192.168.", "10.", "172.16.", "172.31.", "::1", "0.0.0.0"]
        is_local = any(marker in base_url.lower() for marker in local_markers) or t in ["lm-studio", "ollama"]
        
        # Disabled temporarily to test empty response issue
        # if not is_local:
        #     system_prompt = pad_system_prompt_for_cache(system_prompt, target_tokens=1050)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Voici le texte à traduire :\n\n{user_text}"}
        ]
        
        # Only inject think pre-fill for local models or OpenRouter reasoning models
        if any(k in model.lower() for k in ["qwen", "deepseek", "r1", "think"]):
            if t not in ["deepseek", "openrouter", "openai", "gemini", "kimi", "glm", "minimax"]:
                messages.append({"role": "assistant", "content": "<think>\n</think>\n"})

        payload_standard = {
            "model": model,
            "messages": messages,
            "temperature": max(0.05, temperature),
            "max_tokens": max_tokens,
            "stream": False
        }
        
        # Disable R1/reasoning model thinking mode to speed up translations and save tokens (for DeepSeek and OpenRouter)
        is_reasoning_provider = t in ["deepseek", "openrouter"] or any(term in base_url.lower() for term in ["deepseek.com", "openrouter.ai"])
        if is_reasoning_provider:
            payload_standard["thinking"] = {"type": "disabled"}

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
                    "temperature": max(0.05, temperature),
                    "max_tokens": max_tokens,
                    "stream": False
                }
                if is_reasoning_provider:
                    payload_user["thinking"] = {"type": "disabled"}
                resp = await client.post(url, json=payload_user, headers=headers)

            # 3. If Jinja template STILL fails (TranslateGemma / Gemma 2 raw prompt models), fallback to /v1/completions
            if resp.status_code != 200 and ("Jinja template" in resp.text or "jinja" in resp.text.lower()):
                raw_url = url.replace("/chat/completions", "/completions")
                raw_prompt = f"<start_of_turn>user\n{system_prompt}\n\nVoici le texte à traduire :\n\n{user_text}<end_of_turn>\n<start_of_turn>model\n"
                payload_raw = {
                    "model": model,
                    "prompt": raw_prompt,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
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
            try:
                choice = data["choices"][0]
                content = choice["message"].get("content")
                if not content:
                    print(f"[TraDoc LLM Debug] ⚠️ L'API a renvoyé un contenu vide. Réponse complète: {data}")
                return content or ""
            except Exception as e:
                print(f"[TraDoc LLM Debug] ⚠️ Erreur lors de l'analyse de la réponse: {e}. Réponse complète: {data}")
                raise e

    async def _call_ollama_native(self, system_prompt: str, user_text: str, model: str, temperature: float, max_tokens: int) -> str:
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
                "num_predict": max_tokens
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

    async def _call_claude_native(self, system_prompt: str, user_text: str, model: str, temperature: float, max_tokens: int) -> str:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
            "content-type": "application/json"
        }
        
        # Enforce Prompt Caching by padding system prompt based on Claude model class
        target_tokens = 2050 if "haiku" in model.lower() else 1050
        padded_system = pad_system_prompt_for_cache(system_prompt, target_tokens=target_tokens)

        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": f"Voici le texte à traduire :\n\n{user_text}"}
            ],
            "system": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"}
                }
            ],
            "max_tokens": min(max_tokens, 4096),  # Anthropic enforces a strict max of 4096 for standard output
            "temperature": max(0.0, temperature)
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                err_detail = ""
                try:
                    err_json = resp.json()
                    err_detail = err_json.get("error", {}).get("message") or str(err_json)
                except Exception:
                    err_detail = resp.text
                raise RuntimeError(f"Anthropic Claude API Error ({resp.status_code}): {err_detail or 'Bad Request'}")

            data = resp.json()
            return data["content"][0]["text"]
