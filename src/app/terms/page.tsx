export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Terms of Service</h1>

        <div className="space-y-6 text-gray-700 dark:text-slate-300 text-sm">
          <section>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">What this is</h2>
            <p>A personal tool to manage YouTube Music playlists. Free, no ads, no tracking.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Requirements</h2>
            <ul className="space-y-1">
              <li>Valid Google account with YouTube access</li>
              <li>You authorize this app to manage your playlists</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Limitations</h2>
            <ul className="space-y-1">
              <li>Service provided as-is, no guarantees</li>
              <li>Subject to YouTube API quotas</li>
              <li>May change or shutdown without notice</li>
              <li>Not liable for data loss</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Your responsibility</h2>
            <ul className="space-y-1">
              <li>Keep your Google account secure</li>
              <li>Comply with <a href="https://www.youtube.com/t/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener">YouTube Terms</a></li>
            </ul>
          </section>

          <p className="text-gray-500 dark:text-slate-400 pt-4 border-t border-gray-200 dark:border-slate-700">
            Contact: alexis.laporte@gmail.com
          </p>
        </div>
      </div>
    </div>
  )
}
