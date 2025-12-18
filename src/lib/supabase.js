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

      // Then get projects where user is a member (including their personal priority)
      // Try with priority_rank first, fall back to just project_id if column doesn't exist
      let membershipData = null
      let memberError = null
      
      const { data: memberData, error: memberErr } = await supabase
        .from('project_members')
        .select('project_id, priority_rank')
        .eq('user_id', userId)
      
      if (memberErr) {
        // If error mentions priority_rank column, try without it
        if (memberErr.message?.includes('priority_rank') || memberErr.code === 'PGRST204') {
          console.log('⚠️ priority_rank column not found, falling back to basic query')
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', userId)
          membershipData = fallbackData
          memberError = fallbackError
        } else {
          memberError = memberErr
        }
      } else {
        membershipData = memberData
      }
      
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
      // Build a map of member priorities for shared projects
      const memberPriorityMap = new Map()
      if (membershipData) {
        membershipData.forEach(m => memberPriorityMap.set(m.project_id, m.priority_rank))
      }
      
      const allProjectsMap = new Map()
      ;(ownedProjects || []).forEach(p => {
        allProjectsMap.set(p.id, { ...p, isOwner: true })
      })
      sharedProjects.forEach(p => {
        if (!allProjectsMap.has(p.id)) {
          // Use member's personal priority if set, otherwise use project's priority
          const memberPriority = memberPriorityMap.get(p.id)
          const effectivePriority = (memberPriority !== null && memberPriority !== undefined && memberPriority !== 999) 
            ? memberPriority 
            : p.priority_rank
          allProjectsMap.set(p.id, { ...p, isOwner: false, priority_rank: effectivePriority, _memberPriority: memberPriority })
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
          
          // Build a map of user IDs to names for looking up modified_by names
          const userMap = new Map()
          if (members) {
            members.forEach(m => {
              if (m.user) userMap.set(m.user.id, m.user.name || m.user.email)
            })
          }
          // Also add the owner
          if (project.owner_id) {
            const { data: ownerData } = await supabase
              .from('users')
              .select('id, name, email')
              .eq('id', project.owner_id)
              .single()
            if (ownerData) {
              userMap.set(ownerData.id, ownerData.name || ownerData.email)
            }
          }
          
          // Add modified_by_name to tasks and subtasks
          const stagesWithNames = stagesWithTasks.map(stage => ({
            ...stage,
            tasks: stage.tasks.map(task => ({
              ...task,
              created_by_name: task.created_by ? userMap.get(task.created_by) : null,
              modified_by_name: task.modified_by ? userMap.get(task.modified_by) : null,
              subtasks: task.subtasks.map(st => ({
                ...st,
                created_by_name: st.created_by ? userMap.get(st.created_by) : null,
                modified_by_name: st.modified_by ? userMap.get(st.modified_by) : null
              }))
            }))
          }))
          
          // Get project modified_by_name
          let projectModifiedByName = null
          if (project.modified_by) {
            projectModifiedByName = userMap.get(project.modified_by)
            if (!projectModifiedByName) {
              const { data: modifierData } = await supabase
                .from('users')
                .select('id, name, email')
                .eq('id', project.modified_by)
                .single()
              if (modifierData) {
                projectModifiedByName = modifierData.name || modifierData.email
              }
            }
          }

          return { 
            ...project, 
            modified_by_name: projectModifiedByName,
            stages: stagesWithNames,
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
      console.log('📝 Updating task:', id, updates)
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        logError('updateTask', error)
      } else {
        console.log('✅ Task updated:', data?.id, 'reminder_date:', data?.reminder_date)
      }
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
      console.log('📝 Updating subtask:', id, updates)
      const { data, error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        logError('updateSubtask', error)
      } else {
        console.log('✅ Subtask updated:', data?.id)
      }
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
  // If user exists, add them directly. If not, create an invitation.
  async shareProject(projectId, email, role = 'editor', invitedBy = null) {
    if (!supabase) return { data: null, error: null }
    
    try {
      const normalizedEmail = email.toLowerCase().trim()
      console.log('🔍 shareProject: Looking up user by email:', normalizedEmail)
      
      // Try to find existing user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, name')
        .ilike('email', normalizedEmail)
        .maybeSingle()
      
      if (userError && userError.code !== 'PGRST116') {
        console.error('Error looking up user:', userError)
      }
      
      console.log('🔍 shareProject: User lookup result:', { found: !!user, user, error: userError })

      // If user exists, add them directly
      if (user) {
        // Check if already a member
        const { data: existingMember } = await supabase
          .from('project_members')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existingMember) {
          return { data: null, error: { message: 'This user is already a member of this project.' } }
        }

        // Add as project member
        console.log('📝 Adding existing user as member:', { projectId, userId: user.id, role })
        const { data, error } = await supabase
          .from('project_members')
          .insert({ project_id: projectId, user_id: user.id, role })
          .select()
          .single()
        
        if (error) {
          logError('shareProject:insert', error)
          console.error('Insert error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint })
          return { data: null, error: { message: `Failed to add member: ${error.message || 'Unknown error'}` } }
        }
        
        // Get project details for the notification
        const { data: project } = await supabase
          .from('projects')
          .select('title, emoji')
          .eq('id', projectId)
          .single()
        
        // Create a notification for the new member
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'project_shared',
            title: 'You were added to a project',
            message: project ? `${project.emoji} ${project.title}` : 'You now have access to a shared project',
            project_id: projectId,
            is_read: false
          })
        
        // Fetch user details separately to avoid potential join issues
        const memberWithUser = { ...data, user }
        console.log('✅ Member added successfully:', memberWithUser)
        return { data: memberWithUser, error: null, type: 'added' }
      }

      // User doesn't exist - create an invitation
      // Check if invitation already exists
      const { data: existingInvite } = await supabase
        .from('project_invitations')
        .select('*')
        .eq('project_id', projectId)
        .ilike('email', normalizedEmail)
        .maybeSingle()

      if (existingInvite) {
        if (existingInvite.status === 'pending') {
          // Return the existing invitation so user can copy the link
          return { 
            data: existingInvite, 
            error: null, 
            type: 'existing',
            message: `An invitation was already sent to ${email}. Here's the link again!`
          }
        }
        // If expired or other status, delete and create new
        await supabase
          .from('project_invitations')
          .delete()
          .eq('id', existingInvite.id)
      }

      // Create invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('project_invitations')
        .insert({
          project_id: projectId,
          email: normalizedEmail,
          role,
          invited_by: invitedBy
        })
        .select()
        .single()

      if (inviteError) {
        logError('createInvitation', inviteError)
        return { data: null, error: { message: 'Failed to create invitation.' } }
      }

      return { 
        data: invitation, 
        error: null, 
        type: 'invited',
        message: `Invitation created! Share this link with ${email}`
      }
    } catch (error) {
      logError('shareProject:catch', error)
      return { data: null, error: { message: 'An unexpected error occurred.' } }
    }
  },

  // Get pending invitations for a project
  async getProjectInvitations(projectId) {
    if (!supabase) return { data: [], error: null }
    
    try {
      const { data, error } = await supabase
        .from('project_invitations')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) logError('getProjectInvitations', error)
      return { data: data || [], error }
    } catch (error) {
      logError('getProjectInvitations:catch', error)
      return { data: [], error }
    }
  },

  // Cancel a pending invitation
  async cancelInvitation(invitationId) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('project_invitations')
        .delete()
        .eq('id', invitationId)

      if (error) logError('cancelInvitation', error)
      return { error }
    } catch (error) {
      logError('cancelInvitation:catch', error)
      return { error }
    }
  },

  // Accept a specific invitation by token
  async acceptInvitationByToken(token, userId) {
    if (!supabase) return { data: null, error: null }
    
    try {
      // First, get the invitation
      const { data: invitation, error: fetchError } = await supabase
        .from('project_invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single()

      if (fetchError || !invitation) {
        return { data: null, error: fetchError || new Error('Invitation not found or expired') }
      }

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        return { data: null, error: new Error('Invitation has expired') }
      }

      // Add user as project member
      const { error: memberError } = await supabase
        .from('project_members')
        .upsert({
          project_id: invitation.project_id,
          user_id: userId,
          role: invitation.role
        }, { onConflict: 'project_id,user_id' })

      if (memberError) {
        logError('acceptInvitationByToken:addMember', memberError)
        return { data: null, error: memberError }
      }

      // Mark invitation as accepted
      await supabase
        .from('project_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id)

      // Get project details for the notification
      const { data: project } = await supabase
        .from('projects')
        .select('title, emoji')
        .eq('id', invitation.project_id)
        .single()

      // Create a notification for the new member
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'project_shared',
          title: 'You were added to a project',
          message: project ? `${project.emoji} ${project.title}` : 'You now have access to a shared project',
          project_id: invitation.project_id,
          is_read: false
        })

      return { data: { projectId: invitation.project_id, role: invitation.role }, error: null }
    } catch (error) {
      logError('acceptInvitationByToken:catch', error)
      return { data: null, error }
    }
  },

  // Check and accept pending invitations for current user
  async acceptPendingInvitations(userEmail) {
    if (!supabase) return { data: [], error: null }
    
    try {
      // Get pending invitations for this email
      const { data: invitations, error: fetchError } = await supabase
        .from('project_invitations')
        .select('*')
        .ilike('email', userEmail.toLowerCase())
        .eq('status', 'pending')

      if (fetchError || !invitations?.length) {
        return { data: [], error: fetchError }
      }

      // The database trigger should have already handled this on sign-up
      // But we'll also check here for cases where the trigger didn't fire
      return { data: invitations, error: null }
    } catch (error) {
      logError('acceptPendingInvitations:catch', error)
      return { data: [], error }
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

  // Update member's personal priority for a shared project
  async updateMemberPriority(projectId, userId, priorityRank) {
    if (!supabase) return { error: null }
    
    try {
      console.log('📝 Updating member priority:', { projectId, userId, priorityRank })
      const { error } = await supabase
        .from('project_members')
        .update({ priority_rank: priorityRank })
        .eq('project_id', projectId)
        .eq('user_id', userId)
      
      if (error) {
        logError('updateMemberPriority', error)
        return { error }
      }
      
      console.log('✅ Member priority updated')
      return { error: null }
    } catch (error) {
      logError('updateMemberPriority:catch', error)
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
  },

  // Subscribe to all changes for a user's projects (for real-time sync)
  subscribeToUserProjects(userId, projectIds, callback) {
    if (!supabase || !projectIds || projectIds.length === 0) return null
    
    const channel = supabase.channel(`user-projects:${userId}`)
    
    // Subscribe to project changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'projects'
    }, (payload) => {
      if (projectIds.includes(payload.new?.id) || projectIds.includes(payload.old?.id)) {
        callback(payload)
      }
    })
    
    // Subscribe to stage changes  
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'stages'
    }, (payload) => {
      if (projectIds.includes(payload.new?.project_id) || projectIds.includes(payload.old?.project_id)) {
        callback(payload)
      }
    })
    
    // Subscribe to task changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks'
    }, callback)
    
    // Subscribe to subtask changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'subtasks'
    }, callback)
    
    // Subscribe to project_members changes (for sharing updates)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'project_members'
    }, (payload) => {
      if (payload.new?.user_id === userId || payload.old?.user_id === userId || 
          projectIds.includes(payload.new?.project_id) || projectIds.includes(payload.old?.project_id)) {
        callback(payload)
      }
    })
    
    // Subscribe to notification changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, callback)
    
    return channel.subscribe()
  },

  // Unsubscribe from a channel
  unsubscribe(channel) {
    if (!supabase || !channel) return
    supabase.removeChannel(channel)
  },

  // Notifications
  async getNotifications(userId) {
    if (!supabase) return { data: [], error: null }
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) logError('getNotifications', error)
      return { data: data || [], error }
    } catch (error) {
      logError('getNotifications:catch', error)
      return { data: [], error }
    }
  },

  async createNotification(notification) {
    if (!supabase) return { data: null, error: null }
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single()

      if (error) logError('createNotification', error)
      return { data, error }
    } catch (error) {
      logError('createNotification:catch', error)
      return { data: null, error }
    }
  },

  async markNotificationRead(id) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)

      if (error) logError('markNotificationRead', error)
      return { error }
    } catch (error) {
      logError('markNotificationRead:catch', error)
      return { error }
    }
  },

  async markNotificationUnread(id) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: false })
        .eq('id', id)

      if (error) logError('markNotificationUnread', error)
      return { error }
    } catch (error) {
      logError('markNotificationUnread:catch', error)
      return { error }
    }
  },

  async markAllNotificationsRead(userId) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) logError('markAllNotificationsRead', error)
      return { error }
    } catch (error) {
      logError('markAllNotificationsRead:catch', error)
      return { error }
    }
  },

  async deleteNotification(id) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)

      if (error) logError('deleteNotification', error)
      return { error }
    } catch (error) {
      logError('deleteNotification:catch', error)
      return { error }
    }
  },

  async clearAllNotifications(userId) {
    if (!supabase) return { error: null }
    
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)

      if (error) logError('clearAllNotifications', error)
      return { error }
    } catch (error) {
      logError('clearAllNotifications:catch', error)
      return { error }
    }
  },

  // Notify all project collaborators about a change (excludes the person who made the change)
  async notifyCollaborators(projectId, excludeUserId, notification) {
    if (!supabase) return { error: null }
    
    try {
      // Get project owner and members
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id, title, emoji')
        .eq('id', projectId)
        .single()
      
      if (!project) return { error: null }
      
      const { data: members } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
      
      // Collect all user IDs to notify (owner + members, excluding the one who made the change)
      const userIds = new Set()
      if (project.owner_id !== excludeUserId) {
        userIds.add(project.owner_id)
      }
      if (members) {
        members.forEach(m => {
          if (m.user_id !== excludeUserId) {
            userIds.add(m.user_id)
          }
        })
      }
      
      if (userIds.size === 0) return { error: null }
      
      // Create notifications for all collaborators
      const notifications = Array.from(userIds).map(userId => ({
        user_id: userId,
        type: notification.type,
        title: notification.title,
        message: `${project.emoji} ${project.title} - ${notification.message}`,
        project_id: projectId,
        task_id: notification.task_id || null,
        subtask_id: notification.subtask_id || null,
        is_read: false
      }))
      
      const { error } = await supabase
        .from('notifications')
        .insert(notifications)
      
      if (error) logError('notifyCollaborators', error)
      return { error }
    } catch (error) {
      logError('notifyCollaborators:catch', error)
      return { error }
    }
  }
}
