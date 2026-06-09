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
- `site/` — vitrine statique Vue 3 + Vite (design "Musical Bold", one-page dark), prod `ytmusic.tuls.me`
  - tokens/styles globaux : `src/assets/main.css` ; un composant par section ; URL repo + commande
    setup centralisées dans `src/site.ts`

## Conventions

- L'auth (headers browser) ne transite JAMAIS par une conversation LLM : capture via
  `ytmusic-manager setup` en terminal.
- Tools destructifs : garde `confirm` + instructions serveur (confirmation utilisateur).
- Écritures batchées (un `add_tracks` multi-ids), throttle 0,5 s sur like/unlike.
- Le skill local `~/.claude/skills/ytmusic/` (ytm.py) reste l'outil d'Alexis au quotidien ;
  ce repo est le produit public. Même fichier d'auth partagé.
- Site : pas de commande PyPI tant que le package n'est pas publié — install via
  `uvx --from git+<repo>` et renvoi vers GitHub (décision Alexis). Transcript démo = vrais
  noms de tools MCP.

## Dev

- `uv run ytmusic-manager whoami` (depuis la racine) pour smoke-tester.
- Site : `honcho start` (vite sur 5186, https://ytmusic.dev via Caddy local).
- Historique git réécrit le 2026-06-09 par précaution avant l'open source ; l'audit a
  ensuite montré qu'aucun secret réel n'avait jamais été commité (seul `.env.local.example`).
  Archive : `/data/projects/.archive/ytmusic-manager-nextjs-2026-06-09.bundle`.
- Repo **PUBLIC depuis le 2026-06-10** (audit secrets OK, branche `vercel/*` legacy supprimée).
  L'IP origin du serveur ne doit jamais apparaître dans le repo (tuls.me est derrière le
  proxy CF) → elle vit dans le secret GitHub `DEPLOY_HOST`.
- Repo GitHub renommé `AlexisLaporte/youtube-music-mcp-unofficial` (2026-06-10) ; le package,
  la CLI et ce dossier local gardent le nom `ytmusic-manager`.

## Prod

- `ytmusic.tuls.me` : site statique servi par Caddy sur tuls.me, deploy GitHub Actions
  (build `site/` → rsync `site/dist/`). Voir `/prod-init`.
- **MCP distant perso** (instance mono-tenant d'Alexis, pour claude.ai) :
  `https://ytmusic.tuls.me/mcp`, service systemd `ytmusic-mcp` port 8096
  (`infra/prod/ytmusic-mcp.service`), transport http + auth Logto (`auth.py`,
  env `MCP_*`), gating par sub (`MCP_ALLOWED_SUBS`). Headers YT :
  `/opt/ytmusic-manager/browser.json` (+ copie SOPS `projects/ytmusic.yaml`,
  avec client_id SPA claude.ai `7bnswcaxvrpyevah3qn5t`). Déploiement code MCP :
  rsync `pyproject.toml src` → `/opt/ytmusic-manager/` + `.venv/bin/pip install .`
  + `systemctl restart ytmusic-mcp` (pas couvert par la CI, qui ne déploie que le site).
