import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
ENTRYPOINT = REPOSITORY_ROOT / "docker-entrypoint.sh"


class DockerEntrypointTests(unittest.TestCase):
    def test_creates_data_dir_without_generating_a_secret(self):
        with tempfile.TemporaryDirectory() as directory:
            data_dir = Path(directory) / "data"
            environment = os.environ.copy()
            environment["DATA_DIR"] = str(data_dir)
            environment.pop("APP_SECRET", None)
            environment.pop("APP_SECRET_FILE", None)
            result = subprocess.run(
                [
                    "sh",
                    str(ENTRYPOINT),
                    sys.executable,
                    "-c",
                    "print('ok')",
                ],
                check=True,
                capture_output=True,
                text=True,
                env=environment,
            )

            self.assertEqual(result.stdout.strip().splitlines()[-1], "ok")
            self.assertTrue(data_dir.is_dir())
            self.assertFalse((data_dir / ".app_secret").exists())


if __name__ == "__main__":
    unittest.main()
