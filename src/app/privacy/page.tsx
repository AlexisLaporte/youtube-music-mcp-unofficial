export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Politique de Confidentialité</h1>
        <div className="prose prose-slate max-w-none">
          <p className="text-slate-600 mb-4">
            Chez YouTube Music Manager, nous respectons votre vie privée et nous nous engageons à protéger vos données personnelles.
          </p>
          <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-4">Données collectées</h2>
          <ul className="text-slate-600 space-y-2">
            <li>• Informations de votre compte Google (nom, email, photo de profil)</li>
            <li>• Accès en lecture à vos playlists YouTube Music</li>
            <li>• Permissions de modification de vos playlists</li>
          </ul>
          <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-4">Utilisation des données</h2>
          <p className="text-slate-600 mb-4">
            Nous utilisons vos données uniquement pour vous fournir nos services de gestion de playlists YouTube Music.
          </p>
          <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-4">Contact</h2>
          <p className="text-slate-600">
            Pour toute question concernant cette politique : alexis.laporte@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
}