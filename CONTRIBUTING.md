# 🤝 Guide de Contribution — TraDoc

Merci de votre intérêt pour la contribution à **TraDoc** ! Ce document décrit les consignes et bonnes pratiques pour soumettre du code, signaler des bugs ou proposer des améliorations.

---

## ⚡ 1. Configuration de l'Environnement Local

### Prérequis
* **Python 3.11+**
* **Node.js 18+** & npm
* **Docker & Docker Compose** *(optionnel, pour les tests en conteneur)*

### Étapes d'installation
```bash
# 1. Cloner le projet
git clone https://github.com/lucas-lepajollec/tradoc.git
cd tradoc

# 2. Créer l'environnement virtuel Python
python -m venv .venv
source .venv/bin/activate      # Linux/macOS
# .\.venv\Scripts\Activate.ps1  # Windows PowerShell

# 3. Installer les dépendances Python
pip install -r requirements.txt

# 4. Installer les dépendances Frontend React
cd web
npm ci
cd ..
```

---

## ✍️ 2. Conventions de Commit (Conventional Commits)

Nous appliquons la norme **Conventional Commits** pour maintenir un historique Git clair et lisible.

### Format
`type: description courte en anglais (minuscules, impératif, pas de point final)`

### Dictionnaire des Types

| Type | Utilisation | Exemple |
| :--- | :--- | :--- |
| `feat:` | Nouvelle fonctionnalité | `feat: add PDF chapter auto-detection` |
| `fix:` | Correction de bug | `fix: resolve SQLite lock on parallel worker runs` |
| `docs:` | Documentation (README, guides) | `docs: update deployment architecture diagram` |
| `chore:` | Configuration / Dépendances | `chore: update react to v18.3` |
| `refactor:` | Réécriture / Optimisation sans changement de comportement | `refactor: extract EPUB parsing logic to helper` |
| `perf:` | Amélioration des performances | `perf: cache glossary lookup queries` |
| `test:` | Tests unitaires / d'intégration | `test: add unit test for html cleaner` |

---

## 🚀 3. Processus de Pull Request (PR)

1. **Forker** le dépôt et créer une branche thématique (`git checkout -b feat/ma-fonctionnalite`).
2. Vérifier qu'aucun secret, jeton d'API ou adresse IP privée (`192.168.x.x`) n'est présent dans le code.
3. Exécuter les tests backend (`python -m unittest discover -s tests -v`) et s'assurer que le frontend compile sans erreurs (`cd web && npm run build`).
4. Commiter vos modifications en suivant les règles **Conventional Commits**.
5. Soumettre une **Pull Request** vers la branche `main`.

---

## 📄 Code de Conduite
En participant à ce projet, vous acceptez de respecter notre [Code de Conduite](CODE_OF_CONDUCT.md).

## Maintainer release process

Releases are deliberate milestones, not snapshots of every merge. Prepare a release pull request that updates the declared version sources, moves completed entries out of `Unreleased` in [CHANGELOG.md](CHANGELOG.md), and documents provider compatibility, migrations, and rollback when relevant. After all required checks pass, tag the exact accepted `main` commit with an annotated `vMAJOR.MINOR.PATCH` tag and push it through the authoritative Forgejo remote. Verify that the identical tag reaches GitHub and that the versioned container finishes successfully before publishing a draft GitHub release. Never move or reuse a published version tag.
