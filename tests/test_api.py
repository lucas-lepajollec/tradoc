import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from api.app import app
from core.checkpoint import JobRecord
from core.config import settings


class ApiSecurityTests(unittest.TestCase):
    def setUp(self):
        self.previous_secret = settings.APP_SECRET
        self.previous_trusted_lan_proxy = settings.TRUSTED_LAN_PROXY
        settings.APP_SECRET = "unit-test-secret"
        settings.TRUSTED_LAN_PROXY = False
        self.client = TestClient(app)

    def tearDown(self):
        settings.APP_SECRET = self.previous_secret
        settings.TRUSTED_LAN_PROXY = self.previous_trusted_lan_proxy

    def test_health_is_public(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)

    def test_api_requires_secret_when_configured(self):
        self.assertEqual(self.client.get("/api/jobs").status_code, 401)
        response = self.client.get("/api/jobs", headers={"X-App-Secret": "unit-test-secret"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("x-content-type-options"), "nosniff")

    def test_local_vite_proxy_origin_is_allowed_across_ports(self):
        response = self.client.post(
            "/api/settings/test-connection",
            headers={
                "Origin": "http://localhost:2499",
                "Host": "127.0.0.1:8000",
                "X-App-Secret": "unit-test-secret",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_untrusted_mutating_origin_is_rejected(self):
        response = self.client.post(
            "/api/settings/test-connection",
            headers={
                "Origin": "https://malicious.example",
                "Host": "127.0.0.1:8000",
                "X-App-Secret": "unit-test-secret",
            },
        )
        self.assertEqual(response.status_code, 403)

    def test_explicit_trusted_lan_proxy_accepts_phone_origin(self):
        settings.APP_SECRET = ""
        settings.TRUSTED_LAN_PROXY = True
        response = self.client.post(
            "/api/settings/test-connection",
            headers={
                "Origin": "http://192.168.0.201:2499",
                "Host": "127.0.0.1:8000",
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_connection_fetches_models_only_once(self):
        class FakeClient:
            def __init__(self):
                self.fetch_count = 0

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, traceback):
                return None

            async def fetch_models(self):
                self.fetch_count += 1
                return ["model-a", "model-b"]

        fake_client = FakeClient()
        with patch("api.routes._new_client", new=AsyncMock(return_value=fake_client)):
            response = self.client.post(
                "/api/settings/test-connection",
                headers={"X-App-Secret": "unit-test-secret"},
                json={"api_type": "lm-studio", "endpoint": "http://127.0.0.1:1234/v1"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(response.json()["models"], ["model-a", "model-b"])
        self.assertEqual(fake_client.fetch_count, 1)

    def test_active_job_download_returns_and_cleans_a_partial_snapshot(self):
        job = JobRecord(
            id="partial-api-job",
            file_name="book.txt",
            file_type="txt",
            source_lang="en",
            target_lang="fr",
            model="fake-model",
            status="PROCESSING",
            total_chunks=4,
            completed_chunks=2,
            created_at="2026-08-09T12:00:00",
        )
        with tempfile.TemporaryDirectory() as directory:
            preview = Path(directory) / ".partial-preview.txt"
            preview.write_text("Bonjour.\n\nWorld.\n", encoding="utf-8")
            with (
                patch("api.routes.db.get_job", new=AsyncMock(return_value=job)),
                patch("api.routes.db.count_unfinished_segments", new=AsyncMock(return_value=2)),
                patch("api.routes.engine.rebuild_output_file", new=AsyncMock(return_value=preview)) as rebuild,
            ):
                response = self.client.get(
                    "/api/jobs/partial-api-job/download",
                    headers={"X-App-Secret": "unit-test-secret"},
                )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers.get("x-tradoc-export"), "partial")
            self.assertIn("apercu_partiel_book.txt", response.headers.get("content-disposition", ""))
            self.assertEqual(response.text.replace("\r\n", "\n"), "Bonjour.\n\nWorld.\n")
            rebuild.assert_awaited_once_with("partial-api-job", allow_partial=True)
            self.assertFalse(preview.exists())

    def test_partial_download_waits_for_the_first_completed_segment(self):
        job = JobRecord(
            id="empty-partial-job",
            file_name="book.md",
            file_type="md",
            source_lang="en",
            target_lang="fr",
            model="fake-model",
            status="PROCESSING",
            total_chunks=4,
            completed_chunks=0,
            created_at="2026-08-09T12:00:00",
        )
        with (
            patch("api.routes.db.get_job", new=AsyncMock(return_value=job)),
            patch("api.routes.db.count_unfinished_segments", new=AsyncMock(return_value=4)),
        ):
            response = self.client.get(
                "/api/jobs/empty-partial-job/download",
                headers={"X-App-Secret": "unit-test-secret"},
            )

        self.assertEqual(response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
