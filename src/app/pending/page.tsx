'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { ClockIcon } from '@heroicons/react/24/outline'

export default function PendingPage() {
  const router = useRouter()
  const { user, signOut, isLoading, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Redirect if approved or admin
  useEffect(() => {
    if (user && (user.status === 'approved' || user.isAdmin)) {
      router.push('/')
    }
  }, [user, router])

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
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <ClockIcon className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Awaiting Approval
        </h1>

        <div className="text-gray-600 dark:text-slate-400 mb-6 space-y-3 text-sm">
          <p>Your account is pending approval.</p>
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
            {' '}to request access.
          </p>
        </div>

        {user && (
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 dark:text-slate-400">Logged in as</p>
            <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
          </div>
        )}

        <button
          onClick={async () => {
            await signOut()
            router.push('/')
          }}
          className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
