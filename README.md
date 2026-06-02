# Slidev Workspace

Interface web unifiée pour gérer et consulter toutes vos présentations [Slidev](https://sli.dev), déployée via Docker et auto-synchronisée depuis un dépôt GitHub.

> Fork de [leochiu-a/slidev-workspace](https://github.com/leochiu-a/slidev-workspace) avec support Docker, recherche plein-texte, tags, mode présentateur et export PDF/PPTX.

## Fonctionnalités

- **Indexation automatique** — découverte récursive de toutes les présentations dans le repo
- **Recherche plein-texte** — recherche dans les titres, descriptions, auteurs et contenu markdown
- **Tags & filtres** — ajoutez des tags dans le frontmatter de vos slides, filtrez par tag dans la sidebar
- **Mode présentateur** — bouton dédié sur chaque carte pour ouvrir la vue présentateur Slidev
- **Export PDF/PPTX** — génération automatique au démarrage, téléchargement depuis l'interface
- **Synchronisation GitHub** — `git pull` toutes les 30 secondes, rebuild incrémental des slides modifiées
- **Reverse proxy ready** — `BASE_URL` configurable pour un déploiement derrière Nginx/Traefik

---

## Déploiement rapide

### 1. Copier le fichier de configuration

```bash
cp .env.example .env
```

Renseigner les variables dans `.env` :

```env
GITHUB_REPO=votre-username/votre-repo-slides
GITHUB_PATH=                          # sous-dossier optionnel dans le repo
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxx   # token PAT avec accès lecture repo
BASE_URL=/                            # / en accès direct, /slides/ derrière un proxy
SLIDES_TITLE=Mes Présentations
```

### 2. Lancer le container

```bash
docker compose up -d
```

L'interface est disponible sur **http://localhost:8084**.

Au premier démarrage, le container :

1. Clone votre repo de slides
2. Installe les dépendances de chaque présentation
3. Build toutes les slides en statique
4. Génère les exports PDF/PPTX
5. Démarre Nginx sur le port 8084

> Le premier démarrage peut prendre plusieurs minutes selon le nombre de slides.

---

## Structure attendue du repo de slides

Chaque présentation doit être un projet Slidev indépendant dans son propre dossier :

```
mon-repo-slides/
├── presentation-1/
│   ├── slides.md
│   ├── package.json       # doit avoir un script "build": "slidev build"
│   └── ...
├── presentation-2/
│   ├── slides.md
│   ├── package.json
│   └── ...
└── ...
```

### Ajouter des tags à une présentation

Dans le frontmatter de `slides.md` :

```yaml
---
title: Ma Présentation
author: Lucas Joblin
date: 2025-06-01
tags:
  - frontend
  - architecture
  - design
---
```

---

## Variables d'environnement

| Variable       | Requis | Défaut              | Description                          |
| -------------- | ------ | ------------------- | ------------------------------------ |
| `GITHUB_REPO`  | ✅     | —                   | Repo GitHub (`username/repo`)        |
| `GITHUB_PAT`   | ✅     | —                   | Personal Access Token (scope `repo`) |
| `GITHUB_PATH`  | ❌     | racine              | Sous-dossier dans le repo            |
| `BASE_URL`     | ❌     | `/`                 | Chemin de base (ex: `/slides/`)      |
| `SLIDES_TITLE` | ❌     | `Mes Présentations` | Titre affiché dans la sidebar        |

---

## Déploiement derrière un reverse proxy

Définir `BASE_URL=/slides/` dans `.env` (ou directement dans le `docker-compose.yml` sur Portainer).

Exemple de configuration Nginx côté hôte :

```nginx
location /slides/ {
    proxy_pass http://localhost:8084/slides/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Aucune configuration supplémentaire n'est nécessaire dans le container — Nginx est déjà configuré pour le sous-chemin.

---

## Image Docker

L'image est publiée automatiquement sur GitHub Container Registry à chaque push sur `main` ou `dev` :

```
ghcr.io/joblinours/slidev-workspace:latest   # branche main
ghcr.io/joblinours/slidev-workspace:dev      # branche dev
ghcr.io/joblinours/slidev-workspace:sha-abc123
```

Pour forcer le pull de la dernière version :

```bash
docker compose pull && docker compose up -d
```

---

## Développement local

```bash
# Installer les dépendances
pnpm install

# Builder le package
pnpm build

# Lancer les tests
pnpm test
```

---

## Licence

MIT — basé sur [leochiu-a/slidev-workspace](https://github.com/leochiu-a/slidev-workspace)
