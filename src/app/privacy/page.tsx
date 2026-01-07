'use client'

import { OptionalSidebarLayout } from '@/components/layout/OptionalSidebarLayout'

export default function PrivacyPage() {
  return (
    <OptionalSidebarLayout>
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Privacy Policy</h1>

        <div className="space-y-6 text-gray-700 dark:text-slate-300 text-sm">
          <section>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">What we access</h2>
            <ul className="space-y-1">
              <li>Your YouTube playlists and liked songs (read/write via YouTube Data API)</li>
              <li>Your Google profile (name, email, photo)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">What we store</h2>
            <ul className="space-y-1">
              <li>Session cookie (encrypted, 7 days)</li>
              <li>Playlist cache in server SQLite (for performance)</li>
              <li>Audio analysis results (BPM, key detection)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">What we dont do</h2>
            <ul className="space-y-1">
              <li>We dont sell or share your data</li>
              <li>We dont track you or run analytics</li>
              <li>We dont store your Google credentials (OAuth tokens only)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Your control</h2>
            <ul className="space-y-1">
              <li>Logout clears your session</li>
              <li>Revoke access anytime at <a href="https://myaccount.google.com/permissions" className="text-blue-600 hover:underline" target="_blank" rel="noopener">Google Permissions</a></li>
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
