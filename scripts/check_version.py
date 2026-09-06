"""Validate TraDoc's single product-version contract."""

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from core import __version__  # noqa: E402


SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


web_package = load_json(ROOT / "web" / "package.json")
web_lock = load_json(ROOT / "web" / "package-lock.json")

if not SEMVER.fullmatch(__version__):
    raise SystemExit(f"Invalid backend product version: {__version__}")
if not web_package.get("private"):
    raise SystemExit("The TraDoc web package must stay private; it is not published to npm.")
if web_package.get("version") != __version__:
    raise SystemExit("core.__version__ and web/package.json do not match.")
if web_lock.get("version") != __version__ or web_lock.get("packages", {}).get("", {}).get("version") != __version__:
    raise SystemExit("TraDoc's web package and package-lock versions do not match.")

if os.getenv("GITHUB_REF_TYPE") == "tag":
    expected = f"v{__version__}"
    if os.getenv("GITHUB_REF_NAME") != expected:
        raise SystemExit(f"Release tag {os.getenv('GITHUB_REF_NAME')} does not match product version {expected}.")

print(f"TraDoc version contract verified: {__version__}")
