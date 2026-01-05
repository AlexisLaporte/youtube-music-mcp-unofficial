'use client'

import { use } from 'react'
import { AppShell } from '@/components/layout/AppShell'

interface PageProps {
  params: Promise<{ playlistId: string; songId: string }>
}

export default function PlaylistSongPage({ params }: PageProps) {
  const { playlistId, songId } = use(params)
  return <AppShell playlistId={playlistId} songId={songId} />
}
