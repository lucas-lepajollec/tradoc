# Commandes TraDoc

Ce guide complète le README avec les commandes utiles au développement et à
l'exploitation. Toutes les commandes sont à lancer depuis la racine du dépôt,
sauf indication contraire.

## Développement local

Installation initiale sous Windows :

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Set-Location web
npm ci
Set-Location ..
```

Lancement quotidien, limité à la machine locale :

```powershell
.\.venv\Scripts\python.exe main.py dev
```

Options utiles :

```powershell
.\.venv\Scripts\python.exe main.py dev --api-port 8001 --web-port 2500
.\.venv\Scripts\python.exe main.py dev --reload
```

Pour un test depuis un téléphone sur un réseau local de confiance :

```powershell
.\.venv\Scripts\python.exe main.py dev --lan
```

Ce mode est volontairement sans authentification. Pour un réseau partagé,
utilisez le mode sécurisé avec le `APP_SECRET` de `.env`. Copiez le secret sans
l'afficher, collez-le dans **Paramètres > Général > Jeton d'application**, puis
enregistrez :

```powershell
(Get-Content .env | Select-String '^APP_SECRET=').Line.Split('=', 2)[1] | Set-Clipboard
.\.venv\Scripts\python.exe main.py dev --lan-secure
```

Le mode LAN ne doit pas être utilisé sur un réseau public ou non fiable.

## Serveur compilé

Après avoir généré le frontend :

```powershell
Set-Location web
npm run build
Set-Location ..
.\.venv\Scripts\python.exe main.py serve
```

Une écoute autre que localhost exige également un `APP_SECRET` fort :

```powershell
.\.venv\Scripts\python.exe main.py serve --host 0.0.0.0 --port 8000
```

## CLI de traduction

```powershell
.\.venv\Scripts\python.exe main.py translate --input .\livre.epub --model qwen3.5-9b --concurrent 2
.\.venv\Scripts\python.exe main.py status
```

La liste complète des options reste disponible avec :

```powershell
.\.venv\Scripts\python.exe main.py translate --help
```

## Docker

```bash
docker compose up -d --build
docker compose logs -f tradoc
docker compose down
```

L'application utilise `data/tradoc.db`. Le dossier `data/` contient aussi les
documents, sorties, glossaires et identifiants de fournisseurs ; sauvegardez-le
avant toute maintenance.

## Contrôles avant contribution

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Set-Location web
npm run build
npm run test:e2e
```
