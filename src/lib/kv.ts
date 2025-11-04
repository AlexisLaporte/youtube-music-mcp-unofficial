import { kv } from '@vercel/kv'

export interface UserSession {
  userId: string
  email: string
  name: string
  profilePicture?: string
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

const SESSION_PREFIX = 'session:'
const TOKEN_PREFIX = 'token:'

export const kvService = {
  // Store user session
  async setSession(userId: string, session: UserSession): Promise<void> {
    await kv.set(`${SESSION_PREFIX}${userId}`, session, {
      ex: 60 * 60 * 24 * 7 // 7 days
    })
  },

  // Get user session
  async getSession(userId: string): Promise<UserSession | null> {
    return await kv.get(`${SESSION_PREFIX}${userId}`)
  },

  // Delete user session
  async deleteSession(userId: string): Promise<void> {
    await kv.del(`${SESSION_PREFIX}${userId}`)
  },

  // Store YouTube tokens separately
  async setYouTubeTokens(userId: string, accessToken: string, refreshToken?: string): Promise<void> {
    await kv.set(`${TOKEN_PREFIX}${userId}`, {
      accessToken,
      refreshToken,
      updatedAt: Date.now()
    }, {
      ex: 60 * 60 * 24 * 30 // 30 days
    })
  },

  // Get YouTube tokens
  async getYouTubeTokens(userId: string): Promise<{ accessToken: string; refreshToken?: string } | null> {
    return await kv.get(`${TOKEN_PREFIX}${userId}`)
  }
}
