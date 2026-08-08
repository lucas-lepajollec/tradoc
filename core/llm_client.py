import asyncio
import logging
import random
import re
from typing import Awaitable, Callable, List, Optional, Tuple

import httpx

from core.cleaner import clean_llm_response


logger = logging.getLogger("tradoc.llm")

DEFAULT_ENDPOINTS = {
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "minimax": "https://api.minimax.chat/v1",
    "kimi": "https://api.moonshot.cn/v1",
    "glm": "https://open.bigmodel.cn/api/paas/v4",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/v1",
    "claude": "https://api.anthropic.com",
    "anthropic": "https://api.anthropic.com",
    "lm-studio": "http://127.0.0.1:1234/v1",
    "ollama": "http://127.0.0.1:11434",
}


class ProviderDownError(RuntimeError):
    """Raised when a provider is unreachable or temporarily unavailable."""


class LLMResponseError(RuntimeError):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


class LLMClient:
    def __init__(
        self,
        endpoint: Optional[str],
        api_key: str = "",
        api_type: str = "openai",
        timeout: float = 180.0,
        enable_prompt_caching: bool = False,
    ):
        self.api_type = (api_type or "openai").strip().lower()
        # A user-provided compatible endpoint always wins, including when api_type
        # is "openai". Provider defaults are only a fallback.
        resolved = (endpoint or "").strip() or DEFAULT_ENDPOINTS.get(self.api_type, "")
        if not resolved:
            raise ValueError("Aucun endpoint LLM configuré.")
        self.endpoint = resolved.rstrip("/")
        self.api_key = (api_key or "").strip()
        self.timeout = timeout
        self.enable_prompt_caching = enable_prompt_caching
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=min(timeout, 20.0)),
            follow_redirects=False,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await self.aclose()

    def _auth_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if self.api_type == "openrouter":
            headers["HTTP-Referer"] = "https://github.com/lucas-lepajollec/tradoc"
            headers["X-Title"] = "TraDoc"
        return headers

    def _uses_local_reasoning_prefill(self, model: str) -> bool:
        """Keep local reasoning models from spending the output budget on hidden thought."""
        if self.api_type not in {"lm-studio", "ollama"}:
            return False
        normalized = (model or "").lower()
        return any(marker in normalized for marker in ("qwen", "deepseek", "r1", "think"))

    def _reasoning_overrides(self, model: str) -> dict[str, object]:
        """Return only reasoning controls documented by the selected provider."""
        normalized = (model or "").lower()
        if self.api_type == "deepseek":
            return {"thinking": {"type": "disabled"}}
        if self.api_type == "openrouter":
            return {"reasoning": {"effort": "none", "exclude": True}}
        if self.api_type == "gemini":
            if "gemini-2.5-flash" in normalized and "pro" not in normalized:
                return {"reasoning_effort": "none"}
            if "gemini-3" in normalized:
                # Gemini 3 cannot be fully disabled; minimal is its lowest supported level.
                return {"reasoning_effort": "minimal"}
        if self.api_type == "openai" and "pro" not in normalized:
            match = re.search(r"gpt-(\d+)(?:\.(\d+))?", normalized)
            if match and (int(match.group(1)), int(match.group(2) or 0)) >= (5, 1):
                return {"reasoning_effort": "none"}
        return {}

    @staticmethod
    def _safe_error(response: httpx.Response) -> str:
        try:
            payload = response.json()
            if isinstance(payload, dict):
                error = payload.get("error")
                if isinstance(error, dict):
                    return str(error.get("message") or error.get("type") or "Erreur fournisseur")[:500]
                if error:
                    return str(error)[:500]
                return str(payload.get("message") or "Erreur fournisseur")[:500]
        except ValueError:
            pass
        return f"Le fournisseur a répondu avec le statut HTTP {response.status_code}."

    async def fetch_models(self) -> List[str]:
        if self.api_type == "ollama" and not self.endpoint.endswith("/v1"):
            candidates = [f"{self.endpoint}/api/tags"]
        elif self.api_type in {"claude", "anthropic"}:
            candidates = [f"{self.endpoint.removesuffix('/v1')}/v1/models"]
        elif self.endpoint.endswith("/v1") or self.endpoint.endswith("/v4"):
            candidates = [f"{self.endpoint}/models"]
        else:
            candidates = [f"{self.endpoint}/v1/models", f"{self.endpoint}/models"]

        headers = self._auth_headers()
        if self.api_type in {"claude", "anthropic"}:
            headers.pop("Authorization", None)
            if self.api_key:
                headers["x-api-key"] = self.api_key
            headers["anthropic-version"] = "2023-06-01"

        last_status: Optional[int] = None
        for url in candidates:
            try:
                response = await self._client.get(url, headers=headers, timeout=15.0)
            except httpx.RequestError:
                continue
            last_status = response.status_code
            if response.status_code != 200:
                continue
            try:
                payload = response.json()
            except ValueError:
                continue
            raw_models = (payload.get("data") or payload.get("models") or []) if isinstance(payload, dict) else []
            models = []
            for item in raw_models:
                if isinstance(item, dict):
                    identifier = item.get("id") or item.get("name") or item.get("model")
                    if identifier:
                        models.append(str(identifier).removeprefix("models/"))
            if models:
                return sorted(set(models))

        if last_status in {401, 403}:
            raise LLMResponseError(last_status, "Clé API refusée par le fournisseur.")
        return []

    async def check_connection(self) -> Tuple[bool, str]:
        try:
            models = await self.fetch_models()
            if not models:
                return False, "Endpoint joignable, mais aucun modèle exploitable n'a été détecté."
            preview = ", ".join(models[:3])
            return True, f"Connexion validée — {len(models)} modèle(s) détecté(s) : {preview}"
        except LLMResponseError as exc:
            return False, str(exc)
        except httpx.RequestError:
            return False, "Impossible de joindre le serveur LLM."
        except Exception:
            logger.exception("Unexpected provider connection test failure")
            return False, "La vérification du fournisseur a échoué."

    async def translate_chunk(
        self,
        system_prompt: str,
        text_chunk: str,
        model: str,
        temperature: float = 0.3,
        max_retries: int = 3,
        check_cancelled: Optional[Callable[[], Awaitable[None]]] = None,
    ) -> str:
        input_est_tokens = max(1, len(text_chunk) // 3)
        is_local = self.api_type in {"lm-studio", "ollama"}
        if is_local:
            # Parser v4 normalizes converter-generated Markdown before chunking,
            # so the completion budget can follow the real input size again.
            # Keeping this adaptive matters for LM Studio, which may preallocate
            # for the announced ceiling even when the model stops much earlier.
            local_floor = 3000 if "gpt-oss" in model.lower() else 1200
            max_output_tokens = min(6000, max(local_floor, int(input_est_tokens * 1.5)))
        else:
            # Cloud reasoning can be mandatory for some models. Keep the pre-audit
            # safety floor so internal reasoning cannot starve the translated text.
            max_output_tokens = min(16384, max(4500, int(input_est_tokens * 1.6)))
        last_error: Optional[Exception] = None

        for attempt in range(1, max_retries + 1):
            if check_cancelled:
                await check_cancelled()
            try:
                if self.api_type == "ollama" and not self.endpoint.endswith("/v1"):
                    raw = await self._call_ollama_native(system_prompt, text_chunk, model, temperature, max_output_tokens)
                elif self.api_type in {"claude", "anthropic"}:
                    raw = await self._call_claude_native(system_prompt, text_chunk, model, temperature, max_output_tokens)
                else:
                    raw = await self._call_openai_spec(system_prompt, text_chunk, model, temperature, max_output_tokens)
                cleaned = clean_llm_response(raw)
                if not cleaned:
                    raise ValueError("Le modèle a renvoyé une réponse vide.")
                return cleaned
            except (httpx.ConnectError, httpx.ConnectTimeout, httpx.NetworkError, httpx.RemoteProtocolError) as exc:
                raise ProviderDownError("Le serveur LLM n'est plus accessible.") from exc
            except LLMResponseError as exc:
                last_error = exc
                if exc.status_code in {502, 503, 504}:
                    raise ProviderDownError("Le fournisseur LLM est temporairement indisponible.") from exc
                if exc.status_code not in {408, 409, 429} and exc.status_code < 500:
                    raise
            except Exception as exc:
                last_error = exc

            if attempt < max_retries:
                if check_cancelled:
                    await check_cancelled()
                await asyncio.sleep((2 ** (attempt - 1)) + random.uniform(0.1, 0.8))

        raise RuntimeError(f"Échec après {max_retries} essais: {last_error}")

    async def _call_openai_spec(
        self, system_prompt: str, user_text: str, model: str, temperature: float, max_tokens: int
    ) -> str:
        url = self.endpoint if self.endpoint.endswith("/chat/completions") else f"{self.endpoint}/chat/completions"
        headers = self._auth_headers()
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Voici le texte à traduire :\n\n{user_text}"},
        ]
        disable_local_thinking = self._uses_local_reasoning_prefill(model)
        if disable_local_thinking:
            # This continuation prefill was used by TraDoc before the backend audit
            # and is understood by Qwen/DeepSeek templates exposed by LM Studio.
            messages.append({"role": "assistant", "content": "<think>\n</think>\n"})
        payload = {
            "model": model,
            "messages": messages,
            "temperature": max(0.0, temperature),
            "max_tokens": max_tokens,
            "stream": False,
        }
        reasoning_overrides = self._reasoning_overrides(model)
        payload.update(reasoning_overrides)
        response = await self._client.post(url, json=payload, headers=headers)

        # Some routed models make reasoning mandatory or do not implement the
        # provider-level switch. Retry without only that optional control instead
        # of turning a compatible translation request into a hard failure.
        body_preview = response.text[:1000] if response.status_code >= 400 else ""
        if response.status_code == 400 and reasoning_overrides and any(
            marker in body_preview.lower()
            for marker in ("reasoning", "thinking", "effort", "mandatory", "unsupported")
        ):
            for key in reasoning_overrides:
                payload.pop(key, None)
            response = await self._client.post(url, json=payload, headers=headers)

        # Some local templates reject a system role. Retry once with a combined user message.
        body_preview = response.text[:1000] if response.status_code >= 400 else ""
        if response.status_code >= 400 and (
            "jinja" in body_preview.lower() or "conversations must start" in body_preview.lower()
        ):
            combined_messages = [
                {"role": "user", "content": f"{system_prompt}\n\nVoici le texte à traduire :\n\n{user_text}"}
            ]
            if disable_local_thinking:
                combined_messages.append({"role": "assistant", "content": "<think>\n</think>\n"})
            payload["messages"] = combined_messages
            response = await self._client.post(url, json=payload, headers=headers)

        if response.status_code != 200:
            raise LLMResponseError(response.status_code, self._safe_error(response))
        try:
            payload = response.json()
            return payload["choices"][0]["message"]["content"] or ""
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise ValueError("Réponse LLM invalide ou incomplète.") from exc

    async def _call_ollama_native(
        self, system_prompt: str, user_text: str, model: str, temperature: float, max_tokens: int
    ) -> str:
        url = f"{self.endpoint.removesuffix('/v1')}/api/chat"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Voici le texte à traduire :\n\n{user_text}"},
            ],
            "options": {"temperature": temperature, "num_predict": max_tokens},
            "stream": False,
        }
        payload["think"] = "low" if "gpt-oss" in model.lower() else False
        response = await self._client.post(url, json=payload)
        if response.status_code != 200:
            raise LLMResponseError(response.status_code, self._safe_error(response))
        try:
            return response.json()["message"]["content"]
        except (ValueError, KeyError, TypeError) as exc:
            raise ValueError("Réponse Ollama invalide.") from exc

    async def _call_claude_native(
        self, system_prompt: str, user_text: str, model: str, temperature: float, max_tokens: int
    ) -> str:
        base = self.endpoint.removesuffix("/v1")
        url = f"{base}/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        system: object = system_prompt
        if self.enable_prompt_caching:
            headers["anthropic-beta"] = "prompt-caching-2024-07-31"
            system = [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}]
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": f"Voici le texte à traduire :\n\n{user_text}"}],
            "system": system,
            "max_tokens": max_tokens,
            "temperature": max(0.0, temperature),
        }
        response = await self._client.post(url, json=payload, headers=headers)
        if response.status_code != 200:
            raise LLMResponseError(response.status_code, self._safe_error(response))
        try:
            payload = response.json()
            return "".join(block.get("text", "") for block in payload["content"] if block.get("type") == "text")
        except (ValueError, KeyError, TypeError) as exc:
            raise ValueError("Réponse Anthropic invalide.") from exc
