<div align="center">
  <img src="web/public/logo.svg" alt="TraDoc Logo" width="110" />
  
  <h1>📚 TraDoc</h1>
  <p><strong>High-Performance, Self-Hosted AI Literary eBook (EPUB & PDF) Translation Suite</strong></p>
  
  <p>
    <a href="https://github.com/lucas-lepajollec/tradoc"><img src="https://img.shields.io/badge/Version-1.0.0-orange.svg?style=for-the-badge" alt="Version" /></a>
    <a href="https://python.org/"><img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-Ready-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License" /></a>
  </p>
</div>

---

**TraDoc** est une suite logicielle complète, moderne et autonome de traduction littéraire de livres et documents (**EPUB, PDF, DOCX, Markdown, TXT**). Conçue pour un déploiement local ou serveur (NAS Synology/QNAP, Docker, Portainer) relié à un serveur d'inférence LLM local ou distant (LM Studio, Ollama, vLLM, DeepSeek, OpenAI, Claude, Gemini, etc.).

---

## ✨ Features Principalement Supportées

- 📚 **Moteur Universel Multi-Formats (.epub, .pdf, .docx, .md, .txt)** : Support natif de l'extraction et de la reconstruction préservant la mise en page HTML/CSS, la typographie, les titres et les images.
- 📱 **Export EPUB Réajustable pour PDF** : Conversion intelligente des documents PDF à mise en page fixe vers un format livre numérique EPUB fluide et lisible sur n'importe quelle liseuse ou tablette.
- ⚙️ **Gestionnaire de Providers avec Mémoire Indépendante** : Mémorisation séparée des clés d'API, des endpoints et des modèles pour chaque provider (OpenAI, DeepSeek, Claude, Gemini, LM Studio, Ollama, Minimax, Kimi, GLM).
- 🔒 **Isolation des Modèles par Projet & Traduction Parallèle** : Chaque livre conserve son propre modèle dédié (`job.model`) en base de données. Possibilité de traduire plusieurs livres simultanément avec des modèles différents sans aucune interférence.
- 🛠️ **Inspecteur & Édition Inline de Config** : Ajustement à la volée des paramètres d'un projet en pause avec un bouton d'action rapide `⚡ Appliquer la config active du Dashboard`.
- ⚡ **Orchestration Asynchrone Parallèle & Auto-Pause** : Découpage sémantique par fenêtres de tokens avec concurrence paramétrable. Mise en pause automatique sans perte de données en cas de déconnexion réseau ou GPU.
- 🏷️ **Gestionnaire de Glossaires Littéraires** : Glossaires personnalisés (noms propres, lieux, univers, suffixes `-san`/`-kun`) injectés dynamiquement dans les prompts.
- 🧹 **Nettoyage Générique des Balises Réflexives (`<think>`)** : Élimination automatique des blocs de raisonnement interne des modèles récents (Qwen 3.5, DeepSeek R1, Gemma 4).
- 🛡️ **Calcul Dynamique de Context Tokens** : Gestion automatique et proportionnelle des tokens de sortie pour éviter l'erreur `Context size has been exceeded` (LM Studio HTTP 400).
- 📱 **Interface Web Glassmorphic & Tiroir Burger Mobile** : UI moderne avec état optimiste (0 ms), visualiseur de segments côte à côte, système de presets dynamique et suivi SSE en direct.

---

## 🛠️ Tech Stack

| Catégorie | Technologies Utilisées |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | FastAPI, Uvicorn, Python 3.11+ |
| **Inférence LLM** | HTTP Async Client (httpx) compatible OpenAI API / Ollama / LM Studio |
| **Base de Données** | SQLite3 (Mode WAL multi-lecteurs/écrivains) |
| **Parsers** | EbookLib, PyMuPDF, BeautifulSoup4, Lxml |
| **Conteneurisation** | Docker Multi-Stage (Alpine Node + Slim Python) |

---

## 🚀 Getting Started

### Prerequisites

- [Python 3.11+](https://www.python.org/) & [Node.js 18+](https://nodejs.org/) (pour l'exécution en local)
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) (pour le déploiement NAS/Serveur)
- Un serveur d'inférence LLM local ou distant ([LM Studio](https://lmstudio.ai/), [Ollama](https://ollama.com/), vLLM, etc.)

---

### 💻 Mode Développement Local (Windows / Mac / Linux)

#### 1. Cloner le dépôt et configurer l'environnement :
```bash
git clone https://github.com/lucas-lepajollec/tradoc.git
cd tradoc
cp .env.example .env
```

#### 2. Lancer le Backend FastAPI (Terminal 1) :
```powershell
# Windows PowerShell (utilisation directe du venv recommandé) :
.\.venv\Scripts\python main.py serve --host 0.0.0.0 --port 8000 --reload
```

#### 3. Lancer le Frontend React (Terminal 2) :
```bash
cd web
npm install
npm run dev
```
*L'interface web est immédiatement accessible sur `http://localhost:2499/`.*

---

## 🐳 Déploiement Docker (NAS Synology, QNAP, Portainer & Linux)

Vous pouvez déployer TraDoc facilement sur votre NAS ou serveur en utilisant l'image officielle hébergée sur GitHub Container Registry (`ghcr.io`).

### Option A : Déploiement via Image Officielle (Recommandé)

Créez un fichier `docker-compose.yml` (ou collez ce bloc dans Portainer) :

```yaml
version: '3.8'

services:
  tradoc:
    image: ghcr.io/lucas-lepajollec/tradoc:latest
    container_name: tradoc-server
    restart: unless-stopped
    ports:
      - "2507:8000"
    environment:
      - ENV=production
      - DATA_DIR=/app/data
      - APP_SECRET=  # Optionnel: définissez un jeton d'accès pour sécuriser l'API
      - ALLOWED_ORIGINS=*  # Domaines autorisés pour CORS (ex: http://localhost:2507,http://192.168.1.50:2507)
      - LLM_ENDPOINT=http://192.168.x.x:1234/v1  # IP de votre serveur GPU local
      - LLM_API_KEY=lm-studio
      - LLM_MODEL=qwen3.5-instruct
      - API_TYPE=openai
      - CHUNK_TOKEN_SIZE=1000
      - TEMPERATURE=0.15
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/models"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Lancez la stack :
```bash
docker compose up -d
```
*L'application est accessible sur : `http://<IP_DE_VOTRE_NAS>:2507`.*

---

## 🔒 Sécurité & Bonnes Pratiques

> [!WARNING]
> **Réseau & Exposition Portainer** : Ne jamais exposer directement le port de votre serveur d'inférence GPU ni l'instance TraDoc au web public sans authentification préalable ou reverse proxy sécurisé (Nginx, Traefik, Caddy avec SSL/TLS).

- **Persistance des Données** : Assurez-vous d'inclure le volume `./data` dans vos sauvegardes régulières (contient la base SQLite `tradoc.db` et vos livres traduits).
- **Inférence Parallèle LM Studio** : Pour activer la vraie concurrence parallèle avec 4 requêtes simultanées, assurez-vous d'augmenter le réglage `Max Concurrent Requests` dans l'onglet **Local Server** de LM Studio.

---

## 📂 Project Structure

```text
tradoc/
├── .github/                  # Templates d'issues, PR & GitHub Actions CI/CD
│   ├── ISSUE_TEMPLATE/       # Templates bug_report.md & feature_request.md
│   └── workflows/            # Workflow d'intégration continue Docker ghcr.io
├── core/                     # Moteur backend de traduction & parsers
│   ├── config.py             # Configuration Pydantic & variables d'environnement
│   ├── parser_epub.py        # Extracteur/Reconstructeur EPUB conservant HTML/CSS
│   ├── parser_pdf.py         # Parseur PDF & convertisseur EPUB
│   ├── chunker.py            # Chunker sémantique par fenêtre de tokens
│   ├── cleaner.py            # Nettoyeur générique de balises <think>
│   ├── checkpoint.py         # Moteur SQLite WAL de suivi d'état des jobs
│   ├── llm_client.py         # Client HTTP async avec gestion ProviderDownError
│   ├── glossary.py           # Gestionnaire de glossaires & injection de termes
│   └── engine.py             # Orchestrateur parallèle asynchrone avec Sémaphore
├── api/                      # Serveur Web FastAPI & API REST
│   ├── app.py                # Serveur FastAPI & routage SPA React static
│   └── routes.py             # Endpoints REST (jobs, settings, SSE, models, config)
├── web/                      # Interface Web React + Vite (Design Glassmorphic Dark)
│   ├── src/                  # Composants React (Dashboard, Inspector, Settings, Glossary)
│   └── public/               # Logos vectoriels & favicon SVG
├── cli.py                    # Interface ligne de commande (Rich & Typer)
├── main.py                   # Entrypoint CLI & Serveur Web
├── Dockerfile                # Dockerfile multi-stage (Node 22 + Python 3.11)
├── docker-compose.yml        # Orchestration Docker de production
├── .env.example              # Modèle de variables d'environnement
└── requirements.txt          # Dépendances Python
```

---

## 🤝 Contributing

Les contributions sont les bienvenues ! Consultez notre [Guide de Contribution](CONTRIBUTING.md) pour en savoir plus sur les règles de dev et le format des commits, ainsi que notre [Code de Conduite](CODE_OF_CONDUCT.md).

---

<div align="center">
  Développé avec ❤️ par <a href="https://github.com/lucas-lepajollec">Lucas Lepajollec</a>
</div>
