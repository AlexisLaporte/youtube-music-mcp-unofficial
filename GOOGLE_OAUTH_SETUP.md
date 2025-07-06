# Configuration Google OAuth pour Supabase

## URLs à ajouter dans Google Cloud Console

Dans votre projet Google Cloud Console, allez dans :
**APIs & Services > Credentials > OAuth 2.0 Client IDs**

### 1. Origines JavaScript autorisées
Ajoutez ces URLs :
```
http://localhost:3000
https://votre-domaine.com
```

### 2. URI de redirection autorisés
Ajoutez cette URL Supabase Auth :
```
https://ydbbrsxkbakuendojzhn.supabase.co/auth/v1/callback
```

### 3. Configuration OAuth Consent Screen (OBLIGATOIRE)
Pour éviter l'erreur Google, configurez dans Google Cloud Console > OAuth consent screen :
```
Application name: YouTube Music Manager
User support email: alexis.laporte@gmail.com
Developer contact: alexis.laporte@gmail.com
Application homepage: http://localhost:3000 (pour dev)
Privacy Policy: http://localhost:3000/privacy
Terms of Service: http://localhost:3000/terms
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

## Solutions pour éviter l'erreur Google OAuth

### Option 1: Domaine personnalisé (Recommandée)
1. **Supabase Dashboard > Settings > Custom Domains**
2. Ajoutez votre domaine : `auth.votre-domaine.com`
3. Configurez les DNS selon les instructions Supabase
4. Utilisez cette URI dans Google OAuth : 
   ```
   https://auth.votre-domaine.com/auth/v1/callback
   ```

### Option 2: Configuration de branding Google
Dans Google Cloud Console > OAuth consent screen :
1. **Application name** : YouTube Music Manager
2. **User support email** : votre@email.com
3. **Developer contact** : votre@email.com
4. **Application homepage** : https://votre-domaine.com
5. **Privacy Policy** : https://votre-domaine.com/privacy
6. **Terms of Service** : https://votre-domaine.com/terms

### Option 3: Mode développement temporaire
Pour tester pendant le développement :
1. Ajoutez votre email comme "Test user" dans OAuth consent screen
2. Gardez l'application en mode "Testing"
3. Utilisez : `http://localhost:3000` comme origine autorisée

## Important
- Utilisez UNIQUEMENT l'URL Supabase Auth : `/auth/v1/callback`
- Ne pas utiliser les edge functions personnalisées
- Les tokens YouTube seront disponibles dans `user.user_metadata.provider_token`