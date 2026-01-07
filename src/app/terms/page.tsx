'use client'

import { OptionalSidebarLayout } from '@/components/layout/OptionalSidebarLayout'

export default function TermsPage() {
  return (
    <OptionalSidebarLayout>
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8">
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
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Audio Analysis</h2>
            <p className="mb-2">This service uses yt-dlp to temporarily download audio for analysis purposes only (BPM, key detection). Audio files are:</p>
            <ul className="space-y-1">
              <li>Downloaded temporarily for analysis</li>
              <li>Deleted immediately after processing</li>
              <li>Never stored or redistributed</li>
              <li>Used solely to improve music recommendations</li>
            </ul>
            <p className="mt-2 text-gray-500 dark:text-slate-400">This feature is for personal use only and does not replace YouTube Music streaming.</p>
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
    </OptionalSidebarLayout>
  )
}
