import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

// Helper: Promise with timeout
const withTimeout = (promise, ms, errorMsg = 'Operation timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ])
}

// Helper: Clean URL of OAuth artifacts
const cleanUrl = () => {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.has('code') || url.searchParams.has('error') || url.hash.includes('access_token')) {
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      url.searchParams.delete('error')
      url.searchParams.delete('error_description')
      url.hash = ''
      window.history.replaceState({}, document.title, url.pathname || '/')
      return true
    }
  } catch (e) {
    console.warn('Failed to clean URL:', e)
  }
  return false
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)
  const [demoMode] = useState(!supabase)
  const initRef = useRef(false)

  // Ensure user exists in public.users table
  const ensureUserProfile = useCallback(async (authUser) => {
    if (!supabase || !authUser) return false

    try {
      // Use upsert directly - simpler and handles both cases
      const { error } = await withTimeout(
        supabase.from('users').upsert({
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.full_name || 
                authUser.user_metadata?.name || 
                authUser.email?.split('@')[0] || 'User',
          avatar_url: authUser.user_metadata?.avatar_url || 
                      authUser.user_metadata?.picture || null
        }, { onConflict: 'id' }),
        5000,
        'Profile sync timed out'
      )

      if (error) {
        console.error('Profile sync error:', error)
        // Don't block auth for profile errors - user can still use the app
        return false
      }
      return true
    } catch (e) {
      console.error('Profile sync failed:', e)
      return false
    }
  }, [])

  // Handle successful authentication
  const handleAuthSuccess = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null)
      setProfileReady(false)
      return
    }

    console.log('✅ Authenticated:', session.user.email)
    setUser(session.user)
    
    // Profile sync in background - don't block UI
    ensureUserProfile(session.user).then(setProfileReady)
  }, [ensureUserProfile])

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initRef.current) return
    initRef.current = true

    // Demo mode - no Supabase
    if (!supabase) {
      console.log('🎭 Demo mode - no Supabase configured')
      setUser({
        id: 'demo-user',
        email: 'demo@researchos.app',
        user_metadata: { name: 'Demo User', avatar_url: null }
      })
      setProfileReady(true)
      setLoading(false)
      return
    }

    let mounted = true

    const initialize = async () => {
      console.log('🔐 Initializing auth...')
      
      try {
        // Check for OAuth callback code
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')

        // Handle OAuth error
        if (error) {
          console.error('OAuth error:', error, params.get('error_description'))
          cleanUrl()
          if (mounted) setLoading(false)
          return
        }

        // Handle OAuth code exchange
        if (code) {
          console.log('🔄 Exchanging OAuth code...')
          cleanUrl() // Clean URL immediately to prevent re-processing
          
          try {
            const { data, error: exchangeError } = await withTimeout(
              supabase.auth.exchangeCodeForSession(code),
              10000,
              'Code exchange timed out'
            )

            if (exchangeError) {
              console.error('Code exchange failed:', exchangeError)
              // Fall through to check for existing session
            } else if (data?.session) {
              if (mounted) {
                await handleAuthSuccess(data.session)
                setLoading(false)
              }
              return
            }
          } catch (e) {
            console.error('Code exchange error:', e)
            // Fall through to check for existing session
          }
        }

        // Check for existing session
        const { data: { session }, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'Session check timed out'
        )

        if (sessionError) {
          console.error('Session check failed:', sessionError)
        }

        if (mounted) {
          if (session) {
            await handleAuthSuccess(session)
          } else {
            console.log('ℹ️ No session')
            setUser(null)
            setProfileReady(false)
          }
          setLoading(false)
        }
      } catch (e) {
        console.error('Auth initialization failed:', e)
        cleanUrl()
        if (mounted) {
          setUser(null)
          setProfileReady(false)
          setLoading(false)
        }
      }
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth event:', event)
        
        if (!mounted) return

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await handleAuthSuccess(session)
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfileReady(false)
          setLoading(false)
        }
      }
    )

    // Initialize
    initialize()

    // Cleanup
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [handleAuthSuccess])

  const signInWithGoogle = async () => {
    if (!supabase) {
      alert('Demo mode: Google Sign-In requires Supabase configuration')
      return
    }

    console.log('🚀 Starting Google Sign-In...')
    const redirectTo = window.location.origin

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    })

    if (error) {
      console.error('Sign in error:', error)
      alert('Sign in failed: ' + error.message)
    }
  }

  const signOut = async () => {
    if (!supabase) {
      setUser(null)
      setProfileReady(false)
      return
    }

    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfileReady(false)
    } catch (e) {
      console.error('Sign out error:', e)
      // Force clear state even on error
      setUser(null)
      setProfileReady(false)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      demoMode,
      profileReady,
      signInWithGoogle,
      signOut,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  )
}
