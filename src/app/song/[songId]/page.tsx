'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageWithSidebar } from '@/components/layout/PageWithSidebar'
import { SongDetail } from '@/components/detail/SongDetail'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { Song } from '@/types/youtube'
import { MusicalNoteIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { PlayIcon } from '@heroicons/react/24/solid'

interface PageProps {
  params: Promise<{ songId: string }>
}

interface VideoInfo {
  videoId: string
  title: string
  artist: string
  thumbnail?: string
  duration?: string
}

export default function SongPage({ params }: PageProps) {
  const { songId } = use(params)
  const router = useRouter()
  const getSong = useMusicStore(state => state.getSong)
  const { playVideo, playerVideoId } = useUIStore()

  const [externalVideo, setExternalVideo] = useState<VideoInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if song is in library
  const songInLibrary = getSong(songId)

  // Fetch video info if not in library
  useEffect(() => {
    if (songInLibrary) {
      setIsLoading(false)
      return
    }

    const fetchVideoInfo = async () => {
      try {
        const res = await fetch(`/api/youtube/video/${songId}`)
        if (!res.ok) {
          throw new Error('Video not found')
        }
        const data = await res.json()
        setExternalVideo(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load video')
      } finally {
        setIsLoading(false)
      }
    }

    fetchVideoInfo()
  }, [songId, songInLibrary])

  // If song is in library, show the full SongDetail
  if (songInLibrary) {
    const isPlaying = playerVideoId === songId
    return (
      <PageWithSidebar>
        <SongDetail song={songInLibrary} isNowPlaying={isPlaying} />
      </PageWithSidebar>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <PageWithSidebar>
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-red-pantone" />
        </div>
      </PageWithSidebar>
    )
  }

  // Error state
  if (error || !externalVideo) {
    return (
      <PageWithSidebar>
        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
          <MusicalNoteIcon className="w-16 h-16 text-gray-300 dark:text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Video not found</h2>
          <p className="text-gray-500 dark:text-slate-400 mb-6">{error || 'This video could not be loaded'}</p>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Go back
          </button>
        </div>
      </PageWithSidebar>
    )
  }

  // External video (not in library) - simplified view
  const isPlaying = playerVideoId === songId

  return (
    <PageWithSidebar>
      <div className="h-full overflow-y-auto">
        <div className="p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Back button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 mb-6"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to search
            </button>

            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left column: Album art */}
              <div className="lg:w-80 flex-shrink-0">
                <div className="lg:sticky lg:top-6 space-y-6">
                  <div className={`relative group mx-auto lg:mx-0 w-fit rounded-2xl ${isPlaying ? 'ring-4 ring-red-pantone/30' : ''}`}>
                    {externalVideo.thumbnail ? (
                      <img
                        src={externalVideo.thumbnail}
                        alt=""
                        className="w-56 h-56 lg:w-72 lg:h-72 rounded-2xl shadow-xl object-cover"
                      />
                    ) : (
                      <div className="w-56 h-56 lg:w-72 lg:h-72 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center shadow-xl">
                        <MusicalNoteIcon className="w-20 h-20 text-gray-400 dark:text-slate-400" />
                      </div>
                    )}
                    {/* Play overlay */}
                    <button
                      onClick={() => playVideo(songId, { videoId: songId, title: externalVideo.title, artist: externalVideo.artist, thumbnail: externalVideo.thumbnail })}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300"
                    >
                      <div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/90 shadow-lg transform group-hover:scale-110 transition-transform">
                        <PlayIcon className="w-8 h-8 text-red-pantone ml-1" />
                      </div>
                    </button>
                    {/* Playing indicator */}
                    {isPlaying && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-red-pantone text-white text-xs font-medium rounded-full shadow-lg">
                        <span className="flex gap-0.5">
                          <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                        Now Playing
                      </div>
                    )}
                  </div>

                  <div className="text-center lg:text-left">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{externalVideo.title}</h1>
                    <p className="text-lg text-gray-500 dark:text-slate-400">{externalVideo.artist}</p>
                  </div>

                  {/* Not in library indicator */}
                  <div className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-center">
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      This track is not in your library
                    </p>
                  </div>
                </div>
              </div>

              {/* Right column: Actions */}
              <div className="flex-1">
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => playVideo(songId, { videoId: songId, title: externalVideo.title, artist: externalVideo.artist, thumbnail: externalVideo.thumbnail })}
                      className="w-full flex items-center gap-3 p-4 bg-red-pantone text-white rounded-xl hover:bg-crimson transition-colors"
                    >
                      <PlayIcon className="w-5 h-5" />
                      <span className="font-medium">Play</span>
                    </button>
                    <a
                      href={`https://music.youtube.com/watch?v=${songId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 p-4 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <MusicalNoteIcon className="w-5 h-5" />
                      <span className="font-medium">Open on YouTube Music</span>
                    </a>
                  </div>
                </section>

                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Information</h2>
                  <dl className="grid grid-cols-2 gap-4 text-sm">
                    <dt className="text-gray-500 dark:text-slate-400">Video ID</dt>
                    <dd className="text-gray-900 dark:text-white font-mono">{songId}</dd>
                    {externalVideo.duration && (
                      <>
                        <dt className="text-gray-500 dark:text-slate-400">Duration</dt>
                        <dd className="text-gray-900 dark:text-white">{externalVideo.duration}</dd>
                      </>
                    )}
                  </dl>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWithSidebar>
  )
}
