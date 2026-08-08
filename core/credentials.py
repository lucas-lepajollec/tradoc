import json
import os
import threading
from pathlib import Path
from typing import Dict, Optional


class ProviderCredentialStore:
    """Small server-side vault for provider credentials.

    The file is deliberately never exposed by the API. It is written atomically
    and restricted to the current OS user when the platform supports chmod.
    """

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def _read(self) -> Dict[str, Dict[str, str]]:
        if not self.path.exists():
            return {}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _write(self, data: Dict[str, Dict[str, str]]) -> None:
        temp_path = self.path.with_suffix(".tmp")
        temp_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        try:
            os.chmod(temp_path, 0o600)
        except OSError:
            pass
        temp_path.replace(self.path)
        try:
            os.chmod(self.path, 0o600)
        except OSError:
            pass

    @staticmethod
    def _provider_key(provider: str) -> str:
        value = "".join(ch for ch in (provider or "").lower() if ch.isalnum() or ch in ("-", "_"))
        if not value:
            raise ValueError("Type de fournisseur invalide")
        return value

    def set(self, provider: str, api_key: Optional[str], endpoint: Optional[str] = None) -> None:
        key = self._provider_key(provider)
        with self._lock:
            data = self._read()
            record = data.get(key, {})
            if api_key is not None:
                cleaned = api_key.strip()
                if cleaned:
                    record["api_key"] = cleaned
                else:
                    record.pop("api_key", None)
            if endpoint is not None:
                cleaned_endpoint = endpoint.strip()
                if cleaned_endpoint:
                    record["endpoint"] = cleaned_endpoint
                else:
                    record.pop("endpoint", None)
            if record:
                data[key] = record
            else:
                data.pop(key, None)
            self._write(data)

    def get_api_key(self, provider: str) -> Optional[str]:
        key = self._provider_key(provider)
        with self._lock:
            value = self._read().get(key, {}).get("api_key")
            return value if isinstance(value, str) and value else None

    def get_endpoint(self, provider: str) -> Optional[str]:
        key = self._provider_key(provider)
        with self._lock:
            value = self._read().get(key, {}).get("endpoint")
            return value if isinstance(value, str) and value else None

    def metadata(self) -> Dict[str, Dict[str, object]]:
        with self._lock:
            return {
                provider: {
                    "has_api_key": bool(record.get("api_key")),
                    "endpoint": record.get("endpoint") or None,
                }
                for provider, record in self._read().items()
                if isinstance(record, dict)
            }
