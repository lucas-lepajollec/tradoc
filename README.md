<div align="center">

<img src="web/public/logo.svg" width="128" height="128" alt="TraDoc Logo" />

# 📚 TraDoc — Traducteur Littéraire IA Haute Performance

![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![React](https://img.shields.io/badge/react-18.2-61dafb.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688.svg)
![Docker](https://img.shields.io/badge/docker-ready-0db7ed.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**TraDoc** est une suite logicielle complète et autonome de traduction littéraire de livres (**EPUB & PDF**). Designed for local NAS deployment with remote GPU LLM inference (LM Studio, Ollama, vLLM, OpenAI spec).

[Fonctionnalités](#-fonctionnalités-clés) • [Architecture](#-architecture-du-système) • [Installation & Docker](#-déploiement-docker-nas-portainer--linux) • [Guide Mobile](#-accès-mobile--réseau-local)

</div>

---

## 🌟 Fonctionnalités Clés

- 📖 **Préservation Intégrale de la Structure & CSS (EPUB & PDF)** :
  - **EPUB** : Conservation stricte de l'arborescence HTML/XML, des feuilles de style CSS, des balises d'images, des notes de bas de page et de la table des matières (NCX/NAV).
  - **PDF** : Extraction sémantique intelligente et recomposition propre sous forme d'EPUB ré-assemblé.
- 🧩 **Découpage Sémantique par Fenêtres de Tokens (Chunking)** : Regroupement dynamique par blocs de 1 000 tokens pour préserver le ton littéraire, la continuité narrative et la cohérence des pronoms.
- ⚡ **Moteur Concourant `asyncio` + `Semaphore`** : Requêtage GPU parallèle haut débit avec concurrence ajustable à chaud (ex: 1 à 8 requêtes parallèles) sans saturation de mémoire VRAM.
- 💾 **Reprise Automatique & Resynchronisation SQLite** : Sauvegarde d'état segment par segment. En cas d'arrêt ou de redémarrage du serveur, le traitement reprend à l'index exact.
- 🧹 **Nettoyage Générique des Balises Réflexives (`<think>`)** : Détection et élimination automatique des blocs de réflexion des modèles récents (Qwen 3.5/3.6, Gemma 4, DeepSeek R1).
- 🏷️ **Gestionnaire de Glossaires Littéraires** : Support de glossaires personnalisés (noms propres, lieux, terminologie spécifique, suffixes `-san`/`-kun`) injectés dynamiquement dans le prompt système.
- 📱 **Interface Web 100% Responsive & Tiroir Mobile Burger** :
  - Mode Desktop avec volet fixe à gauche.
  - Mode Mobile avec tiroit de navigation animé (*Slide-over Drawer*), visualiseur côte à côte, saut de segment direct `< N / Total >` et bouton de resynchronisation du suivi live.
- 🎛️ **Mise à Jour des Paramètres à Chaud** : Modification en cours de traduction de la température, du modèle LLM et du niveau de concurrence sans interrompre la tâche.

---

## 🏗️ Architecture du Système

```text
tradoc/
├── core/
│   ├── config.py             # Configuration Pydantic & variables d'environnement
│   ├── parser_epub.py        # Extracteur/Reconstructeur EPUB conservant HTML/CSS
│   ├── parser_pdf.py         # Parseur PDF & convertisseur EPUB
│   ├── chunker.py            # Chunker sémantique par fenêtre de tokens
│   ├── cleaner.py            # Nettoyeur générique de balises <think>
│   ├── checkpoint.py         # Moteur SQLite de suivi d'état des jobs & segments
│   ├── llm_client.py         # Client HTTP async (httpx) avec support OpenAI/Ollama
│   ├── glossary.py           # Gestionnaire de glossaires & injection de termes
│   └── engine.py             # Orchestrator parallèle avec Semaphore & live tuning
├── api/
│   ├── app.py                # Serveur FastAPI & routage SPA React static
│   └── routes.py             # Endpoints REST (jobs, settings, SSE, models, config)
├── web/                      # Interface Web React + Vite (Design Glassmorphic Dark)
│   ├── src/
│   │   ├── components/       # Dashboard, JobsInspector, Settings, GlossaryManager
│   │   ├── App.jsx           # App shell avec tiroir mobile burger responsive
│   │   └── api.js            # Client API REST & SSE
│   ├── index.html
│   └── vite.config.js        # Config Vite (Host 0.0.0.0, Port 2499)
├── cli.py                    # Interface ligne de commande (Rich & Typer)
├── main.py                   # Serveur Web & CLI Entrypoint
├── Dockerfile                # Dockerfile multi-stage (Node 20 + Python 3.11)
├── docker-compose.yml        # Orchestration Docker pour NAS
├── .env.example              # Modèle de variables d'environnement
└── requirements.txt          # Dépendances Python
```

---

## 🚀 Déploiement Docker (NAS, Portainer & Linux)

Le moyen le plus simple et rapide de déployer **TraDoc** sur votre NAS (Synology, QNAP, Unraid, OpenMediaVault) ou serveur Linux est d'utiliser Docker Compose avec l'image officielle.

### 1. Créez votre fichier `docker-compose.yml` :

Copiez-collez le bloc suivant directement dans votre gestionnaire de stack (Portainer) ou dans un fichier `docker-compose.yml` sur votre serveur :

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
      - LLM_ENDPOINT=http://192.168.x.x:1234/v1  # IP de votre serveur GPU local
      - LLM_API_KEY=lm-studio
      - LLM_MODEL=qwen3.5-9b
      - API_TYPE=openai
      - CONCURRENCY=1
      - CHUNK_TOKEN_SIZE=1000
      - TEMPERATURE=1.50
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/models"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 2. Lancez la stack :

```bash
docker compose up -d
```

### 3. Accédez à l'application :

Ouvrez votre navigateur sur : **`http://<IP_DE_VOTRE_NAS>:2507`**.

---

### Option 2 : Mode Développement Local (Windows / Mac / Linux)

1. **Installer les dépendances Python** :
   ```bash
   pip install -r requirements.txt
   ```

2. **Démarrer le backend FastAPI (Terminal 1)** :
   ```bash
   python main.py serve --host 0.0.0.0 --port 8000 --reload
   ```

3. **Démarrer le frontend React (Terminal 2)** :
   ```bash
   cd web
   npm install
   npm run dev
   ```
   L'interface web est immédiatement accessible sur **`http://localhost:2499/`**.

---

## 📱 Accès Mobile & Réseau Local

TraDoc écoute sur `0.0.0.0:2499` en mode développement Vite et sur le port `2507` en mode Docker production.

* **Depuis votre smartphone / tablette en Wi-Fi :**
  Accédez directement à **`http://<IP_DE_VOTRE_PC>:2499/`** *(ex: 192.168.x.x)*.
* **Via VPN / Tailscale (4G / 5G / Réseau distant) :**
  Accédez à **`http://<IP_TAILSCALE_OU_VPN>:2499/`**.

---

## ⚙️ Variables d'Environnement

| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `ENV` | Environnement d'exécution (`development` / `production`) | `production` |
| `DATA_DIR` | Répertoire de stockage SQLite et des fichiers importés | `./data` |
| `LLM_ENDPOINT` | URL de l'API OpenAI / LM Studio / Ollama distant | `http://192.168.x.x:1234/v1` |
| `LLM_MODEL` | Modèle LLM par défaut | `qwen3.5-9b` |
| `CONCURRENCY` | Nombre de requêtes d'inférence parallèles | `1` |
| `CHUNK_TOKEN_SIZE` | Taille de la fenêtre sémantique (tokens) | `1000` |
| `TEMPERATURE` | Température d'échantillonnage LLM | `1.50` |

---

## 📄 Licence & Contribution

Projet distribué sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails. Les contributions sont les bienvenues via les guidelines présentées dans [CONTRIBUTING.md](CONTRIBUTING.md).
