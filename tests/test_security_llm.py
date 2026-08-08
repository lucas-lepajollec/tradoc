import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock

import httpx
from core.llm_client import LLMClient
from core.security import UploadValidationError, validate_llm_endpoint, validate_uploaded_file


class LLMClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_custom_openai_compatible_endpoint_is_preserved(self):
        client = LLMClient("http://127.0.0.1:1234/v1", api_type="openai")
        try:
            self.assertEqual(client.endpoint, "http://127.0.0.1:1234/v1")
        finally:
            await client.aclose()

    async def test_local_qwen_translation_disables_thinking(self):
        client = LLMClient("http://127.0.0.1:1234/v1", api_type="lm-studio")
        response = httpx.Response(
            200,
            json={"choices": [{"message": {"content": "<p>Bonjour</p>"}}]},
            request=httpx.Request("POST", "http://127.0.0.1:1234/v1/chat/completions"),
        )
        client._client.post = AsyncMock(return_value=response)
        try:
            translated = await client._call_openai_spec("Prompt", "<p>Hello</p>", "qwen3.5-9b", 0.15, 1200)
            payload = client._client.post.await_args.kwargs["json"]
            self.assertEqual(translated, "<p>Bonjour</p>")
            self.assertNotIn("chat_template_kwargs", payload)
            self.assertEqual(payload["messages"][-1], {"role": "assistant", "content": "<think>\n</think>\n"})
        finally:
            await client.aclose()

    async def test_local_translation_uses_an_adaptive_completion_floor(self):
        client = LLMClient("http://127.0.0.1:1234/v1", api_type="lm-studio")
        response = httpx.Response(
            200,
            json={"choices": [{"message": {"content": "<p>Bonjour</p>"}}]},
            request=httpx.Request("POST", "http://127.0.0.1:1234/v1/chat/completions"),
        )
        client._client.post = AsyncMock(return_value=response)
        try:
            await client.translate_chunk("Prompt", "<p>Hello</p>", "qwen3.5-9b", 0.15, max_retries=1)
            payload = client._client.post.await_args.kwargs["json"]
            self.assertEqual(payload["max_tokens"], 1200)
        finally:
            await client.aclose()

    async def test_provider_specific_reasoning_controls(self):
        cases = [
            ("deepseek", "deepseek-v4-flash", {"thinking": {"type": "disabled"}}),
            ("openrouter", "qwen/qwen3", {"reasoning": {"effort": "none", "exclude": True}}),
            ("gemini", "gemini-2.5-flash", {"reasoning_effort": "none"}),
            ("gemini", "gemini-3-flash", {"reasoning_effort": "minimal"}),
            ("openai", "gpt-5.2", {"reasoning_effort": "none"}),
            ("openai", "gpt-5-pro", {}),
            ("anthropic", "claude-sonnet", {}),
        ]
        for api_type, model, expected in cases:
            client = LLMClient(None, api_type=api_type)
            try:
                self.assertEqual(client._reasoning_overrides(model), expected)
            finally:
                await client.aclose()

    async def test_ollama_native_disables_thinking_or_uses_lowest_supported_level(self):
        for model, expected in (("qwen3", False), ("gpt-oss:20b", "low")):
            client = LLMClient("http://127.0.0.1:11434", api_type="ollama")
            response = httpx.Response(
                200,
                json={"message": {"content": "Bonjour"}},
                request=httpx.Request("POST", "http://127.0.0.1:11434/api/chat"),
            )
            client._client.post = AsyncMock(return_value=response)
            try:
                await client._call_ollama_native("Prompt", "Hello", model, 0.15, 1200)
                payload = client._client.post.await_args.kwargs["json"]
                self.assertEqual(payload["think"], expected)
            finally:
                await client.aclose()


class EndpointSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def test_private_endpoint_requires_local_provider(self):
        with self.assertRaises(ValueError):
            await validate_llm_endpoint("http://127.0.0.1:1234/v1", "openai")
        result = await validate_llm_endpoint("http://127.0.0.1:1234/v1", "lm-studio")
        self.assertEqual(result, "http://127.0.0.1:1234/v1")


class UploadSecurityTests(unittest.TestCase):
    @staticmethod
    def _write_epub(path: Path, chapter: str) -> None:
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr(
                "mimetype",
                "application/epub+zip",
                compress_type=zipfile.ZIP_STORED,
            )
            archive.writestr("OEBPS/chapter.xhtml", chapter)

    def test_fake_docx_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fake.docx"
            path.write_bytes(b"not a zip")
            with self.assertRaises(UploadValidationError):
                validate_uploaded_file(path, ".docx")

    def test_zip_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.docx"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("[Content_Types].xml", "x")
                archive.writestr("word/document.xml", "x")
                archive.writestr("../escape.txt", "x")
            with self.assertRaises(UploadValidationError):
                validate_uploaded_file(path, ".docx")

    def test_epub_prose_containing_system_is_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "valid.epub"
            self._write_epub(
                path,
                "<html><body><p>At the top of the currency system was the gold pound.</p></body></html>",
            )
            validate_uploaded_file(path, ".epub")

    def test_epub_standard_external_doctype_is_accepted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "valid-doctype.epub"
            self._write_epub(
                path,
                '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" '
                '"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
                "<html><body><p>Hello</p></body></html>",
            )
            validate_uploaded_file(path, ".epub")

    def test_epub_xml_entity_declaration_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "xxe.epub"
            self._write_epub(
                path,
                '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'
                "<html><body><p>&xxe;</p></body></html>",
            )
            with self.assertRaises(UploadValidationError):
                validate_uploaded_file(path, ".epub")


if __name__ == "__main__":
    unittest.main()
