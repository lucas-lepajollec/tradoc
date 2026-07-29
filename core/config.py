import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    APP_NAME: str = "TraDoc"
    ENV: str = Field(default="production")
    DATA_DIR: Path = Field(default=Path("./data"))
    
    # Storage Paths
    @property
    def INPUT_DIR(self) -> Path:
        p = self.DATA_DIR / "input"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def OUTPUT_DIR(self) -> Path:
        p = self.DATA_DIR / "output"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def DB_PATH(self) -> Path:
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        return self.DATA_DIR / "tradoc.db"

    @property
    def GLOSSARY_DIR(self) -> Path:
        p = self.DATA_DIR / "glossaries"
        p.mkdir(parents=True, exist_ok=True)
        return p

    # Remote LLM Server Defaults
    LLM_ENDPOINT: str = Field(default="http://192.168.0.201:1234/v1")
    LLM_API_KEY: str = Field(default="lm-studio")
    LLM_MODEL: str = Field(default="qwen3.5-instruct")
    API_TYPE: str = Field(default="openai")  # "openai" or "ollama"
    
    # Engine Settings
    CONCURRENCY: int = Field(default=1, ge=1, le=32)
    CHUNK_TOKEN_SIZE: int = Field(default=1000, ge=200, le=4000)
    MAX_RETRIES: int = Field(default=3)
    REQUEST_TIMEOUT: float = Field(default=180.0)
    TEMPERATURE: float = Field(default=0.15)
    
    # Translation defaults
    DEFAULT_SOURCE_LANG: str = "en"
    DEFAULT_TARGET_LANG: str = "fr"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

DEFAULT_LITERARY_SYSTEM_PROMPT = """Tu es un traducteur littéraire professionnel expert en Anglais-Français. 
Ta tâche est de traduire le texte anglais fourni en un français fluide, naturel et élégant, digne d'une maison d'édition francophone.

RÈGLES STRICTES :
1. Conservation des noms propres et de l'univers : Ne traduis PAS les noms propres de lieux, de personnages ou les termes spécifiques à l'univers (ex: "Crimson" = "Cramoisi", "Temple" dans le contexte anatomique = "Tempe").
2. Fidélité au texte : Ne saute AUCUNE phrase, n'ajoute AUCUN commentaire, et ne répète JAMAIS de paragraphe.
3. Intégrité des balises : Conserve exactement la structure des balises HTML (<p>, <i>, <b>, etc.) fournies dans le texte.
4. Réponse directe : Renvoie STRICTEMENT ET UNIQUEMENT la traduction du texte. Pas de bavardage, pas de préambule, pas d'explication. N'écris aucune réflexion interne ni balise <think>.
"""
