'use client'

import { useState, useRef, useEffect } from 'react'
import { User, Moon, Sun, LogOut } from 'lucide-react'
import Image from 'next/image'
import { useThemeStore } from '@/stores/useThemeStore'

interface AccountPopoverProps {
  userName?: string
  userEmail?: string
  userAvatar?: string
  onDisconnect: () => void
}

export function AccountPopover({ userName, userEmail, userAvatar, onDisconnect }: AccountPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const { theme, toggleTheme } = useThemeStore()

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        {userAvatar ? (
          <Image
            src={userAvatar}
            alt={userName || 'User'}
            width={32}
            height={32}
            className="rounded-full border-2 border-white dark:border-slate-600 shadow-sm"
          />
        ) : (
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
        )}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{userName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
        </div>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              {userAvatar ? (
                <Image
                  src={userAvatar}
                  alt={userName || 'User'}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">{userName}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{userEmail}</p>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="py-2">
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-4 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
                <span className="text-sm">Dark mode</span>
              </div>
              <div
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${
                  theme === 'dark' ? 'bg-space-cadet' : 'bg-slate-200'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
            <button
              onClick={() => {
                setIsOpen(false)
                onDisconnect()
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
