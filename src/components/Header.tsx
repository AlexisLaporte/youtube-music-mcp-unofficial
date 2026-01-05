'use client'

import React from 'react'
import { Music, Heart, ListMusic, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AccountPopover } from './AccountPopover'

interface HeaderProps {
  isConnected: boolean
  onConnect: () => void
  onDisconnect: () => void
  userName?: string
  userEmail?: string
  userAvatar?: string
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  onConnect,
  onDisconnect,
  userName,
  userEmail,
  userAvatar
}) => {
  const pathname = usePathname()

  return (
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Music className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">YouTube Music Manager</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 hidden sm:block">Manage your YouTube playlists easily</p>
              </div>
            </Link>

            {isConnected && (
              <nav className="hidden md:flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                <Link
                  href="/"
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === '/'
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Heart className="h-4 w-4" />
                  Liked Songs
                </Link>
                <Link
                  href="/playlists"
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === '/playlists'
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <ListMusic className="h-4 w-4" />
                  Playlists
                </Link>
                <Link
                  href="/search"
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === '/search'
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Search className="h-4 w-4" />
                  Search
                </Link>
              </nav>
            )}
          </div>

          {isConnected ? (
            <AccountPopover
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              onDisconnect={onDisconnect}
            />
          ) : (
            <button
              onClick={onConnect}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-4 py-2 rounded-lg transition-all duration-200"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
};