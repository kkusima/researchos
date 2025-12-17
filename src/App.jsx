import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { useAuth } from './contexts/AuthContext'
import { db, supabase } from './lib/supabase'
import { 
  Check, Plus, Trash2, Settings, ChevronLeft, ChevronRight, 
  LogOut, Users, Share2, Mail, Clock, FileText, MessageSquare,
  Loader2, Search, MoreVertical, X, Copy, UserPlus, ChevronUp, ChevronDown, GripVertical,
  LayoutGrid, List, Bell, Calendar, AlertCircle
} from 'lucide-react'

// App Context
const AppContext = createContext({})
const useApp = () => useContext(AppContext)

// Constants
const PRIORITIES = [
  { name: 'High', rank: 1, color: '#ef4444' },
  { name: 'Medium', rank: 2, color: '#f59e0b' },
  { name: 'Low', rank: 3, color: '#6b7280' }
]
const EMOJIS = ['🧪', '🔬', '📊', '🧬', '🔥', '💡', '🌱', '⚗️', '🔭', '💻', '📝', '🎯', '🚀', '⚡', '🧠', '🌍']
const STORAGE_KEY = 'researchos_local'

// Helpers
const uuid = () => crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
const getProgress = (p) => p.stages?.length ? (p.current_stage_index + 1) / p.stages.length : 0

// Check if a task/subtask is overdue
const isOverdue = (reminderDate) => {
  if (!reminderDate) return false
  return new Date(reminderDate) < new Date()
}

// Format date for input field
const formatDateForInput = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm format
}

// Format reminder date for display
const formatReminderDate = (dateString) => {
  if (!dateString) return null
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date - now
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMs < 0) {
    // Overdue
    const absDays = Math.abs(diffDays)
    const absHours = Math.abs(diffHours)
    if (absDays >= 1) return `${absDays}d overdue`
    if (absHours >= 1) return `${absHours}h overdue`
    return 'Overdue'
  }
  
  if (diffMins < 60) return `in ${diffMins}m`
  if (diffHours < 24) return `in ${diffHours}h`
  if (diffDays < 7) return `in ${diffDays}d`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Format relative date (e.g., "2h ago", "3d ago", "Jan 5")
const formatRelativeDate = (dateString) => {
  if (!dateString) return null
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Local storage helpers for demo mode
const loadLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}
const saveLocal = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

// ============================================
// LOGIN PAGE
// ============================================
function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, demoMode } = useAuth()
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [resetEmailSent, setResetEmailSent] = useState(false)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')
    await signInWithGoogle()
    setLoading(false)
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setConfirmationSent(false)

    if (isSignUp) {
      const { error, confirmationRequired } = await signUpWithEmail(email, password, name)
      if (error) {
        setError(error.message)
      } else if (confirmationRequired) {
        setConfirmationSent(true)
      }
    } else {
      const { error } = await signInWithEmail(email, password)
      if (error) {
        setError(error.message)
      }
    }
    setLoading(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const { error } = await sendPasswordReset(email)
    if (error) {
      setError(error.message)
    } else {
      setResetEmailSent(true)
    }
    setLoading(false)
  }

  // Show password reset email sent message
  if (resetEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f3f4f6 0%, #6b7280 100%)' }}>
        <div className="glass-card rounded-3xl p-8 w-full max-w-md text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl bg-blue-100">
            🔐
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Check Your Email</h1>
          <p className="text-gray-600 mb-4">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Click the link in the email to reset your password, then come back here to sign in.
          </p>
          <button
            onClick={() => { setResetEmailSent(false); setIsForgotPassword(false); }}
            className="w-full px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-all"
          >
            Back to Sign In
          </button>
        </div>
        <p className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
          © 2025 <a href="http://tinyurl.com/kennethkusima" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline">Kenneth Kusima</a>. All rights reserved.
        </p>
      </div>
    )
  }

  // Show confirmation message after sign up
  if (confirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f3f4f6 0%, #6b7280 100%)' }}>
        <div className="glass-card rounded-3xl p-8 w-full max-w-md text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl bg-green-100">
            ✉️
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Check Your Email</h1>
          <p className="text-gray-600 mb-4">
            We've sent a confirmation link to <strong>{email}</strong>
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Click the link in the email to verify your account, then come back here to sign in.
          </p>
          <button
            onClick={() => { setConfirmationSent(false); setIsSignUp(false); }}
            className="w-full px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-all"
          >
            Back to Sign In
          </button>
        </div>
        <p className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
          © 2025 <a href="http://tinyurl.com/kennethkusima" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline">Kenneth Kusima</a>. All rights reserved.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f3f4f6 0%, #6b7280 100%)' }}>
      <div className="glass-card rounded-3xl p-8 w-full max-w-md text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl" style={{ background: 'linear-gradient(135deg, #e5e7eb, #4b5563)' }}>
          🔬
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">ResearchOS</h1>
        <p className="text-gray-500 mb-6">Collaborative research project management</p>

        {/* Google Sign In - First */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 mb-4"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Sign in with Google
        </button>

        {/* OR Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-400">OR</span>
          </div>
        </div>

        {/* Forgot Password Form */}
        {isForgotPassword ? (
          <>
            <form onSubmit={handleForgotPassword} className="text-left">
              <p className="text-sm text-gray-600 mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2 mb-4">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Send Reset Link
              </button>
            </form>

            <button
              onClick={() => { setIsForgotPassword(false); setError(''); }}
              className="text-sm text-gray-500 hover:text-gray-700 mt-4"
            >
              Back to Sign In
            </button>
          </>
        ) : (
          <>
            {/* Email/Password Form */}
            <form onSubmit={handleEmailSubmit} className="text-left">
              {isSignUp && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                </div>
              )}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
              
              {!isSignUp && (
                <div className="text-right mb-4">
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(''); }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
              
              {isSignUp && <div className="mb-4" />}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2 mb-4">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-semibold hover:bg-gray-700 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-sm text-gray-500 hover:text-gray-700 mt-4"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Need an account? Sign Up"}
            </button>
          </>
        )}

        {demoMode && (
          <p className="mt-4 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
            ⚠️ Running in demo mode. Data saved locally only.
          </p>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
      
      <p className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-gray-400">
        © 2025 <a href="http://tinyurl.com/kennethkusima" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline">Kenneth Kusima</a>. All rights reserved.
      </p>
    </div>
  )
}

// ============================================
// GLOBAL SEARCH COMPONENT
// ============================================
function GlobalSearch({ projects, onNavigate }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [results, setResults] = useState({ projects: [], tasks: [], subtasks: [] })
  const inputRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults({ projects: [], tasks: [], subtasks: [] })
      return
    }

    const q = query.toLowerCase()
    const matchedProjects = []
    const matchedTasks = []
    const matchedSubtasks = []

    projects.forEach(project => {
      // Search projects
      if (project.title.toLowerCase().includes(q)) {
        matchedProjects.push(project)
      }

      // Search tasks and subtasks
      project.stages?.forEach((stage, stageIndex) => {
        stage.tasks?.forEach(task => {
          if (task.title.toLowerCase().includes(q)) {
            matchedTasks.push({ project, stage, stageIndex, task })
          }

          // Search subtasks
          task.subtasks?.forEach(subtask => {
            if (subtask.title.toLowerCase().includes(q)) {
              matchedSubtasks.push({ project, stage, stageIndex, task, subtask })
            }
          })
        })
      })
    })

    setResults({
      projects: matchedProjects.slice(0, 5),
      tasks: matchedTasks.slice(0, 5),
      subtasks: matchedSubtasks.slice(0, 5)
    })
  }, [query, projects])

  const hasResults = results.projects.length > 0 || results.tasks.length > 0 || results.subtasks.length > 0

  const handleSelect = (type, item) => {
    setQuery('')
    setIsOpen(false)
    onNavigate(type, item)
  }

  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search projects, tasks, subtasks..."
        value={query}
        onChange={e => { setQuery(e.target.value); setIsOpen(true) }}
        onFocus={() => setIsOpen(true)}
        className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-xl text-sm focus:bg-white focus:border-gray-300 focus:ring-2 focus:ring-gray-200 transition-all"
      />
      
      {isOpen && query.trim() && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 glass-card rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto animate-fade-in">
            {!hasResults ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No results found for "{query}"
              </div>
            ) : (
              <div className="py-2">
                {/* Projects */}
                {results.projects.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Projects</div>
                    {results.projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => handleSelect('project', { project })}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                      >
                        <span className="text-xl">{project.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{project.title}</div>
                          <div className="text-xs text-gray-500">{project.stages?.length || 0} stages</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Tasks */}
                {results.tasks.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-100 mt-2">Tasks</div>
                    {results.tasks.map(({ project, stage, stageIndex, task }) => (
                      <button
                        key={`${project.id}-${task.id}`}
                        onClick={() => handleSelect('task', { project, task, stageIndex })}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                      >
                        <span className="text-xl">{project.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{task.title}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{project.title}</span>
                            <span className="tag tag-default text-[9px]">{stage.name}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Subtasks */}
                {results.subtasks.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-100 mt-2">Subtasks</div>
                    {results.subtasks.map(({ project, stage, stageIndex, task, subtask }) => (
                      <button
                        key={`${project.id}-${task.id}-${subtask.id}`}
                        onClick={() => handleSelect('task', { project, task, stageIndex })}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                      >
                        <span className="text-xl">{project.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{subtask.title}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span className="truncate">{task.title}</span>
                            <span>•</span>
                            <span className="truncate">{project.title}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// NOTIFICATION PANE
// ============================================
function NotificationPane({ notifications, onMarkRead, onMarkAllRead, onDelete, onClear, onNavigate, onClose }) {
  const unreadCount = notifications.filter(n => !n.is_read).length

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task_reminder':
      case 'subtask_reminder':
        return <Clock className="w-4 h-4 text-amber-500" />
      case 'project_shared':
      case 'project_invite':
        return <Users className="w-4 h-4 text-blue-500" />
      default:
        return <Bell className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-card rounded-xl shadow-xl z-50 animate-fade-in max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !notif.is_read ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => {
                    if (!notif.is_read) onMarkRead(notif.id)
                    if (notif.project_id) onNavigate(notif)
                  }}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{notif.message}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatRelativeDate(notif.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
                      className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ============================================
// REMINDER DATE PICKER
// ============================================
function ReminderPicker({ value, onChange, compact = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const hasReminder = !!value
  const overdue = isOverdue(value)

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
          overdue 
            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
            : hasReminder 
              ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
        }`}
        title={hasReminder ? `Reminder: ${new Date(value).toLocaleString()}` : 'Set reminder'}
      >
        {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
        {!compact && (
          <span>{hasReminder ? formatReminderDate(value) : 'Remind'}</span>
        )}
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
          <div 
            className="absolute top-full left-0 mt-1 glass-card rounded-lg shadow-lg z-50 p-3 min-w-[200px] animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <label className="block text-xs font-medium text-gray-700 mb-2">Set Reminder</label>
            <input
              type="datetime-local"
              value={formatDateForInput(value)}
              onChange={(e) => {
                onChange(e.target.value ? new Date(e.target.value).toISOString() : null)
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
            {hasReminder && (
              <button
                onClick={() => { onChange(null); setIsOpen(false); }}
                className="mt-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Remove reminder
              </button>
            )}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">Quick set:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {[
                  { label: '1h', hours: 1 },
                  { label: '3h', hours: 3 },
                  { label: 'Tomorrow', hours: 24 },
                  { label: '1 week', hours: 168 }
                ].map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => {
                      const date = new Date()
                      date.setHours(date.getHours() + opt.hours)
                      onChange(date.toISOString())
                      setIsOpen(false)
                    }}
                    className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// PROFILE SETTINGS MODAL
// ============================================
function ProfileSettingsModal({ onClose }) {
  const { user, updateProfile, updateEmail, updatePassword, isEmailAuth, demoMode } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // Profile state
  const [name, setName] = useState(user?.user_metadata?.full_name || user?.user_metadata?.name || '')
  
  // Email state
  const [newEmail, setNewEmail] = useState('')
  
  // Password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const showEmailAuth = isEmailAuth()

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const { error } = await updateProfile({ full_name: name, name })
    
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
    }
    setLoading(false)
  }

  const handleUpdateEmail = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    if (!newEmail.trim()) {
      setMessage({ type: 'error', text: 'Please enter a new email address' })
      setLoading(false)
      return
    }

    const { error } = await updateEmail(newEmail)
    
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Confirmation email sent to your new address. Please check your inbox.' })
      setNewEmail('')
    }
    setLoading(false)
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      setLoading(false)
      return
    }

    const { error } = await updatePassword(newPassword)
    
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully!' })
      setNewPassword('')
      setConfirmPassword('')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Account Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('profile'); setMessage({ type: '', text: '' }) }}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'profile' 
                ? 'text-gray-900 border-b-2 border-gray-900' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Profile
          </button>
          {showEmailAuth && (
            <>
              <button
                onClick={() => { setActiveTab('email'); setMessage({ type: '', text: '' }) }}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'email' 
                    ? 'text-gray-900 border-b-2 border-gray-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => { setActiveTab('password'); setMessage({ type: '', text: '' }) }}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'password' 
                    ? 'text-gray-900 border-b-2 border-gray-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Password
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
            }`}>
              {message.text}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleUpdateProfile}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {showEmailAuth ? 'Change email in the Email tab' : 'Managed by Google'}
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </form>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && showEmailAuth && (
            <form onSubmit={handleUpdateEmail}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newemail@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">A confirmation link will be sent to your new email</p>
              </div>
              <button
                type="submit"
                disabled={loading || demoMode}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Email
              </button>
            </form>
          )}

          {/* Password Tab */}
          {activeTab === 'password' && showEmailAuth && (
            <form onSubmit={handleUpdatePassword}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading || demoMode}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// HEADER
// ============================================
function Header({ projects, onSearchNavigate, notifications, onMarkNotificationRead, onMarkAllNotificationsRead, onDeleteNotification, onClearAllNotifications, onNotificationNavigate }) {
  const { user, signOut, demoMode, isEmailAuth } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
  const unreadCount = notifications?.filter(n => !n.is_read).length || 0

  return (
    <>
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-base sm:text-lg" style={{ background: 'linear-gradient(135deg, #e5e7eb, #4b5563)' }}>
                🔬
              </div>
              <span className="font-bold text-lg sm:text-xl text-gray-900 hidden sm:block">ResearchOS</span>
              {demoMode && (
                <span className="tag tag-warning text-[10px] hidden sm:inline-flex">DEMO</span>
              )}
            </div>

            {/* Global Search */}
            <GlobalSearch projects={projects} onNavigate={onSearchNavigate} />

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors relative"
                >
                  <Bell className="w-5 h-5 text-gray-500" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                
                {showNotifications && (
                  <NotificationPane
                    notifications={notifications || []}
                    onMarkRead={onMarkNotificationRead}
                    onMarkAllRead={onMarkAllNotificationsRead}
                    onDelete={onDeleteNotification}
                    onClear={onClearAllNotifications}
                    onNavigate={(notif) => {
                      setShowNotifications(false)
                      onNotificationNavigate(notif)
                    }}
                    onClose={() => setShowNotifications(false)}
                  />
                )}
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-2 sm:gap-3 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={userName} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="avatar text-sm">{userName[0]?.toUpperCase()}</div>
                  )}
                  <span className="font-medium text-gray-700 hidden md:block">{userName}</span>
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 mt-2 w-56 glass-card rounded-xl shadow-lg z-50 py-2 animate-fade-in">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{userName}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        {!isEmailAuth() && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Signed in with Google
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => { setShowMenu(false); setShowSettings(true); }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Account Settings
                      </button>
                      <button
                        onClick={signOut}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {showSettings && <ProfileSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}

// ============================================
// TAB NAVIGATION
// ============================================
function TabNav({ tab, setTab }) {
  return (
    <div className="bg-white/60 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1">
          {[
            { id: 'projects', label: 'Projects', icon: '◫' },
            { id: 'tasks', label: 'All Tasks', icon: '✓' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-4 font-medium text-sm border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

// ============================================
// PROJECTS VIEW
// ============================================
function ProjectsView() {
  const { projects, setProjects, setView, setSelectedProject, loading, reorderProjects } = useApp()
  const { user, demoMode } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [sortOption, setSortOption] = useState('priority')
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'
  const [showReorder, setShowReorder] = useState(false)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedProjectIDs, setSelectedProjectIDs] = useState(new Set())

  const handleSortChange = (newOption) => {
    if (newOption === sortOption) {
      // Toggle direction if same option clicked
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortOption(newOption)
      setSortDirection('asc')
    }
  }

  const computeSorted = () => {
    const sorted = [...projects]
    const dir = sortDirection === 'asc' ? 1 : -1
    switch (sortOption) {
      case 'priority':
        return sorted.sort((a, b) => {
          if (a.priority_rank === b.priority_rank) return a.title.localeCompare(b.title)
          return (a.priority_rank - b.priority_rank) * dir
        })
      case 'progress':
        return sorted.sort((a, b) => {
          const progressA = getProgress(a)
          const progressB = getProgress(b)
          if (progressA === progressB) return a.title.localeCompare(b.title)
          return (progressA - progressB) * dir
        })
      case 'created':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime()
          const dateB = new Date(b.created_at || 0).getTime()
          return (dateA - dateB) * dir
        })
      case 'modified':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.updated_at || a.created_at || 0).getTime()
          const dateB = new Date(b.updated_at || b.created_at || 0).getTime()
          return (dateA - dateB) * dir
        })
      default:
        return sorted
    }
  }

  const sortedProjects = computeSorted()

  const handleReorder = (newOrder) => {
    const updated = newOrder.map((p, i) => ({ ...p, priority_rank: i + 1 }))
    reorderProjects(updated)
    setShowReorder(false)
  }

  const handleBulkDelete = () => {
    const toDelete = Array.from(selectedProjectIDs)
    if (toDelete.length === 0) return
    if (!window.confirm(`Delete ${toDelete.length} project(s) and all their data?`)) return
    
    if (demoMode) {
      setProjects(projects.filter(p => !selectedProjectIDs.has(p.id)))
    } else {
      // In real mode, delete each
      toDelete.forEach(id => db.deleteProject(id))
      setProjects(projects.filter(p => !selectedProjectIDs.has(p.id)))
    }
    setSelectedProjectIDs(new Set())
    setIsSelectionMode(false)
  }

  const deleteProject = async (id) => {
    if (!window.confirm('Delete this project and all its data?')) return
    
    if (demoMode) {
      setProjects(projects.filter(p => p.id !== id))
    } else {
      await db.deleteProject(id)
      setProjects(projects.filter(p => p.id !== id))
    }
  }

  const duplicateProject = async (projectToDuplicate) => {
    // Create new IDs for the duplicated project and its stages/tasks
    const newProjectId = uuid()
    const newPriorityRank = projects.length + 1
    const now = new Date().toISOString()
    
    const duplicatedProject = {
      ...projectToDuplicate,
      id: newProjectId,
      title: `${projectToDuplicate.title} (Copy)`,
      priority_rank: newPriorityRank,
      created_at: now,
      updated_at: now,
      owner_id: user?.id || 'demo',
      project_members: [],
      stages: projectToDuplicate.stages?.map(stage => ({
        ...stage,
        id: uuid(),
        tasks: stage.tasks?.map(task => ({
          ...task,
          id: uuid(),
          created_at: now,
          updated_at: now,
          subtasks: task.subtasks?.map(st => ({ ...st, id: uuid() })) || [],
          comments: []
        })) || []
      })) || []
    }

    if (demoMode) {
      setProjects([...projects, duplicatedProject])
      saveLocal([...projects, duplicatedProject])
    } else {
      // Create project in Supabase
      const { data: createdProject, error: projectError } = await db.createProject({
        title: duplicatedProject.title,
        emoji: duplicatedProject.emoji,
        priority_rank: duplicatedProject.priority_rank,
        current_stage_index: duplicatedProject.current_stage_index,
        owner_id: user.id
      })

      if (projectError || !createdProject) {
        console.error('Failed to duplicate project:', projectError)
        return
      }

      // Create stages and tasks
      for (const stage of duplicatedProject.stages) {
        const { data: createdStage, error: stageError } = await db.createStage({
          project_id: createdProject.id,
          name: stage.name,
          order_index: stage.order_index
        })

        if (stageError || !createdStage) {
          console.error('Failed to create stage:', stageError)
          continue
        }

        // Create tasks for this stage
        for (const task of stage.tasks || []) {
          await db.createTask({
            stage_id: createdStage.id,
            title: task.title,
            description: task.description || '',
            is_completed: task.is_completed || false,
            reminder_date: task.reminder_date,
            order_index: task.order_index || 0
          })
        }
      }

      // Refresh projects list
      const { data: refreshed } = await db.getProjects(user.id)
      if (refreshed) setProjects(refreshed)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col gap-4 mb-6 sm:mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Projects</h1>
            <p className="text-gray-500 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)} className="btn-gradient flex items-center gap-2 whitespace-nowrap text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Project</span>
            </button>
          </div>
        </div>
        
        {/* Controls row - scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          
          {/* Sort options */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {[{ key: 'priority', label: 'Priority' }, { key: 'progress', label: 'Progress' }, { key: 'created', label: 'Created' }, { key: 'modified', label: 'Modified' }].map(opt => (
              <button
                key={opt.key}
                onClick={() => handleSortChange(opt.key)}
                className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap ${
                  sortOption === opt.key
                    ? 'bg-gray-200 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
                {sortOption === opt.key && (
                  sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
          
          <button onClick={() => setShowReorder(true)} className="btn-gradient flex items-center gap-2 whitespace-nowrap flex-shrink-0 text-sm px-3 py-2">
            <MoreVertical className="w-4 h-4" />
            <span className="hidden sm:inline">Reorder</span>
          </button>
        </div>
      </div>

      {sortedProjects.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
          <div className="text-5xl sm:text-6xl mb-4">🔬</div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No projects yet</h2>
          <p className="text-gray-500 mb-6 text-sm sm:text-base">Create your first research project to get started</p>
          <button onClick={() => setShowCreate(true)} className="btn-gradient">
            Create Project
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-2 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project, i) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              index={i}
              onSelect={() => { setSelectedProject(project); setView('project'); }}
              onDelete={() => deleteProject(project.id)}
              onDuplicate={() => duplicateProject(project)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedProjects.map((project, i) => (
            <ProjectListItem 
              key={project.id} 
              project={project} 
              index={i}
              onSelect={() => { setSelectedProject(project); setView('project'); }}
              onDelete={() => deleteProject(project.id)}
              onDuplicate={() => duplicateProject(project)}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}

      {showReorder && (
        <ReorderModal 
          projects={sortedProjects} 
          onReorder={handleReorder} 
          onClose={() => setShowReorder(false)} 
        />
      )}
    </div>
  )
}

// ============================================
// REORDER MODAL
// ============================================
function ReorderModal({ projects, onReorder, onClose }) {
  const [workingProjects, setWorkingProjects] = useState([...projects])
  const [draggedIndex, setDraggedIndex] = useState(null)

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    const dragIndex = draggedIndex
    if (dragIndex === dropIndex) return

    const newProjects = [...workingProjects]
    const [draggedItem] = newProjects.splice(dragIndex, 1)
    newProjects.splice(dropIndex, 0, draggedItem)
    setWorkingProjects(newProjects)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Reorder Priorities</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-4">Drag to reorder projects by priority (1 = highest)</p>
          <div className="space-y-3">
            {workingProjects.map((project, index) => (
              <div 
                key={project.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 glass-card rounded-lg cursor-move transition-all duration-200 ${
                  draggedIndex === index ? 'opacity-50 scale-95' : ''
                }`}
              >
                <GripVertical className="w-5 h-5 text-gray-400" />
                <span className="text-2xl">{project.emoji}</span>
                <span className="font-medium text-gray-900 flex-1">{project.title}</span>
                <span className="text-sm text-gray-500">#{index + 1}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => onReorder(workingProjects)} className="flex-1 btn-gradient">
              Save Order
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PRIORITY BADGE COMPONENT
// ============================================
function PriorityBadge({ rank }) {
  return (
    <span 
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white bg-gray-400"
      title={`Priority ${rank}`}
    >
      {rank}
    </span>
  )
}

// ============================================
// PROJECT CARD (Grid View)
// ============================================
function ProjectCard({ project, index, onSelect, onDelete, onDuplicate }) {
  const { user } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const progress = getProgress(project)
  const currentStage = project.stages?.[project.current_stage_index]
  const isShared = project.owner_id !== user?.id
  const isComplete = progress >= 1

  return (
    <div
      className={`glass-card glass-card-hover rounded-xl sm:rounded-2xl p-3 sm:p-5 cursor-pointer relative animate-fade-in ${isComplete ? 'bg-green-50/80 border-green-200' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onSelect}
    >
      {/* Mobile: Compact horizontal layout */}
      <div className="sm:hidden">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{project.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-gray-900 truncate">{project.title}</h3>
              <PriorityBadge rank={project.priority_rank} />
              {isShared && (
                <span className="tag bg-blue-100 text-blue-600 text-[8px] px-1.5 py-0.5">
                  <Share2 className="w-2 h-2" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`tag text-[9px] py-0.5 px-1.5 ${isComplete ? 'bg-green-100 text-green-700' : 'tag-default'}`}>{isComplete ? '✓ Complete' : currentStage?.name || 'No stage'}</span>
              <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isComplete ? 'bg-green-200' : 'bg-gray-200'}`}>
                <div className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-gray-300 to-gray-500'}`} style={{ width: `${progress * 100}%` }} />
              </div>
              <span className={`text-[10px] font-medium ${isComplete ? 'text-green-600' : 'text-gray-500'}`}>{Math.round(progress * 100)}%</span>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Desktop: Original layout */}
      <div className="hidden sm:block">
        {/* Priority Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <PriorityBadge rank={project.priority_rank} />
          {isShared && (
            <span className="tag bg-blue-100 text-blue-600 text-[9px]">
              <Share2 className="w-2.5 h-2.5 mr-0.5" />
              Shared
            </span>
          )}
        </div>
        
        <div className="flex items-start gap-4 mb-4 mt-6">
          <span className="text-4xl">{project.emoji}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-gray-900 truncate">{project.title}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="tag tag-default">{currentStage?.name || 'No stage'}</span>
              {project.project_members?.length > 0 && (
                <span className="tag tag-primary flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {project.project_members.length + 1}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-4 ${isComplete ? 'bg-green-100' : 'bg-gray-100'}`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-xs font-medium ${isComplete ? 'text-green-600' : 'text-gray-500'}`}>{isComplete ? '✓ Complete' : 'Progress'}</span>
            <span className={`text-sm font-bold ${isComplete ? 'text-green-700' : 'text-gray-900'}`}>{Math.round(progress * 100)}%</span>
          </div>
          <div className={`progress-bar ${isComplete ? 'bg-green-200' : ''}`}>
            <div className={isComplete ? 'h-full bg-green-500 rounded' : 'progress-bar-fill'} style={{ width: `${progress * 100}%` }} />
          </div>
          {/* Timestamps */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
            {project.created_at && (
              <span className="text-[10px] text-gray-400" title={`Created: ${new Date(project.created_at).toLocaleString()}`}>
                Created {formatRelativeDate(project.created_at)}
              </span>
            )}
            {project.updated_at && project.updated_at !== project.created_at && (
              <span className="text-[10px] text-gray-400" title={`Modified: ${new Date(project.updated_at).toLocaleString()}`}>
                Modified {formatRelativeDate(project.updated_at)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setShowMenu(false); }} />
          <div className="absolute top-8 sm:top-12 right-2 sm:right-4 glass-card rounded-xl shadow-lg z-50 py-1 min-w-[140px] animate-fade-in" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => { setShowMenu(false); onDuplicate(); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>
            <button 
              onClick={() => { setShowMenu(false); onDelete(); }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// PROJECT LIST ITEM (List View)
// ============================================
function ProjectListItem({ project, index, onSelect, onDelete, onDuplicate }) {
  const { user } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const progress = getProgress(project)
  const currentStage = project.stages?.[project.current_stage_index]
  const totalStages = project.stages?.length || 0
  const completedStages = project.current_stage_index || 0
  const isShared = project.owner_id !== user?.id
  const isComplete = progress >= 1

  return (
    <div
      className={`glass-card glass-card-hover rounded-xl p-3 sm:p-4 cursor-pointer relative animate-fade-in overflow-visible ${isComplete ? 'bg-green-50/80 border-green-200' : ''}`}
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Priority Badge */}
        <PriorityBadge rank={project.priority_rank} />
        
        {/* Emoji */}
        <span className="text-xl sm:text-2xl flex-shrink-0">{project.emoji}</span>
        
        {/* Title and Stage - Takes most space */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">{project.title}</h3>
            {isShared && (
              <span className="tag bg-blue-100 text-blue-600 text-[9px] hidden sm:inline-flex">
                <Share2 className="w-2.5 h-2.5 mr-0.5" />
                Shared
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500">{currentStage?.name || 'No stage'}</span>
            {isShared && (
              <span className="text-[9px] text-blue-500 sm:hidden">Shared</span>
            )}
            {project.project_members?.length > 0 && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {project.project_members.length + 1}
              </span>
            )}
            <span className="text-[10px] text-gray-300 hidden sm:inline">•</span>
            {project.updated_at ? (
              <span className="text-[10px] text-gray-400 hidden sm:inline" title={`Modified: ${new Date(project.updated_at).toLocaleString()}`}>
                {formatRelativeDate(project.updated_at)}
              </span>
            ) : project.created_at && (
              <span className="text-[10px] text-gray-400 hidden sm:inline" title={`Created: ${new Date(project.created_at).toLocaleString()}`}>
                {formatRelativeDate(project.created_at)}
              </span>
            )}
          </div>
        </div>
        
        {/* Progress - Compact display */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Stage Progress Dots */}
          <div className="hidden lg:flex items-center gap-1" title={`Stage ${completedStages + 1} of ${totalStages}`}>
            {project.stages?.slice(0, 7).map((stage, i) => (
              <div
                key={stage.id}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < completedStages 
                    ? 'bg-green-500' 
                    : i === completedStages 
                      ? 'bg-blue-500' 
                      : 'bg-gray-200'
                }`}
                title={stage.name}
              />
            ))}
            {totalStages > 7 && (
              <span className="text-xs text-gray-400">+{totalStages - 7}</span>
            )}
          </div>
          
          {/* Percentage */}
          <div className="hidden sm:flex items-center gap-2 min-w-[60px]">
            <div className={`w-12 h-1.5 rounded-full overflow-hidden ${isComplete ? 'bg-green-200' : 'bg-gray-200'}`}>
              <div 
                className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-green-500'}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className={`text-xs font-medium w-8 ${isComplete ? 'text-green-600' : 'text-gray-600'}`}>{Math.round(progress * 100)}%</span>
          </div>
        </div>
        
        {/* Menu Button */}
        <button
          onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setShowMenu(false); }} />
          <div className="absolute top-12 right-4 glass-card rounded-xl shadow-lg z-50 py-1 min-w-[140px] animate-fade-in" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => { setShowMenu(false); onDuplicate(); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>
            <button 
              onClick={() => { setShowMenu(false); onDelete(); }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// CREATE PROJECT MODAL
// ============================================
function CreateProjectModal({ onClose }) {
  const { projects, setProjects } = useApp()
  const { user, demoMode, profileReady } = useAuth()
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🧪')
  const [stages, setStages] = useState(['Ideation', 'Experiments', 'Analysis', 'Writing', 'Publication'])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [draggedIndex, setDraggedIndex] = useState(null)

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    const dragIndex = draggedIndex
    if (dragIndex === null || dragIndex === dropIndex) return

    const newStages = [...stages]
    const [draggedItem] = newStages.splice(dragIndex, 1)
    newStages.splice(dropIndex, 0, draggedItem)
    setStages(newStages)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleCreate = async () => {
    if (!title.trim() || stages.length === 0) return
    setLoading(true)
    setErrorMsg('')

    // New projects get lowest priority (highest number = added to end)
    const newPriorityRank = projects.length + 1
    const now = new Date().toISOString()

    const newProject = {
      id: uuid(),
      title: title.trim(),
      emoji,
      priority_rank: newPriorityRank,
      current_stage_index: 0,
      owner_id: user?.id || 'demo',
      created_at: now,
      updated_at: now,
      stages: stages.map((name, i) => ({
        id: uuid(),
        name,
        order_index: i,
        tasks: []
      })),
      project_members: []
    }

    if (demoMode) {
      setProjects([...projects, newProject])
      saveLocal([...projects, newProject])
    } else {
      // Check if user profile is ready (required for FK constraint)
      if (!profileReady) {
        setErrorMsg('User profile not ready. Please wait a moment and try again.')
        setLoading(false)
        return
      }

      // In real mode, create in Supabase
      console.log('📝 Creating project in Supabase...')
      const { data, error } = await db.createProject({
        title: newProject.title,
        emoji: newProject.emoji,
        priority_rank: newProject.priority_rank,
        current_stage_index: 0,
        owner_id: user.id
      })

      if (error || !data) {
        console.error('❌ Create project failed:', error)
        setErrorMsg(error?.message || 'Failed to create project in Supabase.')
        setLoading(false)
        return
      }

      console.log('✅ Project created:', data.id)

      // Create stages
      for (const stage of newProject.stages) {
        const { error: stageError } = await db.createStage({
          project_id: data.id,
          name: stage.name,
          order_index: stage.order_index,
        })
        if (stageError) {
          console.error('❌ Create stage failed:', stageError)
          setErrorMsg(stageError?.message || `Failed to create stage: ${stage.name}`)
          setLoading(false)
          return
        }
      }

      // Refresh projects
      const { data: refreshed, error: refreshError } = await db.getProjects(user.id)
      if (refreshError) {
        setErrorMsg(refreshError?.message || 'Project created, but failed to refresh projects.')
        setLoading(false)
        return
      }
      if (refreshed) setProjects(refreshed)
    }

    setLoading(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">New Project</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {errorMsg && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Title</label>
            <input
              type="text"
              placeholder="Enter project title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="input-sleek"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`text-2xl p-2 rounded-lg transition-all ${
                    emoji === e ? 'bg-brand-100 ring-2 ring-brand-500' : 'hover:bg-gray-100'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Workflow Stages</label>
            <div className="space-y-2">
              {stages.map((stage, i) => (
                <div 
                  key={i} 
                  className={`flex gap-2 items-center p-2 rounded-lg border-2 transition-all ${
                    draggedIndex === i ? 'border-brand-500 bg-brand-50 opacity-50' : 'border-transparent'
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="cursor-move text-gray-400 mr-2">
                    <MoreVertical className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={stage}
                    onChange={e => {
                      const newStages = [...stages]
                      newStages[i] = e.target.value
                      setStages(newStages)
                    }}
                    className="input-sleek flex-1"
                  />
                  <button
                    onClick={() => setStages(stages.filter((_, j) => j !== i))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    disabled={stages.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setStages([...stages, 'New Stage'])}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-brand-500 hover:text-brand-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Stage
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button onClick={onClose} className="flex-1 py-3 px-4 border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || stages.length === 0 || loading}
            className="flex-1 btn-gradient disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PROJECT DETAIL VIEW
// ============================================
function ProjectDetail() {
  const { projects, setProjects, selectedProject, setSelectedProject, setView, setSelectedTask } = useApp()
  const { demoMode, user } = useAuth()
  const [previewIndex, setPreviewIndex] = useState(null)
  const [newTask, setNewTask] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showShare, setShowShare] = useState(false)

  if (!selectedProject) return null
  
  const project = projects.find(p => p.id === selectedProject.id) || selectedProject
  const currentStageIndex = project.current_stage_index ?? 0
  const stageIndex = previewIndex ?? currentStageIndex
  const stage = project.stages?.[stageIndex]
  const progress = getProgress(project)
  const isShared = project.owner_id !== user?.id

  const updateProject = (updated) => {
    const newProjects = projects.map(p => p.id === updated.id ? updated : p)
    setProjects(newProjects)
    setSelectedProject(updated)
    if (demoMode) saveLocal(newProjects)
  }

  const setCurrentStage = async (indexToSet = previewIndex) => {
    if (indexToSet === null || indexToSet === undefined) return
    const updated = { ...project, current_stage_index: indexToSet }
    updateProject(updated)
    if (!demoMode) await db.updateProject(project.id, { current_stage_index: indexToSet })
    setPreviewIndex(null)
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    const now = new Date().toISOString()
    const localId = uuid()
    const task = {
      id: localId,
      title: newTask.trim(),
      description: '',
      is_completed: false,
      reminder_date: null,
      subtasks: [],
      comments: [],
      created_at: now,
      updated_at: now
    }

    const updated = {
      ...project,
      stages: project.stages.map((s, i) => 
        i === stageIndex ? { ...s, tasks: [...(s.tasks || []), task] } : s
      )
    }
    updateProject(updated)
    setNewTask('')

    if (!demoMode) {
      const { data: createdTask } = await db.createTask({
        stage_id: stage.id,
        title: task.title,
        order_index: stage.tasks?.length || 0
      })
      
      // Update local state with server-generated ID
      if (createdTask) {
        const syncedProject = {
          ...project,
          stages: project.stages.map((s, i) => 
            i === stageIndex 
              ? { ...s, tasks: s.tasks.map(t => t.id === localId ? { ...t, id: createdTask.id } : t) }
              : s
          )
        }
        const newProjects = projects.map(p => p.id === project.id ? syncedProject : p)
        setProjects(newProjects)
        setSelectedProject(syncedProject)
      }
    }
  }

  const toggleTask = async (taskId) => {
    const task = stage.tasks.find(t => t.id === taskId)
    if (!task) return
    
    const now = new Date().toISOString()
    const updated = {
      ...project,
      updated_at: now,
      stages: project.stages.map((s, i) => 
        i === stageIndex 
          ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, is_completed: !t.is_completed, updated_at: now } : t) }
          : s
      )
    }
    updateProject(updated)

    if (!demoMode) {
      await db.updateTask(taskId, { is_completed: !task.is_completed })
    }
  }

  const deleteTask = async (taskId) => {
    const updated = {
      ...project,
      stages: project.stages.map((s, i) => 
        i === stageIndex ? { ...s, tasks: s.tasks.filter(t => t.id !== taskId) } : s
      )
    }
    updateProject(updated)

    if (!demoMode) {
      await db.deleteTask(taskId)
    }
  }

  const updateTaskReminder = async (taskId, reminderDate) => {
    const now = new Date().toISOString()
    const updated = {
      ...project,
      stages: project.stages.map((s, i) => 
        i === stageIndex 
          ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, reminder_date: reminderDate, updated_at: now } : t) }
          : s
      )
    }
    updateProject(updated)

    if (!demoMode) {
      await db.updateTask(taskId, { reminder_date: reminderDate })
    }
  }

  // Sort tasks: overdue first, then by reminder date, then others
  const sortedTasks = [...(stage?.tasks || [])].sort((a, b) => {
    const aOverdue = isOverdue(a.reminder_date) && !a.is_completed
    const bOverdue = isOverdue(b.reminder_date) && !b.is_completed
    
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    
    if (a.reminder_date && b.reminder_date) {
      return new Date(a.reminder_date) - new Date(b.reminder_date)
    }
    if (a.reminder_date) return -1
    if (b.reminder_date) return 1
    
    return 0
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-16">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => { setView('main'); setSelectedProject(null); }}
              className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-2xl sm:text-4xl">{project.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{project.title}</h1>
                {isShared && (
                  <span className="tag bg-blue-100 text-blue-600 text-[9px]">
                    <Share2 className="w-2.5 h-2.5 mr-0.5" />
                    Shared
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="tag tag-default text-[10px] sm:text-[11px]">{project.stages?.[currentStageIndex]?.name}</span>
                <span className="text-xs sm:text-sm text-gray-500">{Math.round(progress * 100)}% complete</span>
              </div>
            </div>
            {/* Timestamps */}
            <div className="hidden md:flex flex-col items-end text-[10px] text-gray-400 mr-2">
              {project.created_at && (
                <span title={new Date(project.created_at).toLocaleString()}>
                  Created {formatRelativeDate(project.created_at)}
                </span>
              )}
              {project.updated_at && project.updated_at !== project.created_at && (
                <span title={new Date(project.updated_at).toLocaleString()}>
                  Modified {formatRelativeDate(project.updated_at)}
                </span>
              )}
            </div>
            <button onClick={() => setShowShare(true)} className="p-2 hover:bg-gray-100 rounded-lg">
              <Share2 className="w-5 h-5 text-gray-500" />
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Stage Selector */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stages</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {project.stages?.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center">
                <button
                  onClick={() => {
                    if (previewIndex === i && i !== currentStageIndex) {
                      // Second click on previewed non-current stage - set as current
                      setCurrentStage(i)
                    } else {
                      setPreviewIndex(i)
                    }
                  }}
                  className={`stage-pill ${
                    i === currentStageIndex ? 'active' : 
                    previewIndex === i ? 'preview' : ''
                  }`}
                >
                  {s.name}
                  {i === currentStageIndex && (
                    <span className="block text-[10px] opacity-70 mt-0.5">Current</span>
                  )}
                  {previewIndex === i && i !== currentStageIndex && (
                    <span className="block text-[10px] text-brand-600 font-semibold mt-0.5">Click to set current</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Tasks for {stage?.name}
          </h2>
        </div>

        {/* Add Task Input */}
        <div className="glass-card rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
          <Plus className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Add a new task..."
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 min-w-0"
          />
          <button
            onClick={addTask}
            disabled={!newTask.trim()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-30 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #e5e7eb, #4b5563)' }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {sortedTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No tasks yet. Add one above!
            </div>
          ) : (
            sortedTasks.map((task, i) => {
              const taskOverdue = isOverdue(task.reminder_date) && !task.is_completed
              return (
                <div
                  key={task.id}
                  className={`glass-card glass-card-hover rounded-xl p-3 sm:p-4 animate-fade-in transition-all ${
                    taskOverdue ? 'bg-red-50/80 border-l-4 border-l-red-400' : ''
                  }`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`checkbox-custom mt-0.5 flex-shrink-0 ${task.is_completed ? 'checked' : ''}`}
                    >
                      {task.is_completed && <Check className="w-3 h-3" />}
                    </button>
                    <div 
                      className="flex-1 cursor-pointer min-w-0"
                      onClick={() => { setSelectedTask({ task, stageIndex }); setView('task'); }}
                    >
                      <div className={`font-medium ${task.is_completed ? 'line-through text-gray-400' : taskOverdue ? 'text-red-700' : 'text-gray-900'}`}>
                        {task.title}
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                        {task.subtasks?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length}
                          </span>
                        )}
                        {task.comments?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {task.comments.length}
                          </span>
                        )}
                        {task.updated_at ? (
                          <span className="text-gray-300 hidden sm:inline" title={`Modified: ${new Date(task.updated_at).toLocaleString()}`}>
                            {formatRelativeDate(task.updated_at)}
                          </span>
                        ) : task.created_at && (
                          <span className="text-gray-300 hidden sm:inline" title={`Created: ${new Date(task.created_at).toLocaleString()}`}>
                            {formatRelativeDate(task.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <ReminderPicker
                        value={task.reminder_date}
                        onChange={(date) => updateTaskReminder(task.id, date)}
                        compact
                      />
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {showSettings && (
        <ProjectSettingsModal 
          project={project} 
          onClose={() => setShowSettings(false)} 
          onUpdate={updateProject}
          onDelete={async () => {
            if (!window.confirm('Delete this project and all its data?')) return
            if (demoMode) {
              const newProjects = projects.filter(p => p.id !== project.id)
              setProjects(newProjects)
              saveLocal(newProjects)
            } else {
              await db.deleteProject(project.id)
              setProjects(projects.filter(p => p.id !== project.id))
            }
            setSelectedProject(null)
            setView('main')
          }}
        />
      )}

      {showShare && (
        <ShareModal
          project={project}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}

// ============================================
// PROJECT SETTINGS MODAL
// ============================================
function ProjectSettingsModal({ project, onClose, onUpdate, onDelete }) {
  const { demoMode } = useAuth()
  const [title, setTitle] = useState(project.title)
  const [emoji, setEmoji] = useState(project.emoji)
  const [stages, setStages] = useState([...project.stages])
  const [loading, setLoading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    const dragIndex = draggedIndex
    if (dragIndex === null || dragIndex === dropIndex) return

    const newStages = [...stages]
    const [draggedItem] = newStages.splice(dragIndex, 1)
    newStages.splice(dropIndex, 0, draggedItem)
    setStages(newStages)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleSave = async () => {
    setLoading(true)
    // Update order_index for all stages based on current order
    const updatedStages = stages.map((stage, index) => ({
      ...stage,
      order_index: index
    }))
    
    // Find the new index of the stage that was previously current
    // We track by stage ID to maintain the current stage even after reordering
    const previousCurrentStage = project.stages[project.current_stage_index ?? 0]
    let newCurrentStageIndex = updatedStages.findIndex(s => s.id === previousCurrentStage?.id)
    if (newCurrentStageIndex === -1) {
      // If the current stage was deleted, default to 0
      newCurrentStageIndex = 0
    }
    
    const updated = {
      ...project,
      title,
      emoji,
      stages: updatedStages,
      current_stage_index: newCurrentStageIndex
    }
    onUpdate(updated)

    if (!demoMode) {
      await db.updateProject(project.id, { title, emoji, current_stage_index: newCurrentStageIndex })
    }

    setLoading(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Project Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="input-sleek"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`text-2xl p-2 rounded-lg transition-all ${
                    emoji === e ? 'bg-brand-100 ring-2 ring-brand-500' : 'hover:bg-gray-100'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stages</label>
            <div className="space-y-2">
              {stages.map((stage, i) => (
                <div 
                  key={stage.id} 
                  className={`flex gap-2 items-center p-2 rounded-lg border-2 transition-all ${
                    draggedIndex === i ? 'border-brand-500 bg-brand-50 opacity-50' : 'border-transparent'
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="cursor-move text-gray-400 mr-2">
                    <MoreVertical className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={stage.name}
                    onChange={e => {
                      const newStages = [...stages]
                      newStages[i] = { ...newStages[i], name: e.target.value }
                      setStages(newStages)
                    }}
                    className="input-sleek flex-1"
                  />
                  {stages.length > 1 && (
                    <button
                      onClick={() => setStages(stages.filter((_, j) => j !== i))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setStages([...stages, { id: uuid(), name: 'New Stage', tasks: [] }])}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-brand-500 hover:text-brand-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Stage
              </button>
            </div>
          </div>

        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button onClick={onClose} className="flex-1 py-3 px-4 border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 btn-gradient flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>

        {/* Danger Zone - Below buttons */}
        <div className="px-6 pb-6">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3 px-4 border-2 border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Project
            </button>
          ) : (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 mb-3 text-center">
                Are you sure you want to delete <strong>{project.title}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onClose(); onDelete(); }}
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// SHARE MODAL
// ============================================
function ShareModal({ project, onClose, onUpdate }) {
  const { demoMode, user } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [members, setMembers] = useState(project.project_members || [])
  const [pendingInvites, setPendingInvites] = useState([])
  const [loadingInvites, setLoadingInvites] = useState(true)

  // Load pending invitations
  useEffect(() => {
    const loadInvites = async () => {
      if (demoMode) {
        setLoadingInvites(false)
        return
      }
      const { data } = await db.getProjectInvitations(project.id)
      setPendingInvites(data || [])
      setLoadingInvites(false)
    }
    loadInvites()
  }, [project.id, demoMode])

  const handleShare = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    setInviteLink('')

    if (demoMode) {
      setError('Sharing requires Supabase to be configured')
      setLoading(false)
      return
    }

    const result = await db.shareProject(project.id, email.trim(), 'editor', user?.id)
    
    if (result.error) {
      setError(result.error.message || 'Failed to share project')
    } else if (result.type === 'invited') {
      // User doesn't exist - invitation created
      const link = `${window.location.origin}?invite=${result.data.token}`
      setInviteLink(link)
      setSuccess(`${email} hasn't joined ResearchOS yet. Share the invite link below!`)
      setPendingInvites(prev => [...prev, result.data])
      setEmail('')
    } else if (result.type === 'existing') {
      // Invitation already exists - show the link again
      const link = `${window.location.origin}?invite=${result.data.token}`
      setInviteLink(link)
      setSuccess(result.message || `Invitation already sent! Here's the link:`)
      setEmail('')
    } else {
      // User exists - added directly
      setSuccess(`${email} has been added to the project!`)
      setEmail('')
      if (result.data) {
        setMembers(prev => [...prev, result.data])
      }
    }
    setLoading(false)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink)
    setSuccess('Invite link copied to clipboard!')
  }

  const handleCancelInvite = async (inviteId) => {
    const { error } = await db.cancelInvitation(inviteId)
    if (!error) {
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId))
    }
  }

  const handleRemoveMember = async (userId) => {
    if (demoMode) return
    
    const { error } = await db.removeProjectMember(project.id, userId)
    if (!error) {
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    }
  }

  const isOwner = project.owner_id === user?.id

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card rounded-2xl w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white/90 backdrop-blur">
          <h2 className="text-xl font-bold text-gray-900">Share Project</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-500 text-sm mb-4">
            Invite collaborators to work on "{project.title}" with you.
          </p>

          {isOwner && (
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleShare()}
                  className="input-sleek pl-10"
                />
              </div>
              <button
                onClick={handleShare}
                disabled={!email.trim() || loading}
                className="btn-gradient flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Invite
              </button>
            </div>
          )}

          {!isOwner && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3 mb-4">
              Only the project owner can invite new members.
            </p>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</p>}
          {success && <p className="text-sm text-green-600 bg-green-50 rounded-lg p-3 mb-4">{success}</p>}
          
          {inviteLink && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 font-medium mb-2">📧 Share this invite link:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="input-sleek text-xs flex-1 bg-white"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                When they sign in with this link, they'll automatically join the project.
              </p>
            </div>
          )}

          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Pending Invitations</h3>
              <div className="space-y-2">
                {pendingInvites.map(invite => (
                  <div key={invite.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-xs">
                        ✉️
                      </div>
                      <div>
                        <div className="font-medium text-sm text-gray-900">{invite.email}</div>
                        <div className="text-xs text-amber-600">Pending invite</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}?invite=${invite.token}`
                          navigator.clipboard.writeText(link)
                          setSuccess('Invite link copied!')
                          setTimeout(() => setSuccess(''), 2000)
                        }}
                        className="p-1.5 hover:bg-amber-100 rounded text-amber-600 hover:text-amber-700"
                        title="Copy invite link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="p-1.5 hover:bg-amber-100 rounded text-gray-400 hover:text-red-500"
                          title="Cancel invitation"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Team</h3>
            <div className="space-y-2">
              {/* Show owner first */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="avatar text-xs bg-gradient-to-br from-gray-400 to-gray-600">
                    {user?.user_metadata?.name?.[0] || user?.email?.[0] || 'O'}
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {project.owner_id === user?.id ? 'You' : 'Owner'}
                    </div>
                    <div className="text-xs text-gray-500">Owner</div>
                  </div>
                </div>
              </div>
              
              {/* Show members */}
              {members.map(member => (
                <div key={member.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="avatar text-xs">
                      {member.user?.name?.[0] || member.user?.email?.[0] || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {member.user?.name || member.user?.email || 'Unknown'}
                        {member.user_id === user?.id && ' (You)'}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">{member.role}</div>
                    </div>
                  </div>
                  {isOwner && member.user_id !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// TASK DETAIL VIEW
// ============================================
function TaskDetail() {
  const { projects, setProjects, selectedProject, selectedTask, setSelectedTask, setView } = useApp()
  const { demoMode, user } = useAuth()
  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')

  if (!selectedTask || !selectedProject) return null

  const project = projects.find(p => p.id === selectedProject.id)
  if (!project) return null

  const { task, stageIndex } = selectedTask
  const currentTask = project.stages[stageIndex]?.tasks?.find(t => t.id === task.id)
  if (!currentTask) return null

  const taskOverdue = isOverdue(currentTask.reminder_date) && !currentTask.is_completed

  const updateTask = (updates) => {
    const now = new Date().toISOString()
    const updated = {
      ...project,
      updated_at: now,
      stages: project.stages.map((s, i) => 
        i === stageIndex 
          ? { ...s, tasks: s.tasks.map(t => t.id === task.id ? { ...t, ...updates, updated_at: now } : t) }
          : s
      )
    }
    const newProjects = projects.map(p => p.id === project.id ? updated : p)
    setProjects(newProjects)
    if (demoMode) saveLocal(newProjects)
  }

  const updateTaskReminder = async (reminderDate) => {
    updateTask({ reminder_date: reminderDate })
    if (!demoMode) {
      await db.updateTask(task.id, { reminder_date: reminderDate })
    }
  }

  const addSubtask = async () => {
    if (!newSubtask.trim()) return
    const localId = uuid()
    const subtask = { id: localId, title: newSubtask.trim(), is_completed: false, reminder_date: null }
    updateTask({ subtasks: [...(currentTask.subtasks || []), subtask] })
    setNewSubtask('')

    if (!demoMode) {
      const { data: createdSubtask } = await db.createSubtask({ task_id: task.id, title: subtask.title })
      
      // Update local state with server-generated ID
      if (createdSubtask) {
        const now = new Date().toISOString()
        const updated = {
          ...project,
          updated_at: now,
          stages: project.stages.map((s, i) => 
            i === stageIndex 
              ? { ...s, tasks: s.tasks.map(t => t.id === task.id 
                  ? { ...t, subtasks: t.subtasks.map(st => st.id === localId ? { ...st, id: createdSubtask.id } : st) }
                  : t
                )}
              : s
          )
        }
        const newProjects = projects.map(p => p.id === project.id ? updated : p)
        setProjects(newProjects)
      }
    }
  }

  const toggleSubtask = async (subtaskId) => {
    const subtask = currentTask.subtasks?.find(s => s.id === subtaskId)
    updateTask({
      subtasks: currentTask.subtasks.map(s => 
        s.id === subtaskId ? { ...s, is_completed: !s.is_completed } : s
      )
    })

    if (!demoMode) {
      await db.updateSubtask(subtaskId, { is_completed: !subtask.is_completed })
    }
  }

  const updateSubtaskReminder = async (subtaskId, reminderDate) => {
    updateTask({
      subtasks: currentTask.subtasks.map(s => 
        s.id === subtaskId ? { ...s, reminder_date: reminderDate } : s
      )
    })

    if (!demoMode) {
      await db.updateSubtask(subtaskId, { reminder_date: reminderDate })
    }
  }

  const deleteSubtask = async (subtaskId) => {
    updateTask({ subtasks: currentTask.subtasks.filter(s => s.id !== subtaskId) })
    if (!demoMode) await db.deleteSubtask(subtaskId)
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    const comment = {
      id: uuid(),
      content: newComment.trim(),
      user_name: user?.user_metadata?.name || 'Demo User',
      created_at: new Date().toISOString()
    }
    updateTask({ comments: [...(currentTask.comments || []), comment] })
    setNewComment('')

    if (!demoMode) {
      await db.createComment({ task_id: task.id, content: comment.content, user_id: user.id })
    }
  }

  const deleteTask = async () => {
    if (!window.confirm('Delete this task?')) return
    const updated = {
      ...project,
      stages: project.stages.map((s, i) => 
        i === stageIndex ? { ...s, tasks: s.tasks.filter(t => t.id !== task.id) } : s
      )
    }
    const newProjects = projects.map(p => p.id === project.id ? updated : p)
    setProjects(newProjects)
    if (demoMode) saveLocal(newProjects)
    if (!demoMode) await db.deleteTask(task.id)
    setSelectedTask(null)
    setView('project')
  }

  // Sort subtasks: overdue first
  const sortedSubtasks = [...(currentTask.subtasks || [])].sort((a, b) => {
    const aOverdue = isOverdue(a.reminder_date) && !a.is_completed
    const bOverdue = isOverdue(b.reminder_date) && !b.is_completed
    
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    return 0
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-16">
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <button 
            onClick={() => { setSelectedTask(null); setView('project'); }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium truncate">Back to {project.title}</span>
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Task Header */}
        <div className={`flex items-start gap-3 sm:gap-4 p-4 rounded-xl ${taskOverdue ? 'bg-red-50 border border-red-200' : ''}`}>
          <button
            onClick={() => updateTask({ is_completed: !currentTask.is_completed })}
            className={`checkbox-custom mt-1 flex-shrink-0 ${currentTask.is_completed ? 'checked' : ''}`}
            style={{ width: 28, height: 28 }}
          >
            {currentTask.is_completed && <Check className="w-4 h-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={currentTask.title}
              onChange={e => updateTask({ title: e.target.value })}
              className={`w-full text-xl sm:text-2xl font-bold bg-transparent outline-none ${taskOverdue ? 'text-red-700' : ''}`}
            />
            {/* Timestamps and Reminder */}
            <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs text-gray-400 flex-wrap">
              <ReminderPicker
                value={currentTask.reminder_date}
                onChange={updateTaskReminder}
              />
              {currentTask.created_at && (
                <span className="flex items-center gap-1 hidden sm:flex" title={new Date(currentTask.created_at).toLocaleString()}>
                  <Clock className="w-3 h-3" />
                  Created {formatRelativeDate(currentTask.created_at)}
                </span>
              )}
              {currentTask.updated_at && currentTask.updated_at !== currentTask.created_at && (
                <span className="hidden sm:inline" title={new Date(currentTask.updated_at).toLocaleString()}>
                  • Modified {formatRelativeDate(currentTask.updated_at)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="glass-card rounded-xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Description</h3>
          <textarea
            value={currentTask.description || ''}
            onChange={e => updateTask({ description: e.target.value })}
            placeholder="Add a description..."
            className="w-full min-h-[100px] bg-transparent resize-y outline-none text-gray-700"
          />
        </div>

        {/* Subtasks */}
        <div className="glass-card rounded-xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Subtasks</h3>
          <div className="space-y-2 mb-4">
            {sortedSubtasks.map(s => {
              const subtaskOverdue = isOverdue(s.reminder_date) && !s.is_completed
              return (
                <div 
                  key={s.id} 
                  className={`flex items-center gap-2 sm:gap-3 p-3 rounded-lg transition-colors ${
                    subtaskOverdue ? 'bg-red-50 border-l-2 border-l-red-400' : 'bg-gray-50'
                  }`}
                >
                  <button
                    onClick={() => toggleSubtask(s.id)}
                    className={`checkbox-custom flex-shrink-0 ${s.is_completed ? 'checked' : ''}`}
                    style={{ width: 20, height: 20 }}
                  >
                    {s.is_completed && <Check className="w-3 h-3" />}
                  </button>
                  <span className={`flex-1 text-sm min-w-0 ${s.is_completed ? 'line-through text-gray-400' : subtaskOverdue ? 'text-red-700' : ''}`}>
                    {s.title}
                  </span>
                  <ReminderPicker
                    value={s.reminder_date}
                    onChange={(date) => updateSubtaskReminder(s.id, date)}
                    compact
                  />
                  <button onClick={() => deleteSubtask(s.id)} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add subtask..."
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSubtask()}
              className="input-sleek"
            />
            <button onClick={addSubtask} className="p-3 hover:bg-gray-100 rounded-lg">
              <Plus className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Comments */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Comments</h3>
          <div className="space-y-4 mb-4">
            {currentTask.comments?.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="avatar text-xs flex-shrink-0">{c.user_name?.[0] || '?'}</div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{c.user_name}</div>
                  <div className="text-sm text-gray-600 mt-1">{c.content}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Write a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addComment()}
              className="input-sleek"
            />
            <button onClick={addComment} className="btn-gradient px-4">Post</button>
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={deleteTask}
          className="w-full py-3 bg-red-50 text-red-600 font-semibold rounded-xl hover:bg-red-100 transition-colors"
        >
          Delete Task
        </button>
      </div>
    </div>
  )
}

// ============================================
// ALL TASKS VIEW
// ============================================
function AllTasksView() {
  const { projects, setSelectedProject, setSelectedTask, setView } = useApp()
  const [sortOption, setSortOption] = useState('priority')
  const [sortDirection, setSortDirection] = useState('asc')

  const handleSortChange = (newOption) => {
    if (newOption === sortOption) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortOption(newOption)
      setSortDirection('asc')
    }
  }

  const allTasks = []
  projects.forEach(p => {
    p.stages?.forEach((s, si) => {
      s.tasks?.forEach(t => {
        allTasks.push({ project: p, stage: s, stageIndex: si, task: t })
      })
    })
  })

  // Sort tasks: overdue first, then by selected option
  const dir = sortDirection === 'asc' ? 1 : -1
  allTasks.sort((a, b) => {
    const aOverdue = isOverdue(a.task.reminder_date) && !a.task.is_completed
    const bOverdue = isOverdue(b.task.reminder_date) && !b.task.is_completed
    
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1
    
    if (sortOption === 'priority') {
      return (a.project.priority_rank - b.project.priority_rank) * dir
    } else if (sortOption === 'created') {
      const dateA = new Date(a.task.created_at || 0).getTime()
      const dateB = new Date(b.task.created_at || 0).getTime()
      return (dateA - dateB) * dir
    } else if (sortOption === 'modified') {
      const dateA = new Date(a.task.updated_at || a.task.created_at || 0).getTime()
      const dateB = new Date(b.task.updated_at || b.task.created_at || 0).getTime()
      return (dateA - dateB) * dir
    }
    return 0
  })

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Tasks</h1>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 w-full sm:w-auto">
          {[{ key: 'priority', label: 'Priority' }, { key: 'created', label: 'Created' }, { key: 'modified', label: 'Modified' }].map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSortChange(opt.key)}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap ${
                sortOption === opt.key
                  ? 'bg-gray-200 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
              {sortOption === opt.key && (
                sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      {allTasks.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
          <div className="text-4xl sm:text-5xl mb-4">📋</div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No tasks yet</h2>
          <p className="text-gray-500 text-sm sm:text-base">Create a project and add some tasks!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allTasks.map(({ project, stage, stageIndex, task }, i) => {
            const taskOverdue = isOverdue(task.reminder_date) && !task.is_completed
            return (
              <div
                key={`${project.id}-${task.id}`}
                className={`glass-card glass-card-hover rounded-xl p-3 sm:p-4 cursor-pointer animate-fade-in ${
                  taskOverdue ? 'bg-red-50/80 border-l-4 border-l-red-400' : ''
                }`}
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => {
                  setSelectedProject(project)
                  setSelectedTask({ task, stageIndex })
                  setView('task')
                }}
              >
                <div className="flex items-center gap-2 sm:gap-4">
                  <span className="text-2xl sm:text-3xl">{project.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${taskOverdue ? 'text-red-700' : 'text-gray-900'}`}>{task.title}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs sm:text-sm text-gray-500 truncate">{project.title}</span>
                      <span className="tag tag-default text-[9px] sm:text-[10px]">{stage.name}</span>
                      {task.reminder_date && (
                        <span className={`text-[10px] flex items-center gap-0.5 ${taskOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                          <Clock className="w-3 h-3" />
                          {formatReminderDate(task.reminder_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================
// MAIN APP
// ============================================
export default function App() {
  const { user, loading: authLoading, demoMode } = useAuth()
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [activeTab, setActiveTab] = useState('projects')
  const [view, setView] = useState('main')
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState([])

  // Load notifications
  const loadNotifications = async () => {
    if (demoMode) {
      // Load from localStorage for demo
      try {
        const stored = localStorage.getItem('researchos_notifications')
        setNotifications(stored ? JSON.parse(stored) : [])
      } catch {
        setNotifications([])
      }
      return
    }

    if (user) {
      const { data } = await db.getNotifications(user.id)
      setNotifications(data || [])
    }
  }

  // Notification handlers
  const handleMarkNotificationRead = async (id) => {
    if (demoMode) {
      const updated = notifications.map(n => n.id === id ? { ...n, is_read: true } : n)
      setNotifications(updated)
      localStorage.setItem('researchos_notifications', JSON.stringify(updated))
    } else {
      await db.markNotificationRead(id)
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n))
    }
  }

  const handleMarkAllNotificationsRead = async () => {
    if (demoMode) {
      const updated = notifications.map(n => ({ ...n, is_read: true }))
      setNotifications(updated)
      localStorage.setItem('researchos_notifications', JSON.stringify(updated))
    } else {
      await db.markAllNotificationsRead(user.id)
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
    }
  }

  const handleDeleteNotification = async (id) => {
    if (demoMode) {
      const updated = notifications.filter(n => n.id !== id)
      setNotifications(updated)
      localStorage.setItem('researchos_notifications', JSON.stringify(updated))
    } else {
      await db.deleteNotification(id)
      setNotifications(notifications.filter(n => n.id !== id))
    }
  }

  const handleClearAllNotifications = async () => {
    if (demoMode) {
      setNotifications([])
      localStorage.setItem('researchos_notifications', JSON.stringify([]))
    } else {
      await db.clearAllNotifications(user.id)
      setNotifications([])
    }
  }

  const handleNotificationNavigate = (notif) => {
    const project = projects.find(p => p.id === notif.project_id)
    if (project) {
      setSelectedProject(project)
      if (notif.task_id) {
        // Find the task and its stage index
        for (let si = 0; si < project.stages?.length; si++) {
          const task = project.stages[si].tasks?.find(t => t.id === notif.task_id)
          if (task) {
            setSelectedTask({ task, stageIndex: si })
            setView('task')
            return
          }
        }
      }
      setView('project')
    }
  }

  // Reload projects function
  const reloadProjects = async () => {
    if (demoMode) {
      const local = loadLocal()
      setProjects(local)
      return
    }

    if (user) {
      const { data, error } = await db.getProjects(user.id)
      if (!error && data) {
        setProjects(data)
      }
    }
  }

  // Listen for invitation-accepted event to reload projects
  useEffect(() => {
    const handleInvitationAccepted = (e) => {
      console.log('🎉 Invitation accepted, reloading projects...', e.detail)
      reloadProjects()
      // Add notification for the shared project
      if (demoMode && e.detail?.projectId) {
        const newNotif = {
          id: uuid(),
          type: 'project_shared',
          title: 'You were added to a project',
          message: `You now have access to a shared project`,
          project_id: e.detail.projectId,
          is_read: false,
          created_at: new Date().toISOString()
        }
        const updated = [newNotif, ...notifications]
        setNotifications(updated)
        localStorage.setItem('researchos_notifications', JSON.stringify(updated))
      }
    }

    window.addEventListener('invitation-accepted', handleInvitationAccepted)
    return () => window.removeEventListener('invitation-accepted', handleInvitationAccepted)
  }, [user, demoMode, notifications])

  // Load projects and notifications
  useEffect(() => {
    if (authLoading) return

    const loadData = async () => {
      if (demoMode) {
        const local = loadLocal()
        setProjects(local)
        loadNotifications()
        setLoading(false)
        return
      }

      if (user) {
        const { data, error } = await db.getProjects(user.id)
        if (!error && data) {
          setProjects(data)
        }
        loadNotifications()
      }
      setLoading(false)
    }

    loadData()
  }, [user, authLoading, demoMode])

  const reorderProjects = (updatedProjects) => {
    setProjects(updatedProjects)
    if (demoMode) {
      saveLocal(updatedProjects)
    } else {
      // In real mode, update each project's priority_rank
      Promise.all(
        updatedProjects.map((project, index) =>
          db.updateProject(project.id, { priority_rank: index + 1 })
        )
      ).catch((e) => console.error('❌ Failed to persist priority order:', e))
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  // Handle search navigation
  const handleSearchNavigate = (type, item) => {
    if (type === 'project') {
      setSelectedProject(item.project)
      setView('project')
    } else if (type === 'task') {
      setSelectedProject(item.project)
      setSelectedTask({ task: item.task, stageIndex: item.stageIndex })
      setView('task')
    }
  }

  const ctx = {
    projects, setProjects,
    selectedProject, setSelectedProject,
    selectedTask, setSelectedTask,
    view, setView,
    loading,
    reorderProjects
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-screen pb-8">
        {view === 'main' && (
          <>
            <Header 
              projects={projects} 
              onSearchNavigate={handleSearchNavigate}
              notifications={notifications}
              onMarkNotificationRead={handleMarkNotificationRead}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              onDeleteNotification={handleDeleteNotification}
              onClearAllNotifications={handleClearAllNotifications}
              onNotificationNavigate={handleNotificationNavigate}
            />
            <TabNav tab={activeTab} setTab={setActiveTab} />
            {activeTab === 'projects' ? <ProjectsView /> : <AllTasksView />}
          </>
        )}
        {view === 'project' && <ProjectDetail />}
        {view === 'task' && <TaskDetail />}
        
        <footer className="fixed bottom-0 left-0 right-0 py-2 text-center text-[10px] text-gray-400 bg-white/80 backdrop-blur-sm border-t border-gray-100">
          © 2025 <a href="http://tinyurl.com/kennethkusima" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline">Kenneth Kusima</a>. All rights reserved.
        </footer>
      </div>
    </AppContext.Provider>
  )
}
