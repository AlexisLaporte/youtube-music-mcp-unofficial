'use client'

import { useUIStore } from '@/stores/useUIStore'
import { QueueListIcon, MusicalNoteIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import {
  QueueListIcon as QueueListIconSolid,
  MusicalNoteIcon as MusicalNoteIconSolid,
  InformationCircleIcon as InformationCircleIconSolid
} from '@heroicons/react/24/solid'

export function MobileBottomTabs() {
  const { mobileTab, setMobileTab } = useUIStore()

  const tabs = [
    {
      id: 'playlists' as const,
      label: 'Playlists',
      icon: QueueListIcon,
      activeIcon: QueueListIconSolid,
    },
    {
      id: 'songs' as const,
      label: 'Songs',
      icon: MusicalNoteIcon,
      activeIcon: MusicalNoteIconSolid,
    },
    {
      id: 'detail' as const,
      label: 'Details',
      icon: InformationCircleIcon,
      activeIcon: InformationCircleIconSolid,
    },
  ]

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="flex">
        {tabs.map(tab => {
          const isActive = mobileTab === tab.id
          const Icon = isActive ? tab.activeIcon : tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                isActive ? 'text-red-pantone' : 'text-gray-500'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
