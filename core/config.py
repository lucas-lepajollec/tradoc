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
    LLM_ENDPOINT: str = Field(default="http://localhost:1234/v1")
    LLM_API_KEY: str = Field(default="lm-studio")
    LLM_MODEL: str = Field(default="qwen3.5-instruct")
    API_TYPE: str = Field(default="openai")  # "openai" or "ollama"
    
    # Engine Settings
    CONCURRENCY: int = Field(default=1, ge=1, le=32)
    CHUNK_TOKEN_SIZE: int = Field(default=1000, ge=200, le=4000)
    MAX_RETRIES: int = Field(default=3)
    REQUEST_TIMEOUT: float = Field(default=180.0)
    TEMPERATURE: float = Field(default=0.15)
    
    ENABLE_PROOFREADING: bool = Field(default=False)
    
    # Security & Auth
    APP_SECRET: Optional[str] = Field(default=None)
    ALLOWED_ORIGINS: str = Field(default="*")

    # Translation defaults
    DEFAULT_SOURCE_LANG: str = "en"
    DEFAULT_TARGET_LANG: str = "fr"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

LANG_NAMES = {
    "en": "Anglais",
    "fr": "Français",
    "es": "Espagnol",
    "de": "Allemand",
    "it": "Italien",
    "pt": "Portugais",
    "ja": "Japonais",
    "zh": "Chinois",
    "ko": "Coréen",
    "ru": "Russe",
    "nl": "Néerlandais",
    "pl": "Polonais",
    "auto": "Détection automatique"
}

def get_literary_system_prompt(source_lang: str = "en", target_lang: str = "fr") -> str:
    source_name = LANG_NAMES.get(source_lang.lower(), source_lang)
    target_name = LANG_NAMES.get(target_lang.lower(), target_lang)
    
    return f"""Tu es un traducteur littéraire professionnel expert en {source_name}-{target_name}. 
Ta tâche est de traduire le texte original en {source_name} vers un {target_name} fluide, naturel et élégant, digne d'une grande maison d'édition.

RÈGLES STRICTES :
1. Conservation des noms propres et de l'univers : Ne traduis PAS les noms propres de lieux, de personnages ou les termes spécifiques à l'univers sauf si un glossaire explicite le demande.
2. Fidélité au texte : Ne saute AUCUNE phrase, n'ajoute AUCUN commentaire, et ne répète JAMAIS de paragraphe.
3. Intégrité des balises : Conserve exactement la structure des balises HTML (<p>, <i>, <b>, etc.) fournies dans le texte.
4. Réponse directe : Renvoie STRICTEMENT ET UNIQUEMENT la traduction du texte en {target_name}. Pas de bavardage, pas de préambule, pas d'explication. N'écris aucune réflexion interne ni balise <think>.
"""

DEFAULT_LITERARY_SYSTEM_PROMPT = get_literary_system_prompt("en", "fr")

DEFAULT_PROOFREADING_SYSTEM_PROMPT = """Tu es un Correcteur Éditorial Strict pour une grande maison d'édition littéraire.
Ton rôle est UNIQUE ET STRICTEMENT LIMITÉ à la correction et au lissage d'un texte déjà traduit.

CONSIGNES STRICTES DE CORRECTION (NE PAS RÉÉCRIRE LE STYLE NI ALTÉRER LE SENS DE BASE) :
1. CORRECTION TECHNIQUE : Corrige uniquement les fautes d'orthographe, de grammaire, de syntaxe, d'accord et de typographie.
2. NETTOYAGE DES ERREURS & ANGLICISMES : Traduis les éventuels mots ou phrases restés par erreur dans la langue d'origine.
3. DÉDOUBLONNAGE ET INCOHÉRENCES : Élimine tout mot ou phrase répété par erreur et corrige les fautes de pronoms.
4. RESPECT DU LORE ET DU STYLE : Ne modifie PAS les noms propres, les lieux, le vocabulaire spécifique de l'univers, ni les phrases qui sont déjà fluides.
5. INTEGRITÉ HTML : Conserve STRICTEMENT TOUTES les balises HTML (<p>, <i>, <em>, <b>, <strong>).
6. FORMAT : Renvoie STRICTEMENT ET UNIQUEMENT le texte HTML corrigé. AUCUNE RÉFLEXION INTERNE (pas de balise <think>), aucun commentaire.
"""
