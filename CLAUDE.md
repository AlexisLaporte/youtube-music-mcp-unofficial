# ytmusic-manager

MCP server YouTube Music open source (modèle "B") : le serveur tourne **chez l'utilisateur**
(stdio), l'auth ytmusicapi reste sur sa machine. Pas de version hébergée multi-comptes
(stockage de sessions Google de tiers = non).

## Structure

- `.claude-plugin/` — manifest **plugin Claude Code** (plugin.json embarque le serveur MCP
  via uvx git+ ; marketplace.json = le repo est sa propre marketplace `ytmusic`).
  Install : `/plugin marketplace add AlexisLaporte/youtube-music-mcp-unofficial` puis
  `/plugin install ytmusic-manager@ytmusic`.
- `skills/ytmusic/SKILL.md` — skill public (méthodo de rangement sur les tools MCP,
  générique). Version perso avec IDs/règles d'Alexis : `~/.claude/skills/ytmusic/`
  (ytm.py CLI, hors repo) — porter manuellement les leçons généralisables de l'un à l'autre.
- `src/ytmusic_mcp/` — package Python (FastMCP v2 + ytmusicapi)
  - `client.py` — accès YT Music, auth `~/.config/ytmusic/browser.json`
  - `server.py` — tools MCP (instructions de garde-fous dans le constructeur FastMCP)
  - `cli.py` — entrée `ytmusic-manager` : sans arg = serveur stdio ; `setup` = wizard auth ; `whoami`

Le site vitrine (`ytmusic.tuls.me`), sa CI de deploy et l'infra perso (instance MCP distante)
sont **hors de ce repo** : repo privé `AlexisLaporte/ytmusic-site`, local `/data/projects/ytmusic-site`.

## Conventions

- L'auth (headers browser) ne transite JAMAIS par une conversation LLM : capture via
  `ytmusic-manager setup` en terminal.
- Tools destructifs : garde `confirm` + instructions serveur (confirmation utilisateur).
- Écritures batchées (un `add_tracks` multi-ids), throttle 0,5 s sur like/unlike.
- Le skill local `~/.claude/skills/ytmusic/` (ytm.py) reste l'outil d'Alexis au quotidien ;
  ce repo est le produit public. Même fichier d'auth partagé.
- Repo **public** : aucune info d'infra perso ici (IP origin, ports, chemins serveur) —
  tout ça vit dans `ytmusic-site` (privé).

## Dev

- `uv run ytmusic-manager whoami` (depuis la racine) pour smoke-tester.
- Historique git réécrit le 2026-06-09 par précaution avant l'open source ; l'audit a
  ensuite montré qu'aucun secret réel n'avait jamais été commité (seul `.env.local.example`).
  Archive : `/data/projects/.archive/ytmusic-manager-nextjs-2026-06-09.bundle`.
- Repo **PUBLIC depuis le 2026-06-10** (audit secrets OK, branche `vercel/*` legacy supprimée).
- Repo GitHub renommé `AlexisLaporte/youtube-music-mcp-unofficial` (2026-06-10) ; le package,
  la CLI et ce dossier local gardent le nom `ytmusic-manager`.
