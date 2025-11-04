# Setup Guide - YouTube Music Manager

## Architecture

Cette app utilise **localStorage + cookies HTTP-only** pour les sessions, sans base de données.

## Configuration requise

### 1. Variables d'environnement

Copier `.env.local.example` vers `.env.local` et remplir les valeurs :

```bash
cp .env.local.example .env.local
```

### 2. OAuth Google

1. Aller sur https://console.cloud.google.com/apis/credentials
2. Créer un nouveau projet (ou utiliser existant)
3. Activer "YouTube Data API v3"
4. Créer des credentials OAuth 2.0:
   - Type: Application Web
   - Nom: YouTube Music Manager
   - URIs de redirection autorisés:
     - `http://localhost:3000/api/auth/callback` (dev)
     - `https://votre-domaine.vercel.app/api/auth/callback` (prod)
   - Scopes requis:
     - `https://www.googleapis.com/auth/youtube.readonly`
     - `https://www.googleapis.com/auth/youtube`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`

5. Copier Client ID et Client Secret dans `.env.local`

### 3. Session Secret

Générer une clé secrète:

```bash
openssl rand -base64 32
```

Copier dans `.env.local` → `SESSION_SECRET`

## Développement

```bash
npm install
npm run dev
```

L'app sera disponible sur http://localhost:3000

## Déploiement sur Vercel

1. Connecter le repo GitHub sur Vercel
2. Ajouter les variables d'environnement dans Vercel:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - `SESSION_SECRET`
   - `NEXT_PUBLIC_SITE_URL` (votre domaine Vercel)
3. Déployer !

## Architecture

- **Auth**: OAuth Google → JWT sessions (cookies HTTP-only)
- **Data**: YouTube Data API v3 (pas de base de données)
- **Cache**: localStorage côté client
- **State**: Zustand stores (auth, playlists, UI)

Pas besoin de base de données - tout est géré côté client avec localStorage et cookies sécurisés.
