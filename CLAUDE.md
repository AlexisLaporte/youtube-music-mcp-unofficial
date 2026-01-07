- tu peux voir les logs serveur (tail -f dev/dev.log)
- ne démarre jamais le server car il tourne déjà
- ne build jamais, tu peux faire tsc
- les APIs doivent être RESTful
- les pages authentifiées utilisent `PageWithSidebar` (pas de pages standalone)

# Documentation

- **In-code** : header JSDoc sur les modules clés (le "why", pas le "what")
- **User FAQ** : `featureMeta` exporté depuis le composant/page, agrégé dans `/help`
- Pour les pages Next.js : `meta.ts` à côté (pages can't have custom exports)
- Pas de markdown technique séparé