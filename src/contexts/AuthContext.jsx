import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileReady, setProfileReady] = useState(false)
  const [demoMode] = useState(!supabase)
  const initRef = useRef(false)

  // Strip OAuth artifacts from URL to prevent re-processing on refresh
  const stripOAuthArtifacts = useCallback(() => {
    try {
      const url = new URL(window.location.href)
      const hashHasTokens = /access_token=|refresh_token=|provider_token=|expires_at=|token_type=/.test(url.hash)
      const hasCode = url.searchParams.has('code')

      if (!hashHasTokens && !hasCode) return false

      if (hashHasTokens) url.hash = ''
      if (hasCode) {
        ['code', 'state', 'error', 'error_description'].forEach(k => url.searchParams.delete(k))
      }

      window.history.replaceState({}, document.title, url.pathname || '/')
      console.log('🧹 Cleaned OAuth artifacts from URL')
      return true
    } catch (e) {
      console.warn('⚠️ Failed to strip OAuth artifacts:', e)
      return false
    }
  }, [])

  // Ensure user exists in public.users table (required for FK constraints)
  const ensureUserProfile = useCallback(async (authUser) => {
    if (!supabase || !authUser) return false

    try {
      console.log('👤 Ensuring user profile for:', authUser.email)
      
      // First check if user exists
      const { data: existing, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle()

      if (checkError) {
        console.error('❌ Error checking user:', checkError)
      }

      if (existing) {
        console.log('✅ User profile already exists')
        return true
      }

      // Create user profile
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.full_name || 
                authUser.user_metadata?.name || 
                authUser.email?.split('@')[0] || 'User',
          avatar_url: authUser.user_metadata?.avatar_url || 
                      authUser.user_metadata?.picture || null
        })

      if (insertError) {
        // Try upsert as fallback (in case of race condition)
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            id: authUser.id,
            email: authUser.email,
            name: authUser.user_metadata?.full_name || 
                  authUser.user_metadata?.name || 
                  authUser.email?.split('@')[0] || 'User',
            avatar_url: authUser.user_metadata?.avatar_url || 
                        authUser.user_metadata?.picture || null
          }, { onConflict: 'id' })

        if (upsertError) {
          console.error('❌ Error upserting user:', upsertError)
          return false
        }
      }

      console.log('✅ User profile created')
      return true
    } catch (e) {
      console.error('❌ Error ensuring user profile:', e)
      return false
    }
  }, [])

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (initRef.current) return
    initRef.current = true

    let cancelled = false

    if (!supabase) {
      console.log('🎭 Running in DEMO MODE')
      setUser({
        id: 'demo-user',
        email: 'demo@researchos.app',
        user_metadata: { name: 'Demo User', avatar_url: null }
      })
      setProfileReady(true)
      setLoading(false)
      return
    }

    console.log('🔐 Initializing authentication...')

    const initAuth = async () => {
      try {
        const hasCode = window.location.search.includes('code=')
        const hasTokens = window.location.hash.includes('access_token=')
        
        if (hasCode || hasTokens) {
          console.log('🔄 OAuth callback detected, exchanging code...')
        }

        // For PKCE flow with code in URL, we need to let Supabase exchange it first
        // The exchangeCodeForSession is handled automatically by detectSessionInUrl
        // but we should give it a moment to complete
        if (hasCode) {
          // Small delay to allow Supabase to process the code
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        // Get current session with timeout
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session fetch timed out')), 10000)
        )
        
        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ])
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError)
          throw sessionError
        }

        if (session?.user) {
          console.log('✅ Session found:', session.user.email)
          stripOAuthArtifacts()
          const profileOk = await ensureUserProfile(session.user)
          
          if (!cancelled) {
            setUser(session.user)
            setProfileReady(profileOk)
            setLoading(false)
          }
        } else {
          console.log('ℹ️ No session found')
          // No session - if we had a code, wait for auth state change
          if (hasCode) {
            console.log('⏳ Code present but no session yet, waiting for exchange...')
            // The onAuthStateChange will handle it
            setTimeout(() => {
              if (!cancelled && !user) {
                console.log('⚠️ OAuth exchange timed out')
                stripOAuthArtifacts()
                setLoading(false)
              }
            }, 8000)
          } else {
            if (!cancelled) {
              setUser(null)
              setProfileReady(false)
              setLoading(false)
            }
          }
        }
      } catch (e) {
        console.error('❌ Auth init error:', e)
        stripOAuthArtifacts()
        if (!cancelled) {
          setUser(null)
          setProfileReady(false)
          setLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth event:', event)
        if (cancelled) return

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          stripOAuthArtifacts()
          if (session?.user) {
            const profileOk = await ensureUserProfile(session.user)
            if (!cancelled) {
              setUser(session.user)
              setProfileReady(profileOk)
              setLoading(false)
            }
          }
        } else if (event === 'SIGNED_OUT') {
          if (!cancelled) {
            setUser(null)
            setProfileReady(false)
            setLoading(false)
          }
        }
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [stripOAuthArtifacts, ensureUserProfile])

  const signInWithGoogle = async () => {
    if (!supabase) {
      alert('Demo mode: Google Sign-In requires Supabase configuration')
      return
    }

    console.log('🚀 Starting Google Sign-In...')

    // Always use current origin for redirect (works for both localhost and production)
    const redirectTo = window.location.origin
    console.log('🔗 Redirect URL:', redirectTo)

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
      console.error('❌ Sign in error:', error)
      alert('Sign in error: ' + error.message)
    }
  }

  const signOut = async () => {
    if (!supabase) {
      setUser(null)
      setProfileReady(false)
      return
    }

    console.log('👋 Signing out...')
    
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfileReady(false)
      console.log('✅ Signed out')
    } catch (e) {
      console.error('❌ Sign out error:', e)
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
