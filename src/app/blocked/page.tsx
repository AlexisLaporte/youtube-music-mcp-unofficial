'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { XCircleIcon } from '@heroicons/react/24/outline'

export default function BlockedPage() {
  const { user, signOut, isLoading, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-cadet via-cool-gray to-antiflash-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-antiflash-white/30 border-t-red-pantone" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-cadet via-cool-gray to-antiflash-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Access Denied
        </h1>

        <div className="text-gray-600 dark:text-slate-400 mb-6 space-y-3 text-sm">
          <p>Your account has been blocked.</p>
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 text-left">
            <p className="font-medium text-gray-900 dark:text-white mb-2">About this service</p>
            <ul className="space-y-1 text-gray-500 dark:text-slate-400">
              <li>• Free tool, currently in testing</li>
              <li>• Organize your YouTube Music playlists</li>
              <li>• Also works as a music player</li>
            </ul>
          </div>
          <p>
            Contact me on{' '}
            <a
              href="https://reddit.com/user/AlexisLaporte/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Reddit u/AlexisLaporte
            </a>
            {' '}if you need access.
          </p>
        </div>

        {user && (
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 dark:text-slate-400">Logged in as</p>
            <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
          </div>
        )}

        <button
          onClick={signOut}
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
