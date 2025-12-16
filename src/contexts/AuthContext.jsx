import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(!supabase)

  useEffect(() => {
    if (!supabase) {
      // Demo mode - create a fake user
      console.log('🎭 Running in DEMO MODE')
      setUser({
        id: 'demo-user',
        email: 'demo@researchos.app',
        user_metadata: { name: 'Demo User', avatar_url: null }
      })
      setLoading(false)
      return
    }

    console.log('🔐 Initializing authentication...')

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📋 Session check:', session ? '✅ Logged in' : '❌ Not logged in')
      if (session?.user) {
        console.log('👤 User:', session.user.email)
      }
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth event:', event, session?.user ? `✅ ${session.user.email}` : '❌ No user')
        setUser(session?.user ?? null)
        
        // If user just signed in, create their profile
        if (event === 'SIGNED_IN' && session?.user) {
          const { user } = session
          console.log('👤 Creating/updating user profile...')
          const { error } = await supabase.from('users').upsert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture
          })
          
          if (error) {
            console.error('❌ Error creating user profile:', error)
          } else {
            console.log('✅ User profile created/updated')
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    if (!supabase) {
      alert('Demo mode: Google Sign-In requires Supabase configuration')
      return
    }
    
    console.log('🚀 Starting Google Sign-In...')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`
      }
    })
    if (error) {
      console.error('❌ Error signing in:', error)
      alert(`Sign in error: ${error.message}`)
    }
  }

  const signOut = async () => {
    if (!supabase) {
      setUser(null)
      return
    }
    
    console.log('👋 Signing out...')
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('❌ Error signing out:', error)
    } else {
      console.log('✅ Signed out successfully')
    }
  }

  const value = {
    user,
    loading,
    demoMode,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
