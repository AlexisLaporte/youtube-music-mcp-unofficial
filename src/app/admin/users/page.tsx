'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { CheckIcon, XMarkIcon, ClockIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

interface User {
  id: string
  email: string
  name?: string
  profilePicture?: string
  status: 'pending' | 'approved' | 'blocked'
  createdAt: number
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, initialize } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    initialize()
  }, [initialize])

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && user && !user.isAdmin) {
      router.push('/')
    }
  }, [user, authLoading, router])

  // Fetch users
  useEffect(() => {
    if (user?.isAdmin) {
      fetchUsers()
    }
  }, [user])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (userId: string, status: 'pending' | 'approved' | 'blocked') => {
    setUpdating(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status })
      })
      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, status } : u))
      }
    } catch (error) {
      console.error('Error updating user:', error)
    } finally {
      setUpdating(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 dark:border-slate-600 border-t-red-pantone" />
      </div>
    )
  }

  if (!user?.isAdmin) {
    return null
  }

  const pendingUsers = users.filter(u => u.status === 'pending')
  const approvedUsers = users.filter(u => u.status === 'approved')
  const blockedUsers = users.filter(u => u.status === 'blocked')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-slate-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        </div>

        {/* Pending */}
        {pendingUsers.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5" />
              Pending Approval ({pendingUsers.length})
            </h2>
            <div className="space-y-2">
              {pendingUsers.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  updating={updating === u.id}
                  onApprove={() => updateStatus(u.id, 'approved')}
                  onBlock={() => updateStatus(u.id, 'blocked')}
                />
              ))}
            </div>
          </section>
        )}

        {/* Approved */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-4 flex items-center gap-2">
            <CheckIcon className="w-5 h-5" />
            Approved ({approvedUsers.length})
          </h2>
          {approvedUsers.length > 0 ? (
            <div className="space-y-2">
              {approvedUsers.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  updating={updating === u.id}
                  onBlock={() => updateStatus(u.id, 'blocked')}
                  onPending={() => updateStatus(u.id, 'pending')}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-slate-400 text-sm">No approved users yet</p>
          )}
        </section>

        {/* Blocked */}
        {blockedUsers.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
              <XMarkIcon className="w-5 h-5" />
              Blocked ({blockedUsers.length})
            </h2>
            <div className="space-y-2">
              {blockedUsers.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  updating={updating === u.id}
                  onApprove={() => updateStatus(u.id, 'approved')}
                  onPending={() => updateStatus(u.id, 'pending')}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function UserRow({
  user,
  updating,
  onApprove,
  onBlock,
  onPending
}: {
  user: User
  updating: boolean
  onApprove?: () => void
  onBlock?: () => void
  onPending?: () => void
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-4 flex items-center justify-between border border-gray-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        {user.profilePicture ? (
          <img src={user.profilePicture} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700" />
        )}
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{user.name || 'Unknown'}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {updating ? (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-gray-600" />
        ) : (
          <>
            {onApprove && (
              <button
                onClick={onApprove}
                className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                title="Approve"
              >
                <CheckIcon className="w-4 h-4" />
              </button>
            )}
            {onBlock && (
              <button
                onClick={onBlock}
                className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                title="Block"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
            {onPending && (
              <button
                onClick={onPending}
                className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                title="Set to Pending"
              >
                <ClockIcon className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
