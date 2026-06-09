# ytmusic-manager

MCP server YouTube Music open source (modèle "B") : le serveur tourne **chez l'utilisateur**
(stdio), l'auth ytmusicapi reste sur sa machine. Pas de version hébergée multi-comptes
(stockage de sessions Google de tiers = non).

## Structure

- `src/ytmusic_mcp/` — package Python (FastMCP v2 + ytmusicapi)
  - `client.py` — accès YT Music, auth `~/.config/ytmusic/browser.json`
  - `server.py` — tools MCP (instructions de garde-fous dans le constructeur FastMCP)
  - `cli.py` — entrée `ytmusic-manager` : sans arg = serveur stdio ; `setup` = wizard auth ; `whoami`
- `site/` — vitrine statique Vue 3 + Vite (placeholder, design par Alexis), prod `ytmusic.tuls.me`

## Conventions

- L'auth (headers browser) ne transite JAMAIS par une conversation LLM : capture via
  `ytmusic-manager setup` en terminal.
- Tools destructifs : garde `confirm` + instructions serveur (confirmation utilisateur).
- Écritures batchées (un `add_tracks` multi-ids), throttle 0,5 s sur like/unlike.
- Le skill local `~/.claude/skills/ytmusic/` (ytm.py) reste l'outil d'Alexis au quotidien ;
  ce repo est le produit public. Même fichier d'auth partagé.

## Dev

- `uv run ytmusic-manager whoami` (depuis la racine) pour smoke-tester.
- Site : `honcho start` (vite sur 5175, https://ytmusic.dev via Caddy local).
- Historique git réécrit le 2026-06-09 (l'ancien projet Next.js contenait des secrets
  commités) ; archive : `/data/projects/.archive/ytmusic-manager-nextjs-2026-06-09.bundle`.
  Le repo GitHub est PRIVATE tant que la v0 n'est pas propre → passage en public à valider.

## Prod

- `ytmusic.tuls.me` : site statique servi par Caddy sur tuls.me, deploy GitHub Actions
  (build `site/` → rsync `site/dist/`). Voir `/prod-init`.
