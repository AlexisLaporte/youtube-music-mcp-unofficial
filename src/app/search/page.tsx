'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageWithSidebar } from '@/components/layout/PageWithSidebar'
import { SearchPanelWithURL } from '@/components/search/SearchPanelWithURL'

function SearchContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  return <SearchPanelWithURL initialQuery={initialQuery} />
}

export default function SearchPage() {
  return (
    <PageWithSidebar>
      <Suspense fallback={
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-red-pantone" />
        </div>
      }>
        <SearchContent />
      </Suspense>
    </PageWithSidebar>
  )
}
