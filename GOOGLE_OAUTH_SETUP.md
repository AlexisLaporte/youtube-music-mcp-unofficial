# Configuration Google OAuth pour Supabase

## URLs à ajouter dans Google Cloud Console

Dans votre projet Google Cloud Console, allez dans :
**APIs & Services > Credentials > OAuth 2.0 Client IDs**

### 1. Origines JavaScript autorisées
Ajoutez ces URLs :
```
http://localhost:5173
https://votre-domaine.com
```

### 2. URI de redirection autorisés
Ajoutez cette URL Supabase Auth :
```
https://ydbbrsxkbakuendojzhn.supabase.co/auth/v1/callback
```

## Configuration Supabase Dashboard

1. Allez dans votre Supabase Dashboard
2. **Settings > Auth > External OAuth Providers**
3. **Activez Google**
4. **Ajoutez votre Client ID et Client Secret Google**
5. **Scopes** : `openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube`

## Vérification
1. Allez sur https://console.cloud.google.com/
2. Sélectionnez votre projet
3. APIs & Services > Credentials
4. Cliquez sur votre OAuth 2.0 Client ID
5. Dans "Authorized redirect URIs", ajoutez :
   `https://ydbbrsxkbakuendojzhn.supabase.co/auth/v1/callback`
6. Sauvegardez

## Important
- Utilisez UNIQUEMENT l'URL Supabase Auth : `/auth/v1/callback`
- Ne pas utiliser les edge functions personnalisées
- Les tokens YouTube seront disponibles dans `user.user_metadata.provider_token`