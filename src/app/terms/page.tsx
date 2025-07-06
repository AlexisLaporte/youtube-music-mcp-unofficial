export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Conditions d&apos;Utilisation</h1>
        <div className="prose prose-slate max-w-none">
          <p className="text-slate-600 mb-4">
            En utilisant YouTube Music Manager, vous acceptez les conditions suivantes :
          </p>
          <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-4">Service fourni</h2>
          <p className="text-slate-600 mb-4">
            YouTube Music Manager est un outil de gestion de playlists YouTube Music qui utilise l&apos;API officielle de YouTube.
          </p>
          <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-4">Responsabilités</h2>
          <ul className="text-slate-600 space-y-2">
            <li>• Vous êtes responsable de l&apos;utilisation de votre compte</li>
            <li>• Nous ne sommes pas responsables de la perte de données YouTube</li>
            <li>• L&apos;utilisation doit respecter les conditions de service de YouTube</li>
          </ul>
          <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-4">Limitation de responsabilité</h2>
          <p className="text-slate-600 mb-4">
            Le service est fourni &quot;en l&apos;état&quot; sans garanties explicites ou implicites.
          </p>
          <h2 className="text-xl font-semibold text-slate-900 mt-6 mb-4">Contact</h2>
          <p className="text-slate-600">
            Pour toute question : alexis.laporte@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
}