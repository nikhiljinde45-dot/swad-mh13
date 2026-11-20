import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, api, type AuthResult, type RegisterPayload } from './api'
import type { Profile, Role, User } from './types'

interface AuthValue {
  user: User | null
  profile: Profile | null
  role: Role | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (payload: RegisterPayload) => Promise<AuthResult>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function homeFor(role: Role | null | undefined): string {
  if (role === 'restaurant_owner') return '/owner'
  if (role === 'rider') return '/rider'
  if (role === 'admin') return '/admin'
  return '/'
}

export const roleLabel = (role: Role | null | undefined): string => {
  if (role === 'restaurant_owner') return 'Restaurant Partner'
  if (role === 'rider') return 'Delivery Rider'
  if (role === 'admin') return 'Administrator'
  return 'Customer'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await api.me()
      setUser(result.user)
      setProfile(result.profile)
      setError(null)
    } catch (cause) {
      // A 401 here simply means "not signed in"; anything else is worth surfacing.
      if (cause instanceof ApiError && cause.status !== 401) setError(cause.message)
      setUser(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password)
    setUser(result.user)
    setProfile(result.profile)
    setError(null)
    return result
  }, [])

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const result = await api.register(payload)
    setUser(result.user)
    setProfile(result.profile)
    setError(null)
    return result
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      setProfile(null)
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      profile,
      role: (profile?.role ?? user?.role ?? null) as Role | null,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      refresh,
    }),
    [user, profile, loading, error, signIn, signUp, signOut, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
