# YouTube Music Manager

Application Next.js pour gérer vos playlists YouTube Music.

## Configuration

1. **Variables d'environnement** - Créez un fichier `.env.local` :
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

2. **Authentification Google** - Suivez les instructions dans le fichier `GOOGLE_OAUTH_SETUP.md` du projet original.

## Installation

```bash
npm install
```

## Lancement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Fonctionnalités

- Authentification Google via Supabase
- Visualisation des playlists YouTube Music
- Création de nouvelles playlists
- Suppression de playlists
- Recherche et filtrage des playlists
- Interface responsive avec Tailwind CSS

## Structure du projet

- `src/app/` - Pages Next.js
- `src/components/` - Composants React
- `src/services/` - Services API
- `src/types/` - Types TypeScript
- `src/lib/` - Utilitaires (client Supabase)

## Déploiement

Le déploiement se fait facilement sur [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).
