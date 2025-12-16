import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate that the anon key looks like a real JWT (starts with eyJ and is long enough)
const isValidSupabaseKey = (key) => {
  return key && key.startsWith('eyJ') && key.length > 100
}

const hasValidConfig = supabaseUrl && supabaseAnonKey && isValidSupabaseKey(supabaseAnonKey)

console.log('🔧 Supabase Config:', {
  url: supabaseUrl ? '✅ Set' : '❌ Missing',
  key: supabaseAnonKey ? (isValidSupabaseKey(supabaseAnonKey) ? '✅ Valid JWT' : '❌ Invalid format (not a JWT)') : '❌ Missing',
  mode: hasValidConfig ? 'LIVE' : 'DEMO'
})

if (!hasValidConfig) {
  console.warn('⚠️ Supabase credentials missing or invalid. Running in demo mode.')
  if (supabaseAnonKey && !isValidSupabaseKey(supabaseAnonKey)) {
    console.warn('⚠️ Your VITE_SUPABASE_ANON_KEY does not look like a valid Supabase key.')
    console.warn('   Valid keys start with "eyJ" and are ~200+ characters long.')
    console.warn('   Get your key from: https://supabase.com/dashboard/project/_/settings/api')
  }
}

export const supabase = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null

// Helper to log errors
const logError = (operation, error) => {
  console.error(`❌ Database Error [${operation}]:`, error)
  return error
}

// Database helper functions
export const db = {
  // Projects - Get owned AND shared projects
  async getProjects(userId) {
    if (!supabase) return { data: [], error: null }
    
    try {
      console.log('📦 Loading projects for user:', userId)
      
      // Get projects where user is owner OR member
      // First get owned projects
      const { data: ownedProjects, error: ownedError } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userId)
      
      if (ownedError) {
        logError('getOwnedProjects', ownedError)
      }

      // Then get projects where user is a member
      const { data: membershipData, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId)
      
      if (memberError) {
        logError('getMemberships', memberError)
      }

      // Get shared projects
      let sharedProjects = []
      if (membershipData && membershipData.length > 0) {
        const sharedProjectIds = membershipData.map(m => m.project_id)
        const { data: shared, error: sharedError } = await supabase
          .from('projects')
          .select('*')
          .in('id', sharedProjectIds)
        
        if (sharedError) {
          logError('getSharedProjects', sharedError)
        } else {
          sharedProjects = shared || []
        }
      }

      // Combine and deduplicate
      const allProjectsMap = new Map()
      ;(ownedProjects || []).forEach(p => allProjectsMap.set(p.id, { ...p, isOwner: true }))
      sharedProjects.forEach(p => {
        if (!allProjectsMap.has(p.id)) {
          allProjectsMap.set(p.id, { ...p, isOwner: false })
        }
      })
      
      const projects = Array.from(allProjectsMap.values())
        .sort((a, b) => a.priority_rank - b.priority_rank)

      if (projects.length === 0) {
        console.log('📦 No projects found')
        return { data: [], error: null }
      }

      console.log(`📦 Found ${projects.length} projects (${ownedProjects?.length || 0} owned, ${sharedProjects.length} shared), loading details...`)

      // Then get related data for each project
      const projectsWithData = await Promise.all(
        projects.map(async (project) => {
          // Get stages
          const { data: stages, error: stagesError } = await supabase
            .from('stages')
            .select('*')
            .eq('project_id', project.id)
            .order('order_index', { ascending: true })
          
          if (stagesError) {
            logError('getStages', stagesError)
            return { ...project, stages: [], project_members: [] }
          }

          // Get tasks for each stage
          const stagesWithTasks = await Promise.all(
            (stages || []).map(async (stage) => {
              const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('stage_id', stage.id)
                .order('order_index', { ascending: true })
              
              // Get subtasks for each task
              const tasksWithSubtasks = await Promise.all(
                (tasks || []).map(async (task) => {
                  const { data: subtasks } = await supabase
                    .from('subtasks')
                    .select('*')
                    .eq('task_id', task.id)
                    .order('order_index', { ascending: true })
                  
                  return { ...task, subtasks: subtasks || [] }
                })
              )

              return { ...stage, tasks: tasksWithSubtasks }
            })
          )

          // Get project members with user info
          const { data: members } = await supabase
            .from('project_members')
            .select(`
              *,
              user:users(id, email, name, avatar_url)
            `)
            .eq('project_id', project.id)

          return { 
            ...project, 
            stages: stagesWithTasks,
            project_members: members || []
          }
        })
      )

      console.log('✅ Projects loaded successfully:', projectsWithData.length)
      return { data: projectsWithData, error: null }
    } catch (error) {
      logError('getProjects:catch', error)
      return { data: [], error }
    }
  },

  async createProject(project) {
    if (!supabase) return { data: null, error: null }
    
    try {
      console.log('📝 Creating project:', project.title)
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single()
      
      if (error) {
        logError('createProject', error)
        return { data: null, error }
      }
      
      console.log('✅ Project created:', data.id)
      return { data, error: null }
    } catch (error) {
      logError('createProject:catch', error)
      return { data: null, error }
    }
  },

  async updateProject(id, updates) {
    if (!supabase) return { data: null, error: null }
    
    try {
      console.log('📝 Updating project:', id, updates)
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        logError('updateProject', error)
        return { data: null, error }
      }
      
      console.log('✅ Project updated')
      return { data, error: null }
    } catch (error) {
      logError('updateProject:catch', error)
      return { data: null, error }
    }
  },

  async deleteProject(id) {
    if (!supabase) return { error: null }
    
    try {
      console.log('🗑️ Deleting project:', id)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
      
      if (error) {
        logError('deleteProject', error)
        return { error }
      }
      
      console.log('✅ Project deleted')
      return { error: null }
    } catch (error) {
      logError('deleteProject:catch', error)
      return { error }
    }
  },

  // Stages
  async createStage(stage) {
    if (!supabase) return { data: null, error: null }
    
    try {
      console.log('📝 Creating stage:', stage.name)
      const { data, error } = await supabase
        .from('stages')
        .insert(stage)
        .select()
        .single()
      
      if (error) logError('createStage', error)
      else console.log('✅ Stage created:', data.id)
      return { data, error }
    } catch (error) {
      logError('createStage:catch', error)
      return { data: null, error }
    }
  },

  async updateStage(id, updates) {
    if (!supabase) return { data: null, error: null }
    
    try {
      const { data, error } = await supabase
        .from('stages')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) logError('updateStage', error)
      return { data, error }
    } catch (error) {
      logError('updateStage:catch', error)
      return { data: null, error }
    }
  },

  async deleteStage(id) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('stages')
        .delete()
        .eq('id', id)
      
      if (error) logError('deleteStage', error)
      return { error }
    } catch (error) {
      logError('deleteStage:catch', error)
      return { error }
    }
  },

  // Tasks
  async createTask(task) {
    if (!supabase) return { data: null, error: null }
    
    try {
      console.log('📝 Creating task:', task.title)
      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single()
      
      if (error) logError('createTask', error)
      else console.log('✅ Task created:', data.id)
      return { data, error }
    } catch (error) {
      logError('createTask:catch', error)
      return { data: null, error }
    }
  },

  async updateTask(id, updates) {
    if (!supabase) return { data: null, error: null }
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) logError('updateTask', error)
      return { data, error }
    } catch (error) {
      logError('updateTask:catch', error)
      return { data: null, error }
    }
  },

  async deleteTask(id) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
      
      if (error) logError('deleteTask', error)
      return { error }
    } catch (error) {
      logError('deleteTask:catch', error)
      return { error }
    }
  },

  // Subtasks
  async createSubtask(subtask) {
    if (!supabase) return { data: null, error: null }
    
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .insert(subtask)
        .select()
        .single()
      
      if (error) logError('createSubtask', error)
      return { data, error }
    } catch (error) {
      logError('createSubtask:catch', error)
      return { data: null, error }
    }
  },

  async updateSubtask(id, updates) {
    if (!supabase) return { data: null, error: null }
    
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) logError('updateSubtask', error)
      return { data, error }
    } catch (error) {
      logError('updateSubtask:catch', error)
      return { data: null, error }
    }
  },

  async deleteSubtask(id) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', id)
      
      if (error) logError('deleteSubtask', error)
      return { error }
    } catch (error) {
      logError('deleteSubtask:catch', error)
      return { error }
    }
  },

  // Comments
  async createComment(comment) {
    if (!supabase) return { data: null, error: null }
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert(comment)
        .select('*')
        .single()
      
      if (error) logError('createComment', error)
      return { data, error }
    } catch (error) {
      logError('createComment:catch', error)
      return { data: null, error }
    }
  },

  // Project sharing - share by email
  // The user must have signed in at least once to exist in the users table
  async shareProject(projectId, email, role = 'editor') {
    if (!supabase) return { data: null, error: null }
    
    try {
      // Find user by email using RPC function (bypasses RLS)
      // First try direct lookup (will work if policies allow)
      let userId = null
      
      // Try to find the user - we need to use a function or service role for this
      // For now, we'll try the direct query which may work depending on RLS setup
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('email', email.toLowerCase())
        .maybeSingle()
      
      if (userError) {
        console.error('Error looking up user:', userError)
        return { data: null, error: { message: 'Unable to look up user. They may need to sign in first.' } }
      }

      if (!user) {
        return { 
          data: null, 
          error: { 
            message: 'User not found. They need to sign in to ResearchOS at least once before they can be invited.' 
          } 
        }
      }

      userId = user.id

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle()

      if (existingMember) {
        return { data: null, error: { message: 'This user is already a member of this project.' } }
      }

      // Add as project member
      const { data, error } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, user_id: userId, role })
        .select(`
          *,
          user:users(id, email, name, avatar_url)
        `)
        .single()
      
      if (error) {
        logError('shareProject', error)
        return { data: null, error: { message: 'Failed to add member. Please try again.' } }
      }
      
      return { data, error: null }
    } catch (error) {
      logError('shareProject:catch', error)
      return { data: null, error: { message: 'An unexpected error occurred.' } }
    }
  },

  async removeProjectMember(projectId, userId) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)
      
      if (error) logError('removeProjectMember', error)
      return { error }
    } catch (error) {
      logError('removeProjectMember:catch', error)
      return { error }
    }
  },

  // Real-time subscriptions
  subscribeToProject(projectId, callback) {
    if (!supabase) return null
    return supabase
      .channel(`project:${projectId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        filter: `project_id=eq.${projectId}` 
      }, callback)
      .subscribe()
  }
}
