import json
import os
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

class GlossaryItem(BaseModel):
    source: str = Field(min_length=1, max_length=500)
    target: str = Field(default="", max_length=500)
    category: str = Field(default="general", max_length=50)
    note: Optional[str] = Field(default=None, max_length=2000)

class Glossary(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default="", max_length=5000)
    items: List[GlossaryItem] = Field(default_factory=list, max_length=50_000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not any(character.isalnum() for character in value):
            raise ValueError("Le nom du glossaire doit contenir au moins un caractère alphanumérique.")
        return value.strip()

    def to_prompt_text(self) -> str:
        """Formats the glossary terms into a strict instruction section for system prompt."""
        if not self.items:
            return ""

        lines = ["\nGLOSSAIRE & REGLES DE TERMES (A RESPECTER IMPÉRATIVEMENT) :"]
        for item in self.items:
            note_str = f" ({item.note})" if item.note else ""
            if item.source == item.target or not item.target:
                lines.append(f"- '{item.source}' : Garder le terme exact non-traduit{note_str}.")
            else:
                lines.append(f"- '{item.source}' -> Traduire obligatoirement par '{item.target}'{note_str}.")
        lines.append("")
        return "\n".join(lines)


class GlossaryManager:
    def __init__(self, glossary_dir: Path):
        self.glossary_dir = glossary_dir
        self.glossary_dir.mkdir(parents=True, exist_ok=True)

    def get_path(self, name: str) -> Path:
        safe_name = "".join(c for c in name if c.isalnum() or c in ("-", "_")).lower()
        if not safe_name:
            raise ValueError("Nom de glossaire invalide")
        return self.glossary_dir / f"{safe_name}.json"

    def list_glossaries(self) -> List[str]:
        return [p.stem for p in self.glossary_dir.glob("*.json")]

    def load_glossary(self, name: str) -> Optional[Glossary]:
        try:
            path = self.get_path(name)
        except ValueError:
            return None
        if not path.exists():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return Glossary(**data)
        except Exception:
            return None

    def save_glossary(self, glossary: Glossary) -> bool:
        path = self.get_path(glossary.name)
        try:
            temp_path = path.with_suffix(".tmp")
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(glossary.model_dump(), f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            temp_path.replace(path)
            return True
        except Exception:
            return False

    def delete_glossary(self, name: str) -> bool:
        try:
            path = self.get_path(name)
        except ValueError:
            return False
        if path.exists():
            path.unlink()
            return True
        return False
