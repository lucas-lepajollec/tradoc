import os
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
ENTRYPOINT = REPOSITORY_ROOT / "docker-entrypoint.sh"


class DockerEntrypointTests(unittest.TestCase):
    def run_entrypoint(self, data_dir: Path, app_secret: str | None = None) -> str:
        environment = os.environ.copy()
        environment["DATA_DIR"] = str(data_dir)
        environment.pop("APP_SECRET_FILE", None)
        if app_secret is None:
            environment.pop("APP_SECRET", None)
        else:
            environment["APP_SECRET"] = app_secret
        result = subprocess.run(
            [
                "sh",
                str(ENTRYPOINT),
                sys.executable,
                "-c",
                "import os; print(os.environ['APP_SECRET'])",
            ],
            check=True,
            capture_output=True,
            text=True,
            env=environment,
        )
        return result.stdout.strip().splitlines()[-1]

    def test_generates_and_reuses_persistent_secret(self):
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            first = self.run_entrypoint(data_dir)
            second = self.run_entrypoint(data_dir)
            secret_file = data_dir / ".app_secret"

            self.assertGreaterEqual(len(first), 32)
            self.assertEqual(first, second)
            self.assertEqual(stat.S_IMODE(secret_file.stat().st_mode), 0o600)

    def test_explicit_secret_takes_priority(self):
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory)
            configured = "configured-secret-with-at-least-24-characters"

            self.assertEqual(self.run_entrypoint(data_dir, configured), configured)
            self.assertFalse((data_dir / ".app_secret").exists())


if __name__ == "__main__":
    unittest.main()
