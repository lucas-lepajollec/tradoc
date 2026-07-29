# 🤝 Contribution à TraDoc

Merci pour votre intérêt envers **TraDoc** ! Ce projet a pour objectif d'offrir la solution de traduction littéraire IA autonome la plus puissante, élégante et rapide.

---

## 🚀 Comment contribuer

1. **Forker le dépôt** sur votre compte GitHub.
2. **Créer une branche de fonctionnalité** (`git checkout -b feature/ma-super-feature`).
3. **Appliquer vos modifications** et s'assurer de respecter les règles de style :
   - Python : Suivre PEP 8 avec `black` / `flake8`.
   - Frontend React : Tailwind CSS, composants légers et modulaires.
4. **Tester les modifications** localement :
   - Backend FastAPI : `python main.py serve --reload`
   - Frontend Vite : `cd web && npm run dev`
5. **Commiter avec un message clair** (`git commit -m 'feat: ajout du support du format FB2'`).
6. **Pousser la branche** (`git push origin feature/ma-super-feature`).
7. **Ouvrir une Pull Request** détaillée vers la branche `main`.

---

## 🏗️ Architecture du Code

- **`core/parser_epub.py`** : Découpage et ré-injection HTML/XML sans altérer la structure ni les styles CSS.
- **`core/chunker.py`** : Regroupement par fenêtres sémantiques de tokens.
- **`core/cleaner.py`** : Post-traitement générique (nettoyage des balises `<think>` des modèles raisonnants).
- **`core/checkpoint.py`** : Persistance SQLite pour les reprises automatiques et la résilience.
- **`core/engine.py`** : Orchestration asynchrone multithreadée / concourante par sémaphore.
- **`web/src/`** : Interface utilisateur React 18 + Vite responsive (Mobile & Desktop).

---

## 🐞 Rapporter un Bug ou Suggérer une Fonctionnalité

Merci de créer une **Issue** GitHub en précisant :
- Votre environnement (Linux, Docker, Windows, version de Python).
- Le modèle LLM utilisé (ex: `Qwen 3.5 9B`, `TranslateGemma`).
- Les logs complets ou la capture d'écran du problème.
