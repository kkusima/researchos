import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('🔧 Supabase Config:', {
  url: supabaseUrl ? '✅ Set' : '❌ Missing',
  key: supabaseAnonKey ? `✅ Set (${supabaseAnonKey.substring(0, 20)}...)` : '❌ Missing'
})

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not found. Running in demo mode.')
}

export const supabase = supabaseUrl && supabaseAnonKey 
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
  // Projects - FIXED: Simplified query to avoid nested join issues
  async getProjects(userId) {
    if (!supabase) return { data: [], error: null }
    
    try {
      console.log('📦 Loading projects for user:', userId)
      
      // First, get projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', userId)
        .order('priority_rank', { ascending: true })
      
      if (projectsError) {
        logError('getProjects', projectsError)
        return { data: [], error: projectsError }
      }

      if (!projects || projects.length === 0) {
        console.log('📦 No projects found')
        return { data: [], error: null }
      }

      console.log(`📦 Found ${projects.length} projects, loading details...`)

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

          // Get project members
          const { data: members } = await supabase
            .from('project_members')
            .select('*')
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

  // Project sharing
  async shareProject(projectId, email, role = 'viewer') {
    if (!supabase) return { data: null, error: null }
    
    try {
      // First find user by email
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single()
      
      if (userError || !user) {
        return { data: null, error: { message: 'User not found' } }
      }

      const { data, error } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, user_id: user.id, role })
        .select()
        .single()
      
      if (error) logError('shareProject', error)
      return { data, error }
    } catch (error) {
      logError('shareProject:catch', error)
      return { data: null, error }
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
