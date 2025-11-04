export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <div className="border-l-4 border-red-500 pl-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Politique de Confidentialité</h1>
          <p className="text-sm text-gray-500 mt-1">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        <div className="space-y-8 text-gray-700">
          {/* Résumé */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="font-medium text-blue-900">En bref</p>
            <p className="text-sm text-blue-800 mt-1">
              Nous ne stockons aucune donnée personnelle. Tout est géré localement dans votre navigateur.
            </p>
          </div>

          {/* Données collectées */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">📊 Données collectées</h2>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <div>
                  <p className="font-medium">Informations de profil Google</p>
                  <p className="text-sm text-gray-600">Nom, email, photo de profil (affichage uniquement)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <div>
                  <p className="font-medium">Accès YouTube Data API</p>
                  <p className="text-sm text-gray-600">Lecture et modification de vos playlists YouTube Music</p>
                </div>
              </div>
            </div>
          </section>

          {/* Stockage */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">💾 Stockage des données</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium mb-2">Stockage local uniquement</p>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Tokens d&apos;accès : localStorage (votre navigateur)</li>
                <li>• Session : cookies HTTP-only sécurisés</li>
                <li>• Cache playlists : localStorage (votre navigateur)</li>
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                ⚠️ Aucune donnée n&apos;est stockée sur nos serveurs
              </p>
            </div>
          </section>

          {/* Utilisation */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">🎯 Utilisation des données</h2>
            <p className="text-gray-600">
              Vos données sont utilisées <strong>uniquement</strong> pour :
            </p>
            <ul className="mt-2 space-y-1 text-gray-600">
              <li>• Afficher vos playlists YouTube Music</li>
              <li>• Effectuer les actions que vous demandez (ajouter/supprimer des morceaux)</li>
              <li>• Maintenir votre session de connexion</li>
            </ul>
          </section>

          {/* Partage */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">🔒 Partage des données</h2>
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="font-medium text-red-900">Nous ne partageons jamais vos données</p>
              <p className="text-sm text-red-800 mt-1">
                Vos informations ne sont jamais vendues, louées ou partagées avec des tiers.
              </p>
            </div>
          </section>

          {/* Vos droits */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">⚖️ Vos droits</h2>
            <div className="grid gap-3">
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="font-medium">Suppression</p>
                <p className="text-sm text-gray-600">Déconnectez-vous pour supprimer toutes vos données locales</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="font-medium">Révocation</p>
                <p className="text-sm text-gray-600">
                  Révoquez l&apos;accès depuis{' '}
                  <a href="https://myaccount.google.com/permissions" className="text-blue-600 hover:underline" target="_blank" rel="noopener">
                    Google Account Permissions
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="border-t pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">📧 Contact</h2>
            <p className="text-gray-600">
              Questions sur cette politique ?{' '}
              <a href="mailto:alexis.laporte@gmail.com" className="text-blue-600 hover:underline">
                alexis.laporte@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
