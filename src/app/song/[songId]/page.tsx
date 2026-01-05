'use client'

import { use } from 'react'
import { AppShell } from '@/components/layout/AppShell'

interface PageProps {
  params: Promise<{ songId: string }>
}

export default function SongPage({ params }: PageProps) {
  const { songId } = use(params)
  return <AppShell songId={songId} />
}
