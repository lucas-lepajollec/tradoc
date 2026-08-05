# 📜 TraDoc Changelog

Toutes les modifications notables apportées au projet TraDoc sont documentées dans ce fichier.

---

## 🚀 [v1.1.0] - 2026-08-05

### 🎨 Refonte Interface Web (UI / UX)
- **Design Glassmorphic Sombre Moderne** : Palette de couleurs soignée, cartes floutées, bordures lumineuses et typographie littéraire.
- **Tiroir Navigation Mobile (Burger Menu)** : Layout réactif fluide adapté aux mobiles et tablettes avec tiroir de navigation glissant.
- **Réactivité Optimiste (0 ms)** : Mises à jour instantanées de l'état de l'interface utilisateur pour toutes les actions (démarrage, pause, suppression, configuration).
- **Système de Presets Dynamique** : Sélection et gestion des presets de configuration avec mode `-- Aucun preset --` par défaut et détection automatique des correspondances.
- **Synchronisation du Modèle en Temps Réel** : Choix du modèle synchronisé instantanément entre la barre latérale, le tableau de bord, les paramètres et l'inspecteur.

### 📚 Moteur de Traduction Universel Multi-Formats
- **Prise en Charge des Formats** :
  - `EPUB` (Livre numérique avec préservation complète du HTML/CSS et des images)
  - `PDF` (Extraction de blocs de texte et export automatique en livre numérique EPUB réajustable)
  - `DOCX` (Microsoft Word avec conservation des balises de style `<b>`, `<i>`, titres)
  - `MD` (Markdown)
  - `TXT` (Texte brut)
- **Parsers Dédiés** : Moteurs d'extraction et de reconstruction distincts pour chaque type de document (`EpubParser`, `PdfParser`, `DocxParser`, `TextParser`).

### ⚙️ Mémoire des Providers & Isolation par Projet
- **Stockage Mémoire par Provider** : Conservation séparée des clés d'API, endpoints, modèles et niveaux de concurrence pour chaque provider (OpenAI, DeepSeek, Claude, Gemini, LM Studio, Ollama, Minimax, Kimi, GLM).
- **Isolation des Modèles par Projet (`job.model`)** : Modèle dédié verrouillé en base SQLite pour chaque livre, permettant d'exécuter plusieurs traductions simultanées avec des modèles différents sans interférence.
- **Édition Inline dans l'Inspecteur (`Modifier la config ➔`)** : Modification des paramètres à la volée pour les projets en pause avec un bouton d'action rapide `⚡ Appliquer la config active du Dashboard`.

### 🛡️ Robustesse Backend & Calcul Anti-Débordement
- **Calcul Proportionnel de Context Tokens (`max_tokens`)** : Correction de l'erreur LM Studio HTTP 400 `Context size has been exceeded` par un calcul adaptatif proportionnel aux tokens d'entrée.
- **Détection des Modèles Locaux (`fetch_models`)** : Support multi-endpoints (`/v1/models`, `/models`, `/api/tags`) sans écraser les URLs `localhost` / IP privées.
- **Nettoyage Générique des Balises Réflexives (`<think>`)** : Suppression automatique du bavardage interne pour les modèles de raisonnement (Qwen 3.5, DeepSeek R1, Gemma 4).

### 🐳 Déploiement Docker & Sécurité
- **Docker Compose Sécurisé** : Support natif des variables `APP_SECRET` (jeton secret d'authentification) et `ALLOWED_ORIGINS` (CORS).
- **CI/CD GitHub Actions Optimisé** : Publication automatique des conteneurs sur `ghcr.io/lucas-lepajollec/tradoc:latest`.

---

## 📦 [v1.0.0] - 2026-07-25

- Lancement initial de TraDoc.
- Moteur de traduction EPUB asynchrone avec découpage sémantique par fenêtres de tokens.
- Résilience SQLite WAL avec suivi d'état des jobs et reprise instantanée au segment près.
- Client HTTP async compatible OpenAI API.
- Gestionnaire de glossaires littéraires.
