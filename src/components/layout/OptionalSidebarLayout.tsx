'use client'

import { useEffect, ReactNode } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useMusicStore } from '@/stores/useMusicStore'
import { PlaylistSidebar } from './PlaylistSidebar'
import { MobileBottomTabs } from './MobileBottomTabs'
import { MusicalNoteIcon } from '@heroicons/react/24/solid'
import Link from 'next/link'

interface OptionalSidebarLayoutProps {
  children: ReactNode
}

/**
 * Layout that shows sidebar when logged in, simple header when not.
 * Used for pages that should be accessible both ways (help, privacy, terms).
 */
export function OptionalSidebarLayout({ children }: OptionalSidebarLayoutProps) {
  const { isConnected, isLoading, initialize } = useAuthStore()
  const { smartSync } = useMusicStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (isConnected) {
      smartSync()
    }
  }, [isConnected, smartSync])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-space-cadet" />
      </div>
    )
  }

  // Not connected: simple layout with header
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
        {/* Simple header */}
        <header className="border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center">
                <MusicalNoteIcon className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">YTMusic Manager</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
              <Link href="/help" className="hover:text-gray-900 dark:hover:text-white transition-colors">Help</Link>
              <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms</Link>
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    )
  }

  // Connected: full layout with sidebar
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop: Sidebar + Content */}
        <div className="hidden md:flex flex-1">
          <aside className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
            <PlaylistSidebar />
          </aside>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Mobile */}
        <div className="flex-1 md:hidden overflow-y-auto">
          {children}
        </div>
      </div>

      <div className="md:hidden">
        <MobileBottomTabs />
      </div>
    </div>
  )
}
