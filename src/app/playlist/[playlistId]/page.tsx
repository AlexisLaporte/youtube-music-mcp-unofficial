'use client'

import { use } from 'react'
import { AppShell } from '@/components/layout/AppShell'

interface PageProps {
  params: Promise<{ playlistId: string }>
}

export default function PlaylistPage({ params }: PageProps) {
  const { playlistId } = use(params)
  return <AppShell playlistId={playlistId} />
}
