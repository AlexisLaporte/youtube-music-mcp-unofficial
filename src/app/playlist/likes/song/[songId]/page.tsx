'use client'

import { use } from 'react'
import { AppShell } from '@/components/layout/AppShell'

interface PageProps {
  params: Promise<{ songId: string }>
}

export default function LikedSongPage({ params }: PageProps) {
  const { songId } = use(params)
  return <AppShell playlistId="liked" songId={songId} />
}
