'use client'

import { featureMeta as syncMeta } from '@/app/users/me/sync/meta'
import { featureMeta as discoverMeta } from '@/components/detail/SongDetail'
import { featureMeta as playlistDiscoverMeta } from '@/components/detail/PlaylistDetail'
import { featureMeta as playerMeta } from '@/components/layout/PlayerBar'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { OptionalSidebarLayout } from '@/components/layout/OptionalSidebarLayout'

const features = [syncMeta, discoverMeta, playlistDiscoverMeta, playerMeta]

export default function HelpPage() {
  return (
    <OptionalSidebarLayout>
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <QuestionMarkCircleIcon className="w-8 h-8 text-space-cadet" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Help & FAQ</h1>
        </div>

        <div className="space-y-8">
          {features.map(feature => (
            <section key={feature.id} className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.name}</h2>
              <p className="text-gray-600 dark:text-slate-400 mb-4">{feature.description}</p>

              {feature.faq && feature.faq.length > 0 && (
                <div className="space-y-3">
                  {feature.faq.map((item, i) => (
                    <details key={i} className="group">
                      <summary className="cursor-pointer text-gray-800 dark:text-slate-200 font-medium hover:text-space-cadet dark:hover:text-red-pantone">
                        {item.q}
                      </summary>
                      <p className="mt-2 text-gray-600 dark:text-slate-400 pl-4 border-l-2 border-gray-200 dark:border-slate-600">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </OptionalSidebarLayout>
  )
}
