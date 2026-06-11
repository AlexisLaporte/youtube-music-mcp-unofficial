# ytmusic-manager

MCP server YouTube Music open source. Deux modes, **même package** :
- **stdio local-first** (plugin Claude Code) : le serveur tourne chez l'utilisateur,
  l'auth ytmusicapi reste sur sa machine (`browser.json`). Mode recommandé "zero trust".
- **hébergé multi-tenant** : un service distant (code dans le repo privé `ytmusic-site`,
  `server/`) injecte un `CredentialsProvider` DB par utilisateur (JWT sub) et un `Repo`
  (historique). Sessions YT stockées chiffrées côté serveur — compromis assumé, mode opt-in.

## Structure

- `.claude-plugin/` — manifest **plugin Claude Code** (plugin.json embarque le serveur MCP
  via uvx git+ ; marketplace.json = le repo est sa propre marketplace `ytmusic`).
  Install : `/plugin marketplace add AlexisLaporte/youtube-music-mcp-unofficial` puis
  `/plugin install ytmusic-manager@ytmusic`.
- `skills/ytmusic/SKILL.md` — skill public (méthodo de rangement sur les tools MCP,
  générique). Version perso avec IDs/règles d'Alexis : `~/.claude/skills/ytmusic/`
  (ytm.py CLI, hors repo) — porter manuellement les leçons généralisables de l'un à l'autre.
- `src/ytmusic_mcp/` — package Python (FastMCP v3 + ytmusicapi)
  - `server.py` — **factory `build_mcp(auth, provider, repo)`** (le transport est choisi
    par l'appelant, plus de switch à l'import) + instructions de garde-fous.
  - `ytclient.py` — helpers ytmusicapi (`build_yt(auth_json_str)`, slim_*), zéro accès disque.
  - `credentials.py` — `CredentialsProvider` (Protocol) + `LocalFileProvider` (browser.json) ;
    erreurs typées (`NotConnectedError`, `CredentialsInvalidError`).
  - `usercontext.py` — `current_sub()` (JWT sub via `get_access_token`, None en stdio).
  - `tools/` — `library.py` (lectures, param `cached=`), `mutate.py` (écritures + write-through
    quand DB), `history.py` (`sync`, `recent_likes`, `library_changes`,
    `mark_unfileable`/`unmark_unfileable`/`list_unfileable` — flags `filing_skips`, si DB).
  - `db/` (models SQLAlchemy 2, repo — schéma `ytm` sur Postgres) + `sync/` (`diff.py` pur +
    `engine.py`) : extra optionnel `[server]`. SQLite (local) ou Postgres (hébergé), même code.
  - `mcp_app.py` — MCP App `library_app` (dashboard rendu prefab-ui) : extra `[app]`, gracieux.
  - `cli.py` — `ytmusic-manager` : sans arg = stdio ; `setup` = wizard auth ; `whoami` ;
    `db-init`. `DATABASE_URL` active l'historique sur `serve`.

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
