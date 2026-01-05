'use client'

import React from 'react'
import { MusicalNoteIcon, HeartIcon, QueueListIcon, MagnifyingGlassIcon, PlayIcon } from '@heroicons/react/24/solid'
import { ShieldCheckIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

interface LoginPromptProps {
  onConnect: () => void
  error?: string
}

export const LoginPrompt: React.FC<LoginPromptProps> = ({ onConnect, error }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-space-cadet via-space-cadet/95 to-slate-900 overflow-y-auto">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-pantone/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-20 w-60 h-60 bg-crimson/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <div>
              {/* Logo */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center shadow-lg shadow-red-pantone/25">
                  <MusicalNoteIcon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">YTMusic Manager</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                Organize your playlists{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-pantone to-crimson">
                  intelligently
                </span>
              </h1>

              <p className="text-lg text-slate-300 mb-8 leading-relaxed">
                Never forget your favorite music. See which liked songs are not in any playlist yet, and organize them effortlessly.
              </p>

              {/* CTA Button */}
              <div className="space-y-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={onConnect}
                  className="group w-full md:w-auto bg-white hover:bg-slate-100 text-slate-900 py-4 px-8 rounded-xl transition-all font-semibold inline-flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl hover:scale-[1.02]"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <p className="text-sm text-slate-400">
                  Secure login via Google OAuth. No password stored.
                </p>
              </div>
            </div>

            {/* Right: App preview mockup */}
            <div className="hidden md:block">
              <div className="relative">
                {/* Mockup window */}
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
                  {/* Window header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>

                  {/* Mockup content */}
                  <div className="p-4 space-y-3">
                    {/* Liked songs card */}
                    <div className="bg-gradient-to-r from-red-pantone/20 to-crimson/20 rounded-xl p-4 border border-red-pantone/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center">
                          <HeartIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-white font-medium">Liked Songs</div>
                          <div className="text-slate-400 text-sm">847 tracks</div>
                        </div>
                      </div>
                    </div>

                    {/* Playlist items */}
                    {[
                      { name: 'Chill Vibes', count: 124, color: 'from-purple-500 to-pink-500' },
                      { name: 'Workout Mix', count: 56, color: 'from-orange-500 to-red-500' },
                      { name: 'Focus Flow', count: 89, color: 'from-blue-500 to-cyan-500' },
                    ].map((playlist, i) => (
                      <div key={i} className="bg-slate-700/30 rounded-xl p-3 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${playlist.color} flex items-center justify-center`}>
                          <MusicalNoteIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="text-white text-sm font-medium">{playlist.name}</div>
                          <div className="text-slate-400 text-xs">{playlist.count} tracks</div>
                        </div>
                        <PlayIcon className="w-5 h-5 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -bottom-4 -right-4 bg-gradient-to-br from-red-pantone to-crimson text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                  100% free
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-slate-900/50 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-white text-center mb-12">
            Keep your library in order
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: HeartIcon,
                title: 'Find Orphan Songs',
                description: 'Instantly see which liked songs are not in any playlist yet.',
                color: 'from-red-pantone to-crimson',
              },
              {
                icon: QueueListIcon,
                title: 'Playlist Management',
                description: 'Create, edit and organize your YouTube Music playlists easily.',
                color: 'from-purple-500 to-pink-500',
              },
              {
                icon: MagnifyingGlassIcon,
                title: 'YouTube Search',
                description: 'Search and add tracks directly from YouTube.',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: ArrowPathIcon,
                title: 'Auto Sync',
                description: 'Your playlists sync automatically with YouTube Music.',
                color: 'from-green-500 to-emerald-500',
              },
              {
                icon: SparklesIcon,
                title: 'Shuffle & Loop',
                description: 'Listen to your playlists in shuffle or loop mode.',
                color: 'from-orange-500 to-yellow-500',
              },
              {
                icon: ShieldCheckIcon,
                title: 'Secure',
                description: 'Google OAuth login. Your data stays private.',
                color: 'from-slate-500 to-slate-600',
              },
            ].map((feature, i) => (
              <div key={i} className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Stop losing track of your favorite songs
          </h2>
          <p className="text-slate-400 mb-8">
            Free, no commitment, no credit card required.
          </p>
          <button
            onClick={onConnect}
            className="bg-gradient-to-r from-red-pantone to-crimson hover:from-red-pantone/90 hover:to-crimson/90 text-white py-3 px-8 rounded-xl transition-all font-semibold inline-flex items-center gap-2 shadow-lg hover:shadow-red-pantone/25"
          >
            <MusicalNoteIcon className="w-5 h-5" />
            Get started
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <MusicalNoteIcon className="w-4 h-4" />
            <span>YTMusic Manager</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}