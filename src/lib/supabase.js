import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Running in demo mode.')
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Database helper functions
export const db = {
  // Projects
  async getProjects(userId) {
    if (!supabase) return { data: [], error: null }
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_members(*), stages(*, tasks(*, subtasks(*), comments(*)))')
      .or(`owner_id.eq.${userId},project_members.user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async createProject(project) {
    if (!supabase) return { data: null, error: null }
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single()
    return { data, error }
  },

  async updateProject(id, updates) {
    if (!supabase) return { data: null, error: null }
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async deleteProject(id) {
    if (!supabase) return { error: null }
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
    return { error }
  },

  // Stages
  async createStage(stage) {
    if (!supabase) return { data: null, error: null }
    const { data, error } = await supabase
      .from('stages')
      .insert(stage)
      .select()
      .single()
    return { data, error }
  },

  async updateStage(id, updates) {
    if (!supabase) return { data: null, error: null }
    const { data, error } = await supabase
      .from('stages')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async deleteStage(id) {
    if (!supabase) return { error: null }
    const { error } = await supabase
      .from('stages')
      .delete()
      .eq('id', id)
    return { error }
  },

  // Tasks
  async createTask(task) {
    if (!supabase) return { data: null, error: null }
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()
    return { data, error }
  },

  async updateTask(id, updates) {
    if (!supabase) return { data: null, error: null }
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async deleteTask(id) {
    if (!supabase) return { error: null }
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    return { error }
  },

  // Subtasks
  async createSubtask(subtask) {
    if (!supabase) return { data: null, error: null }
    const { data, error } = await supabase
      .from('subtasks')
      .insert(subtask)
      .select()
      .single()
    return { data, error }
  },

  async updateSubtask(id, updates) {
    if (!supabase) return { data: null, error: null }
    const { data, error } = await supabase
      .from('subtasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async deleteSubtask(id) {
    if (!supabase) return { error: null }
    const { error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', id)
    return { error }
  },

  // Comments
  async createComment(comment) {
    if (!supabase) return { data: null, error: null }
    const { data, error } = await supabase
      .from('comments')
      .insert(comment)
      .select('*, user:users(name, avatar_url)')
      .single()
    return { data, error }
  },

  // Project sharing
  async shareProject(projectId, email, role = 'viewer') {
    if (!supabase) return { data: null, error: null }
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
    return { data, error }
  },

  async removeProjectMember(projectId, userId) {
    if (!supabase) return { error: null }
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
    return { error }
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
