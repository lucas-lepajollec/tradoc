import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

import api.integrations as integrations
import api.routes as routes
from api.app import app
from core.checkpoint import CheckpointDatabase
from core.config import settings


class IntegrationApiTests(unittest.TestCase):
    """The /api/v1 surface other apps (for example Bunko) use, on an isolated database."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous_data_dir = settings.DATA_DIR
        settings.DATA_DIR = Path(self.temp.name)
        self.db = CheckpointDatabase(Path(self.temp.name) / "tradoc.db")
        self.patches = [
            patch.object(routes, "db", self.db),
            patch.object(integrations, "db", self.db),
            patch.object(routes.engine, "db", self.db),
            patch("api.routes.validate_llm_endpoint", new=AsyncMock(side_effect=lambda endpoint, _provider: endpoint)),
        ]
        for active in self.patches:
            active.start()
        self.client = TestClient(app)

    def tearDown(self):
        for active in reversed(self.patches):
            active.stop()
        settings.DATA_DIR = self.previous_data_dir
        self.temp.cleanup()

    def connect(self, name="Bunko", provider="ollama", model="qwen2.5:7b"):
        response = self.client.post(
            "/api/integrations",
            json={"name": name, "default_provider": provider, "default_model": model},
        )
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertTrue(payload["token"].startswith("tdk_"))
        self.assertNotIn("token_hash", payload["client"])
        return payload["client"], {"Authorization": f"Bearer {payload['token']}"}

    def upload(self, headers, **fields):
        data = {"source_lang": "en", "target_lang": "fr", "start": "false", **fields}
        return self.client.post(
            "/api/v1/translations",
            headers=headers,
            data=data,
            files={"file": ("chapter.md", b"# Chapter One\n\nThe observatory dome opened above us.\n", "text/markdown")},
        )

    def test_requests_without_a_valid_token_are_rejected(self):
        self.assertEqual(self.client.get("/api/v1/info").status_code, 401)
        bad = self.client.get("/api/v1/info", headers={"Authorization": "Bearer tdk_wrong"})
        self.assertEqual(bad.status_code, 401)
        self.assertIn("Bearer", bad.headers["WWW-Authenticate"])

    def test_connected_app_creates_follows_and_deletes_a_translation(self):
        client, headers = self.connect()
        info = self.client.get("/api/v1/info", headers=headers).json()
        self.assertEqual(info["client"]["name"], "Bunko")
        self.assertEqual(info["default"], {"provider": "ollama", "model": "qwen2.5:7b"})

        created = self.upload(headers, external_ref="bunko-book-42")
        self.assertEqual(created.status_code, 202, created.text)
        translation = created.json()
        self.assertEqual(translation["status"], "pending")
        self.assertEqual(translation["provider"], "ollama")
        self.assertEqual(translation["model"], "qwen2.5:7b")
        self.assertEqual(translation["external_ref"], "bunko-book-42")
        self.assertGreater(translation["progress"]["total"], 0)

        # The project also exists in TraDoc's own interface, tagged with its origin.
        job = self.client.get(f"/api/jobs/{translation['id']}").json()
        self.assertEqual(job["client_name"], "Bunko")
        self.assertEqual(job["client_id"], client["id"])

        listed = self.client.get("/api/v1/translations", headers=headers).json()
        self.assertEqual([item["id"] for item in listed], [translation["id"]])
        self.assertEqual(self.client.get(f"/api/v1/translations/{translation['id']}/result", headers=headers).status_code, 409)

        deleted = self.client.delete(f"/api/v1/translations/{translation['id']}", headers=headers)
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/translations/{translation['id']}", headers=headers).status_code, 404)

    def test_upload_starts_the_translation_by_default(self):
        class FakeClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *_):
                return None

        _, headers = self.connect()
        with (
            patch("api.routes._new_client", new=AsyncMock(return_value=FakeClient())) as new_client,
            patch.object(routes.engine, "run_job", new=AsyncMock()) as run_job,
        ):
            response = self.upload(headers, start="true")
            self.assertEqual(response.status_code, 202, response.text)
            self.assertEqual(response.json()["status"], "running")
            self.assertEqual(new_client.await_args.args[0], "ollama")
        self.assertTrue(run_job.await_count <= 1)

    def test_a_connection_only_sees_its_own_translations(self):
        _, bunko = self.connect("Bunko")
        _, other = self.connect("Other app")
        translation = self.upload(bunko).json()
        self.assertEqual(self.client.get(f"/api/v1/translations/{translation['id']}", headers=other).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/v1/translations/{translation['id']}", headers=other).status_code, 404)
        self.assertEqual(self.client.get("/api/v1/translations", headers=other).json(), [])

    def test_a_model_is_required_when_the_connection_has_no_default(self):
        _, headers = self.connect(provider=None, model=None)
        response = self.upload(headers)
        self.assertEqual(response.status_code, 422)
        self.assertIn("model", response.json()["detail"])

    def test_revoked_connection_stops_working(self):
        client, headers = self.connect()
        self.assertEqual(self.client.get("/api/v1/info", headers=headers).status_code, 200)
        listed = self.client.get("/api/integrations").json()
        self.assertEqual([item["name"] for item in listed], ["Bunko"])
        self.assertIsNotNone(listed[0]["last_used_at"])
        self.assertEqual(self.client.delete(f"/api/integrations/{client['id']}").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/info", headers=headers).status_code, 401)


if __name__ == "__main__":
    unittest.main()
