import { useState, useEffect, createContext, useContext } from 'react'
import { useAuth } from './contexts/AuthContext'
import { db, supabase } from './lib/supabase'
import { 
  Check, Plus, Trash2, Settings, ChevronLeft, ChevronRight, 
  LogOut, Users, Share2, Mail, Clock, FileText, MessageSquare,
  Loader2, Search, MoreVertical, X, Copy, UserPlus, ChevronUp, ChevronDown, GripVertical
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
  const { signInWithGoogle, demoMode } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setLoading(true)
    await signInWithGoogle()
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f3f4f6 0%, #6b7280 100%)' }}>
      <div className="glass-card rounded-3xl p-8 w-full max-w-md text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl" style={{ background: 'linear-gradient(135deg, #e5e7eb, #4b5563)' }}>
          🔬
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">ResearchOS</h1>
        <p className="text-gray-500 mb-8">Collaborative research project management</p>
        
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
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
          Continue with Google
        </button>

        {demoMode && (
          <p className="mt-4 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
            ⚠️ Running in demo mode. Data saved locally only.
          </p>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================
// HEADER
// ============================================
function Header() {
  const { user, signOut, demoMode } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture

  return (
    <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, #e5e7eb, #4b5563)' }}>
              🔬
            </div>
            <span className="font-bold text-xl text-gray-900">ResearchOS</span>
            {demoMode && (
              <span className="tag tag-warning text-[10px]">DEMO</span>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-8 h-8 rounded-full" />
              ) : (
                <div className="avatar text-sm">{userName[0]?.toUpperCase()}</div>
              )}
              <span className="font-medium text-gray-700 hidden sm:block">{userName}</span>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 glass-card rounded-xl shadow-lg z-50 py-2 animate-fade-in">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{userName}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
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
    </header>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState('priority')
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'
  const [showReorder, setShowReorder] = useState(false)
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

  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const computeSorted = () => {
    const sorted = [...filteredProjects]
    const dir = sortDirection === 'asc' ? 1 : -1
    switch (sortOption) {
      case 'priority':
        return sorted.sort((a, b) => {
          if (a.priority_rank === b.priority_rank) return a.title.localeCompare(b.title)
          return (a.priority_rank - b.priority_rank) * dir
        })
      case 'progress':
        return sorted.sort((a, b) => (b.progress - a.progress) * dir)
      case 'name':
        return sorted.sort((a, b) => a.title.localeCompare(b.title) * dir)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <p className="text-gray-500 text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full lg:max-w-4xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-sleek pl-10 w-full"
            />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-1">
              {[{ key: 'priority', label: 'Priority' }, { key: 'progress', label: 'Progress' }, { key: 'name', label: 'Name' }].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleSortChange(opt.key)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${
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
            <button onClick={() => setShowReorder(true)} className="btn-gradient flex items-center gap-2 whitespace-nowrap">
              <MoreVertical className="w-4 h-4" />
              <span className="hidden sm:inline">Reorder</span>
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-gradient flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Project</span>
            </button>
          </div>
        </div>
      </div>

      {sortedProjects.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">🔬</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {searchQuery ? 'No projects found' : 'No projects yet'}
          </h2>
          <p className="text-gray-500 mb-6">
            {searchQuery ? 'Try a different search term' : 'Create your first research project to get started'}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowCreate(true)} className="btn-gradient">
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project, i) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              index={i}
              onSelect={() => { setSelectedProject(project); setView('project'); }}
              onDelete={() => deleteProject(project.id)}
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
// PROJECT CARD
// ============================================
function ProjectCard({ project, index, onSelect, onDelete }) {
  const [showMenu, setShowMenu] = useState(false)
  const progress = getProgress(project)
  const currentStage = project.stages?.[project.current_stage_index]

  return (
    <div
      className="glass-card glass-card-hover rounded-2xl p-5 cursor-pointer relative animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onSelect}
    >
      <div className="flex items-start gap-4 mb-4">
        <span className="text-4xl">{project.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-gray-900 truncate">{project.title}</h3>
          <div className="flex items-center gap-2 mt-1">
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

      <div className="bg-gray-100 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-gray-500">Progress</span>
          <span className="text-sm font-bold text-gray-900">{Math.round(progress * 100)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <button
        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-gray-400" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={e => { e.stopPropagation(); setShowMenu(false); }} />
          <div className="absolute top-12 right-4 glass-card rounded-xl shadow-lg z-50 py-1 min-w-[140px] animate-fade-in" onClick={e => e.stopPropagation()}>
            <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
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

    const newProject = {
      id: uuid(),
      title: title.trim(),
      emoji,
      priority_rank: 1, // Default to high priority
      current_stage_index: 0,
      owner_id: user?.id || 'demo',
      created_at: new Date().toISOString(),
      stages: stages.map((name, i) => ({
        id: uuid(),
        name,
        order_index: i,
        tasks: []
      })),
      project_members: []
    }

    if (demoMode) {
      setProjects([newProject, ...projects])
      saveLocal([newProject, ...projects])
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
  const stageIndex = previewIndex ?? project.current_stage_index
  const stage = project.stages?.[stageIndex]
  const progress = getProgress(project)

  const updateProject = (updated) => {
    const newProjects = projects.map(p => p.id === updated.id ? updated : p)
    setProjects(newProjects)
    setSelectedProject(updated)
    if (demoMode) saveLocal(newProjects)
  }

  const setCurrentStage = async () => {
    if (previewIndex === null) return
    const updated = { ...project, current_stage_index: previewIndex }
    updateProject(updated)
    if (!demoMode) await db.updateProject(project.id, { current_stage_index: previewIndex })
    setPreviewIndex(null)
  }

  const addTask = async () => {
    if (!newTask.trim()) return
    const task = {
      id: uuid(),
      title: newTask.trim(),
      description: '',
      is_completed: false,
      reminder_date: null,
      subtasks: [],
      comments: [],
      created_at: new Date().toISOString()
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
      await db.createTask({
        stage_id: stage.id,
        title: task.title,
        order_index: stage.tasks?.length || 0
      })
    }
  }

  const toggleTask = async (taskId) => {
    const task = stage.tasks.find(t => t.id === taskId)
    if (!task) return
    
    const updated = {
      ...project,
      stages: project.stages.map((s, i) => 
        i === stageIndex 
          ? { ...s, tasks: s.tasks.map(t => t.id === taskId ? { ...t, is_completed: !t.is_completed } : t) }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setView('main'); setSelectedProject(null); }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-4xl">{project.emoji}</span>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{project.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="tag tag-default">{project.stages?.[project.current_stage_index]?.name}</span>
                <span className="text-sm text-gray-500">{Math.round(progress * 100)}% complete</span>
              </div>
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
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stages</span>
            {previewIndex !== null && previewIndex !== project.current_stage_index && (
              <button onClick={setCurrentStage} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                Set as Current →
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {project.stages?.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setPreviewIndex(i)}
                className={`stage-pill ${
                  i === project.current_stage_index ? 'active' : 
                  previewIndex === i ? 'preview' : ''
                }`}
              >
                {s.name}
                {i === project.current_stage_index && (
                  <span className="block text-[10px] opacity-70 mt-0.5">Current</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Tasks for {stage?.name}
          </h2>
        </div>

        {/* Add Task Input */}
        <div className="glass-card rounded-xl p-4 mb-6 flex items-center gap-3">
          <Plus className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Add a new task..."
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400"
          />
          <button
            onClick={addTask}
            disabled={!newTask.trim()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #e5e7eb, #4b5563)' }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-3">
          {!stage?.tasks?.length ? (
            <div className="text-center py-12 text-gray-400">
              No tasks yet. Add one above!
            </div>
          ) : (
            stage.tasks.map((task, i) => (
              <div
                key={task.id}
                className="glass-card glass-card-hover rounded-xl p-4 animate-fade-in"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`checkbox-custom mt-0.5 ${task.is_completed ? 'checked' : ''}`}
                  >
                    {task.is_completed && <Check className="w-3 h-3" />}
                  </button>
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => { setSelectedTask({ task, stageIndex }); setView('task'); }}
                  >
                    <div className={`font-medium ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {task.title}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
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
                      {task.reminder_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(task.reminder_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showSettings && (
        <ProjectSettingsModal 
          project={project} 
          onClose={() => setShowSettings(false)} 
          onUpdate={updateProject}
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
function ProjectSettingsModal({ project, onClose, onUpdate }) {
  const { demoMode } = useAuth()
  const [title, setTitle] = useState(project.title)
  const [emoji, setEmoji] = useState(project.emoji)
  const [stages, setStages] = useState([...project.stages])
  const [loading, setLoading] = useState(false)
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

  const handleSave = async () => {
    setLoading(true)
    // Update order_index for all stages based on current order
    const updatedStages = stages.map((stage, index) => ({
      ...stage,
      order_index: index
    }))
    const updated = {
      ...project,
      title,
      emoji,
      stages: updatedStages,
      current_stage_index: Math.min(project.current_stage_index, stages.length - 1)
    }
    onUpdate(updated)

    if (!demoMode) {
      await db.updateProject(project.id, { title, emoji })
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
                    {isOwner && (
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        className="p-1 hover:bg-amber-100 rounded text-gray-400 hover:text-red-500"
                        title="Cancel invitation"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
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

  const updateTask = (updates) => {
    const updated = {
      ...project,
      stages: project.stages.map((s, i) => 
        i === stageIndex 
          ? { ...s, tasks: s.tasks.map(t => t.id === task.id ? { ...t, ...updates } : t) }
          : s
      )
    }
    const newProjects = projects.map(p => p.id === project.id ? updated : p)
    setProjects(newProjects)
    if (demoMode) saveLocal(newProjects)
  }

  const addSubtask = async () => {
    if (!newSubtask.trim()) return
    const subtask = { id: uuid(), title: newSubtask.trim(), is_completed: false }
    updateTask({ subtasks: [...(currentTask.subtasks || []), subtask] })
    setNewSubtask('')

    if (!demoMode) {
      await db.createSubtask({ task_id: task.id, title: subtask.title })
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button 
            onClick={() => { setSelectedTask(null); setView('project'); }}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to {project.title}</span>
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Task Header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => updateTask({ is_completed: !currentTask.is_completed })}
            className={`checkbox-custom mt-1 ${currentTask.is_completed ? 'checked' : ''}`}
            style={{ width: 28, height: 28 }}
          >
            {currentTask.is_completed && <Check className="w-4 h-4" />}
          </button>
          <input
            type="text"
            value={currentTask.title}
            onChange={e => updateTask({ title: e.target.value })}
            className="flex-1 text-2xl font-bold bg-transparent outline-none"
          />
        </div>

        {/* Description */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Description</h3>
          <textarea
            value={currentTask.description || ''}
            onChange={e => updateTask({ description: e.target.value })}
            placeholder="Add a description..."
            className="w-full min-h-[100px] bg-transparent resize-y outline-none text-gray-700"
          />
        </div>

        {/* Subtasks */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Subtasks</h3>
          <div className="space-y-2 mb-4">
            {currentTask.subtasks?.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <button
                  onClick={() => toggleSubtask(s.id)}
                  className={`checkbox-custom ${s.is_completed ? 'checked' : ''}`}
                  style={{ width: 20, height: 20 }}
                >
                  {s.is_completed && <Check className="w-3 h-3" />}
                </button>
                <span className={`flex-1 text-sm ${s.is_completed ? 'line-through text-gray-400' : ''}`}>
                  {s.title}
                </span>
                <button onClick={() => deleteSubtask(s.id)} className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
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

  // Sort tasks based on selected option and direction
  const dir = sortDirection === 'asc' ? 1 : -1
  if (sortOption === 'priority') {
    allTasks.sort((a, b) => (a.project.priority_rank - b.project.priority_rank) * dir)
  } else if (sortOption === 'created') {
    allTasks.sort((a, b) => {
      const dateA = new Date(a.task.created_at || 0).getTime()
      const dateB = new Date(b.task.created_at || 0).getTime()
      return (dateA - dateB) * dir
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Tasks</h1>
        <div className="flex items-center gap-1">
          {[{ key: 'priority', label: 'Priority' }, { key: 'created', label: 'Date Created' }].map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSortChange(opt.key)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${
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
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No tasks yet</h2>
          <p className="text-gray-500">Create a project and add some tasks!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allTasks.map(({ project, stage, stageIndex, task }, i) => (
            <div
              key={`${project.id}-${task.id}`}
              className="glass-card glass-card-hover rounded-xl p-4 cursor-pointer animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => {
                setSelectedProject(project)
                setSelectedTask({ task, stageIndex })
                setView('task')
              }}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{project.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{task.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-500">{project.title}</span>
                    <span className="tag tag-default text-[10px]">{stage.name}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ))}
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
    }

    window.addEventListener('invitation-accepted', handleInvitationAccepted)
    return () => window.removeEventListener('invitation-accepted', handleInvitationAccepted)
  }, [user, demoMode])

  // Load projects
  useEffect(() => {
    if (authLoading) return

    const loadProjects = async () => {
      if (demoMode) {
        const local = loadLocal()
        setProjects(local)
        setLoading(false)
        return
      }

      if (user) {
        const { data, error } = await db.getProjects(user.id)
        if (!error && data) {
          setProjects(data)
        }
      }
      setLoading(false)
    }

    loadProjects()
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
      <div className="min-h-screen">
        {view === 'main' && (
          <>
            <Header />
            <TabNav tab={activeTab} setTab={setActiveTab} />
            {activeTab === 'projects' ? <ProjectsView /> : <AllTasksView />}
          </>
        )}
        {view === 'project' && <ProjectDetail />}
        {view === 'task' && <TaskDetail />}
      </div>
    </AppContext.Provider>
  )
}
