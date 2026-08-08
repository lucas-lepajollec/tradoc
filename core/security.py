import asyncio
import ipaddress
import socket
import zipfile
from pathlib import Path, PurePosixPath
from typing import Optional
from urllib.parse import urlparse

from fastapi import UploadFile

from core.config import settings


SUPPORTED_UPLOADS = {".epub", ".pdf", ".docx", ".md", ".txt"}
LOCAL_PROVIDERS = {"lm-studio", "ollama"}
KNOWN_PROVIDER_HOSTS = {
    "openai": {"api.openai.com"},
    "deepseek": {"api.deepseek.com"},
    "openrouter": {"openrouter.ai"},
    "minimax": {"api.minimax.chat"},
    "kimi": {"api.moonshot.cn"},
    "glm": {"open.bigmodel.cn"},
    "gemini": {"generativelanguage.googleapis.com"},
    "claude": {"api.anthropic.com"},
    "anthropic": {"api.anthropic.com"},
}


class UploadValidationError(ValueError):
    pass


def safe_data_path(relative_path: str) -> Path:
    candidate = (settings.DATA_DIR / relative_path).resolve()
    try:
        candidate.relative_to(settings.DATA_DIR.resolve())
    except ValueError as exc:
        raise ValueError("Chemin de données invalide.") from exc
    return candidate


def _is_always_forbidden_ip(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        address.is_unspecified
        or address.is_multicast
        or address.is_link_local
        or address.is_reserved
    )


async def validate_llm_endpoint(endpoint: str, api_type: str) -> str:
    parsed = urlparse((endpoint or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("L'endpoint doit être une URL HTTP(S) valide.")
    if parsed.username or parsed.password:
        raise ValueError("Les identifiants intégrés à l'URL ne sont pas autorisés.")
    if parsed.fragment:
        raise ValueError("Les fragments d'URL ne sont pas autorisés.")

    hostname = parsed.hostname.rstrip(".").lower()
    allowlisted = {
        host.strip().lower()
        for host in settings.ALLOWED_LLM_HOSTS.split(",")
        if host.strip()
    }
    local_allowed = (api_type or "").lower() in LOCAL_PROVIDERS
    if hostname in {"metadata.google.internal", "metadata", "169.254.169.254"}:
        raise ValueError("Cet endpoint interne est interdit.")

    try:
        addresses = [ipaddress.ip_address(hostname)]
    except ValueError:
        try:
            info = await asyncio.to_thread(socket.getaddrinfo, hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        except socket.gaierror as exc:
            raise ValueError("Le nom d'hôte de l'endpoint ne peut pas être résolu.") from exc
        addresses = list({ipaddress.ip_address(item[4][0]) for item in info})

    if any(_is_always_forbidden_ip(address) for address in addresses):
        raise ValueError("Cette plage réseau n'est jamais autorisée pour un endpoint LLM.")
    if any(address.is_loopback or address.is_private for address in addresses) and not local_allowed and hostname not in allowlisted:
        raise ValueError(
            "Les adresses privées ou locales sont réservées aux fournisseurs LM Studio et Ollama."
        )
    provider_hosts = KNOWN_PROVIDER_HOSTS.get((api_type or "").lower())
    if provider_hosts and hostname not in provider_hosts and hostname not in allowlisted:
        raise ValueError(
            "Cet hôte ne correspond pas au fournisseur choisi. Ajoutez-le explicitement à ALLOWED_LLM_HOSTS si nécessaire."
        )
    return parsed.geturl().rstrip("/")


def _validate_zip(path: Path, suffix: str) -> None:
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            if len(entries) > settings.MAX_ARCHIVE_ENTRIES:
                raise UploadValidationError("L'archive contient trop de fichiers.")
            total_size = 0
            names = set()
            for entry in entries:
                name = entry.filename.replace("\\", "/")
                pure = PurePosixPath(name)
                if pure.is_absolute() or ".." in pure.parts:
                    raise UploadValidationError("L'archive contient un chemin dangereux.")
                if entry.flag_bits & 0x1:
                    raise UploadValidationError("Les archives chiffrées ne sont pas acceptées.")
                if ((entry.external_attr >> 16) & 0o170000) == 0o120000:
                    raise UploadValidationError("Les liens symboliques ne sont pas acceptés dans l'archive.")
                total_size += entry.file_size
                if entry.compress_size and entry.file_size / entry.compress_size > 250:
                    raise UploadValidationError("L'archive présente un taux de compression dangereux.")
                if name.lower().endswith((".xml", ".xhtml", ".html", ".opf", ".ncx")) and entry.file_size:
                    with archive.open(entry) as xml_file:
                        prefix = xml_file.read(8192).upper()
                    # `SYSTEM` is also ordinary prose in EPUB chapters (for example
                    # "currency system was..."). External entities are declared
                    # with <!ENTITY ...>; a bare XHTML DOCTYPE is harmless here and
                    # must remain valid for EPUB 2 documents.
                    if b"<!ENTITY" in prefix or (b"<!DOCTYPE" in prefix and b"[" in prefix):
                        raise UploadValidationError("Les déclarations XML externes ne sont pas autorisées.")
                names.add(name)
            if len(names) != len(entries):
                raise UploadValidationError("L'archive contient des entrées dupliquées.")
            if total_size > settings.MAX_ARCHIVE_UNCOMPRESSED_BYTES:
                raise UploadValidationError("L'archive décompressée est trop volumineuse.")
            if suffix == ".epub":
                mime = b""
                if "mimetype" in names:
                    with archive.open("mimetype") as mime_file:
                        mime = mime_file.read(40)
                if mime != b"application/epub+zip":
                    raise UploadValidationError("Le fichier n'est pas un EPUB valide.")
            elif suffix == ".docx":
                if "[Content_Types].xml" not in names or "word/document.xml" not in names:
                    raise UploadValidationError("Le fichier n'est pas un DOCX valide.")
    except zipfile.BadZipFile as exc:
        raise UploadValidationError("Archive ZIP invalide ou corrompue.") from exc


def validate_uploaded_file(path: Path, expected_suffix: str) -> None:
    suffix = expected_suffix.lower()
    if suffix not in SUPPORTED_UPLOADS:
        raise UploadValidationError("Format non supporté. Utilisez EPUB, PDF, DOCX, MD ou TXT.")
    with path.open("rb") as source:
        header = source.read(16)
    if suffix in {".epub", ".docx"}:
        if not header.startswith(b"PK"):
            raise UploadValidationError("Le contenu ne correspond pas à une archive valide.")
        _validate_zip(path, suffix)
    elif suffix == ".pdf":
        if not header.startswith(b"%PDF-"):
            raise UploadValidationError("Le contenu ne correspond pas à un PDF valide.")
    else:
        with path.open("rb") as source:
            sample = source.read(65536)
        if b"\x00" in sample:
            raise UploadValidationError("Le fichier texte semble contenir des données binaires.")
        try:
            sample.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise UploadValidationError("Les fichiers texte doivent être encodés en UTF-8.") from exc


async def save_upload_limited(upload: UploadFile, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    try:
        with destination.open("xb") as output:
            while chunk := await upload.read(1024 * 1024):
                total += len(chunk)
                if total > settings.MAX_UPLOAD_BYTES:
                    raise UploadValidationError(
                        f"Le fichier dépasse la limite de {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} Mo."
                    )
                output.write(chunk)
        validate_uploaded_file(destination, destination.suffix)
        return total
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()
