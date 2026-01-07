import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase, db } from '../lib/supabase'

const DEV = import.meta.env.DEV
const dlog = (...args) => { if (DEV) console.log(...args) }
const dwarn = (...args) => { if (DEV) console.warn(...args) }
const derr = (...args) => { if (DEV) console.error(...args) }

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

// Helper: Promise with timeout
const withTimeout = (promise, ms, errorMsg = 'Operation timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ])
}

// Helper: Get and store invite token from URL
const getInviteToken = () => {
  try {
    const params = new URLSearchParams(window.location.search)
    const invite = params.get('invite')
    if (invite) {
      // Store in sessionStorage so it persists through OAuth redirect
      sessionStorage.setItem('pendingInviteToken', invite)
      // Clean the invite param from URL
      params.delete('invite')
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname
      window.history.replaceState({}, document.title, newUrl)
      return invite
    }
    // Check if we have a stored invite token
    return sessionStorage.getItem('pendingInviteToken')
  } catch (e) {
    return null
  }
}

// Helper: Clean URL of OAuth artifacts
const cleanUrl = () => {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.has('code') || url.searchParams.has('error') || url.hash.includes('access_token')) {
      // Preserve invite token if present
      const invite = url.searchParams.get('invite')
      url.searchParams.delete('code')
      url.searchParams.delete('state')
      url.searchParams.delete('error')
      url.searchParams.delete('error_description')
      url.hash = ''
      window.history.replaceState({}, document.title, url.pathname || '/')
      return true
    }
  } catch (e) {
    dwarn('Failed to clean URL:', e)
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
            authUser.user_metadata?.picture || null,
          email_notifications: authUser.user_metadata?.email_notifications ?? true
        }, { onConflict: 'id' }),
        5000,
        'Profile sync timed out'
      )

      if (error) {
        derr('Profile sync error:', error)
        // Don't block auth for profile errors - user can still use the app
        return false
      }
      return true
    } catch (e) {
      derr('Profile sync failed:', e)
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

    dlog('✅ Authenticated:', session.user.email)
    setUser(session.user)

    // Profile sync in background - don't block UI
    ensureUserProfile(session.user).then(async (ready) => {
      setProfileReady(ready)

      // Check for pending invite token after profile is ready
      const inviteToken = sessionStorage.getItem('pendingInviteToken')
      if (inviteToken && ready) {
        dlog('🎫 Processing invite token...')
        try {
          const { data, error } = await db.acceptInvitationByToken(inviteToken, session.user.id)
          if (error) {
            derr('Failed to accept invitation:', error)
          } else if (data) {
            dlog('✅ Joined project:', data.projectId)
            // Could dispatch an event here to reload projects
            window.dispatchEvent(new CustomEvent('invitation-accepted', {
              detail: { projectId: data.projectId, role: data.role }
            }))
          }
        } catch (e) {
          derr('Invite processing error:', e)
        } finally {
          // Clear the token regardless of outcome
          sessionStorage.removeItem('pendingInviteToken')
        }
      }
    })
  }, [ensureUserProfile])

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initRef.current) return
    initRef.current = true

    // Capture invite token from URL first (before any redirects)
    getInviteToken()

    // Demo mode - no Supabase
    if (!supabase) {
      dlog('🎭 Demo mode - no Supabase configured')
      setUser({
        id: 'demo-user',
        email: 'demo@hypothesys.app',
        user_metadata: { name: 'Demo User', avatar_url: null }
      })
      setProfileReady(true)
      setLoading(false)
      return
    }

    let mounted = true

    const initialize = async () => {
      dlog('🔐 Initializing auth...')

      try {
        // Check for OAuth callback code
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        const error = params.get('error')

        // Handle OAuth error
        if (error) {
          derr('OAuth error:', error, params.get('error_description'))
          cleanUrl()
          if (mounted) setLoading(false)
          return
        }

        // Handle OAuth code exchange
        if (code) {
          dlog('🔄 Exchanging OAuth code...')
          cleanUrl() // Clean URL immediately to prevent re-processing

          try {
            const { data, error: exchangeError } = await withTimeout(
              supabase.auth.exchangeCodeForSession(code),
              10000,
              'Code exchange timed out'
            )

            if (exchangeError) {
              derr('Code exchange failed:', exchangeError)
              // Fall through to check for existing session
            } else if (data?.session) {
              if (mounted) {
                await handleAuthSuccess(data.session)
                setLoading(false)
              }
              return
            }
          } catch (e) {
            derr('Code exchange error:', e)
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
          derr('Session check failed:', sessionError)
        }

        if (mounted) {
          if (session) {
            await handleAuthSuccess(session)
          } else {
            dlog('ℹ️ No session')
            setUser(null)
            setProfileReady(false)
          }
          setLoading(false)
        }
      } catch (e) {
        derr('Auth initialization failed:', e)
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
        dlog('🔔 Auth event:', event)

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

    dlog('🚀 Starting Google Sign-In...')
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
      derr('Sign in error:', error)
      alert('Sign in failed: ' + error.message)
    }
  }

  // Email/Password sign up (for local development)
  const signUpWithEmail = async (email, password, name = '') => {
    if (!supabase) {
      alert('Demo mode: Sign up requires Supabase configuration')
      return { error: new Error('Demo mode') }
    }

    dlog('📝 Starting email sign up...')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: name || email.split('@')[0],
          name: name || email.split('@')[0]
        }
      }
    })

    if (error) {
      derr('Sign up error:', error)
      return { error }
    }

    // Check if email confirmation is required
    // If user exists but no session, email confirmation is pending
    if (data?.user && !data?.session) {
      dlog('📧 Email confirmation required')
      return { data, error: null, confirmationRequired: true }
    }

    // If session exists, user is logged in (no confirmation required)
    if (data?.session) {
      await handleAuthSuccess(data.session)
    }

    return { data, error: null, confirmationRequired: false }
  }

  // Email/Password sign in (for local development)
  const signInWithEmail = async (email, password) => {
    if (!supabase) {
      alert('Demo mode: Sign in requires Supabase configuration')
      return { error: new Error('Demo mode') }
    }

    dlog('🔑 Starting email sign in...')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      derr('Sign in error:', error)
      return { error }
    }

    if (data?.session) {
      await handleAuthSuccess(data.session)
    }

    return { data, error: null }
  }

  // Update user profile (name)
  const updateProfile = async (updates) => {
    if (!supabase) {
      // Demo mode - update local state
      setUser(prev => ({
        ...prev,
        user_metadata: { ...prev.user_metadata, ...updates }
      }))
      return { error: null }
    }

    const { data, error } = await supabase.auth.updateUser({
      data: updates
    })

    if (error) {
      derr('Profile update error:', error)
      return { error }
    }

    // Update local user state
    if (data?.user) {
      setUser(data.user)
    }

    // Also update the public users table
    if (user?.id) {
      const dbUpdates = {}
      if (updates.full_name || updates.name) dbUpdates.name = updates.full_name || updates.name
      if (updates.avatar_url !== undefined) dbUpdates.avatar_url = updates.avatar_url
      if (updates.email_notifications !== undefined) dbUpdates.email_notifications = updates.email_notifications

      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from('users').update(dbUpdates).eq('id', user.id)
      }
    }

    return { data, error: null }
  }

  // Update email (requires confirmation)
  const updateEmail = async (newEmail) => {
    if (!supabase) {
      return { error: new Error('Demo mode: Cannot change email') }
    }

    const { data, error } = await supabase.auth.updateUser({
      email: newEmail
    })

    if (error) {
      derr('Email update error:', error)
      return { error }
    }

    return { data, error: null, confirmationRequired: true }
  }

  // Update password
  const updatePassword = async (newPassword) => {
    if (!supabase) {
      return { error: new Error('Demo mode: Cannot change password') }
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      derr('Password update error:', error)
      return { error }
    }

    return { data, error: null }
  }

  // Send password reset email
  const sendPasswordReset = async (email) => {
    if (!supabase) {
      return { error: new Error('Demo mode: Cannot reset password') }
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) {
      derr('Password reset error:', error)
      return { error }
    }

    return { data, error: null }
  }

  // Check if user is using email auth (not OAuth)
  const isEmailAuth = () => {
    if (!user) return false
    const provider = user.app_metadata?.provider
    return provider === 'email' || !provider
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
      derr('Sign out error:', e)
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
      signInWithEmail,
      signUpWithEmail,
      signOut,
      updateProfile,
      updateEmail,
      updatePassword,
      sendPasswordReset,
      isEmailAuth,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  )
}
