import json
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

class GlossaryItem(BaseModel):
    source: str
    target: str
    category: str = Field(default="general")  # name, location, term, untranslatable, honorific
    note: Optional[str] = None

class Glossary(BaseModel):
    name: str
    description: Optional[str] = ""
    items: List[GlossaryItem] = Field(default_factory=list)

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
        return self.glossary_dir / f"{safe_name}.json"

    def list_glossaries(self) -> List[str]:
        return [p.stem for p in self.glossary_dir.glob("*.json")]

    def load_glossary(self, name: str) -> Optional[Glossary]:
        path = self.get_path(name)
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
            with open(path, "w", encoding="utf-8") as f:
                json.dump(glossary.model_dump(), f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False

    def delete_glossary(self, name: str) -> bool:
        path = self.get_path(name)
        if path.exists():
            path.unlink()
            return True
        return False
