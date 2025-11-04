export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <div className="border-l-4 border-red-500 pl-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Conditions d&apos;Utilisation</h1>
          <p className="text-sm text-gray-500 mt-1">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        <div className="space-y-8 text-gray-700">
          {/* Résumé */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="font-medium text-blue-900">En bref</p>
            <p className="text-sm text-blue-800 mt-1">
              Outil gratuit de gestion de playlists YouTube Music. Utilisez-le de manière responsable.
            </p>
          </div>

          {/* Service */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">🎵 Service fourni</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-600">
                YouTube Music Manager vous permet de gérer vos playlists YouTube Music via l&apos;API officielle.
              </p>
              <ul className="mt-3 space-y-1 text-sm text-gray-600">
                <li>• Analyse de vos morceaux likés</li>
                <li>• Création et modification de playlists</li>
                <li>• Division et organisation de playlists</li>
              </ul>
            </div>
          </section>

          {/* Responsabilités */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">⚖️ Vos responsabilités</h2>
            <div className="grid gap-3">
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="font-medium">Usage du compte</p>
                <p className="text-sm text-gray-600">Vous êtes responsable de l&apos;utilisation de votre compte Google</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="font-medium">Respect des CGU YouTube</p>
                <p className="text-sm text-gray-600">
                  Consultez les{' '}
                  <a href="https://www.youtube.com/t/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener">
                    conditions de service YouTube
                  </a>
                </p>
              </div>
            </div>
          </section>

          {/* Limitations */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">⚠️ Limitations</h2>
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <p className="font-medium text-yellow-900">Service fourni "en l&apos;état"</p>
              <ul className="text-sm text-yellow-800 mt-2 space-y-1">
                <li>• Aucune garantie de disponibilité</li>
                <li>• Pas de responsabilité en cas de perte de données</li>
                <li>• Service gratuit et bénévole</li>
              </ul>
            </div>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">📝 Modifications</h2>
            <p className="text-gray-600">
              Ces conditions peuvent être modifiées à tout moment. L&apos;utilisation continue du service implique l&apos;acceptation des nouvelles conditions.
            </p>
          </section>

          {/* Contact */}
          <section className="border-t pt-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">📧 Contact</h2>
            <p className="text-gray-600">
              Questions sur ces conditions ?{' '}
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