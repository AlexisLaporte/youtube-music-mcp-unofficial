# ytmusic-manager

Gestionnaire de playlists YouTube Music avec enrichissement Last.fm.

## Stack

- **Frontend**: Next.js 15, React 19, Tailwind, Zustand
- **Backend**: Next.js API routes, PostgreSQL (lib/pg.ts)
- **Enrichissement**: Last.fm tags uniquement (pas d'analyse audio)

## Architecture

```
src/
├── app/api/
│   ├── sync/cron/      # Jobs planifiés (sync, enrich, reco)
│   ├── recommendations/ # Recos basées sur tags Last.fm
│   ├── suggestions/    # YouTube Mix + Last.fm similar
│   └── track/[videoId]/metadata/  # Tags d'un track
├── services/
│   ├── syncService.ts        # Sync YT → PostgreSQL
│   ├── enrichmentService.ts  # Last.fm tags
│   └── recommendationService.ts  # Scoring par tags (100%)
├── lib/pg.ts           # PostgreSQL client
└── instrumentation.ts  # Scheduler (sync hourly, enrich 15min)
```

## Scheduler

Activé via `ENABLE_SYNC=true`. Jobs :
- **sync** : hourly - sync playlists/liked depuis YouTube
- **enrich** : 15min - batch 20 tracks → Last.fm tags
- **reco** : daily - calcul recommendations

## Développement

- Logs serveur : `tail -f dev/dev.log`
- Ne jamais démarrer le serveur (tourne déjà)
- Ne pas build, utiliser `tsc` pour vérifier
- APIs RESTful, pages auth avec `PageWithSidebar`

## Déploiement (tuls.me)

```bash
ssh -i ~/.ssh/alexis root@51.15.225.121
cd /opt/ytmusic-manager
git pull && npm install && npm run build
# restart via pm2 ou systemctl
```

## Documentation

- **In-code** : header JSDoc sur modules clés
- **User FAQ** : `featureMeta` exporté, agrégé dans `/help`
- Pages Next.js : `meta.ts` à côté
