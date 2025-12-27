import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const DEV = import.meta.env.DEV
const devLog = (...args) => { if (DEV) console.log(...args) }
const devWarn = (...args) => { if (DEV) console.warn(...args) }
const devErr = (...args) => { if (DEV) console.error(...args) }

// Validate that the anon key looks like a real JWT (starts with eyJ and is long enough)
const isValidSupabaseKey = (key) => {
  return key && key.startsWith('eyJ') && key.length > 100
}

const hasValidConfig = supabaseUrl && supabaseAnonKey && isValidSupabaseKey(supabaseAnonKey)

devLog('🔧 Supabase config present:', { url: !!supabaseUrl, keyLooksValid: isValidSupabaseKey(supabaseAnonKey), mode: hasValidConfig ? 'LIVE' : 'DEMO' })

if (!hasValidConfig) {
  devWarn('⚠️ Supabase credentials missing or invalid. Running in demo mode.')
  if (supabaseAnonKey && !isValidSupabaseKey(supabaseAnonKey)) {
    devWarn('⚠️ Your VITE_SUPABASE_ANON_KEY does not look like a valid Supabase key. (dev only)')
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

// Helper to log errors (dev only)
const logError = (operation, error) => {
  devErr(`❌ Database Error [${operation}]:`, error)
  return error
}

// Database helper functions
export const db = {
  // Projects - Get owned AND shared projects
  async getProjects(userId) {
    if (!supabase) return { data: [], error: null }
    
    try {
      devLog('📦 Loading projects for user:', userId)
      
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
          devWarn('⚠️ priority_rank column not found, falling back to basic query')
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
        devLog('📦 No projects found')
        return { data: [], error: null }
      }

      devLog(`📦 Found ${projects.length} projects (${ownedProjects?.length || 0} owned, ${sharedProjects.length} shared), loading details...`)

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

      devLog('✅ Projects loaded successfully:', projectsWithData.length)
      return { data: projectsWithData, error: null }
    } catch (error) {
      logError('getProjects:catch', error)
      return { data: [], error }
    }
  },

  async createProject(project) {
    if (!supabase) return { data: null, error: null }
    
    try {
      devLog('📝 Creating project:', project.title)
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single()
      
      if (error) {
        logError('createProject', error)
        return { data: null, error }
      }
      
      devLog('✅ Project created:', data.id)
      return { data, error: null }
    } catch (error) {
      logError('createProject:catch', error)
      return { data: null, error }
    }
  },

  async updateProject(id, updates) {
    if (!supabase) return { data: null, error: null }
    try {
      devLog('📝 Updating project:', id, updates)
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) {
        logError('updateProject', error)
      } else {
        devLog('✅ Project updated:', data?.id)
      }
      return { data, error }
    } catch (error) {
      logError('updateProject:catch', error)
      return { data: null, error }
    }
  },

  async deleteProject(id) {
    if (!supabase) return { error: null }
    
    try {
      devLog('🗑️ Deleting project:', id)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
      
      if (error) {
        logError('deleteProject', error)
        return { error }
      }
      
      devLog('✅ Project deleted')
      return { error: null }
    } catch (error) {
      logError('deleteProject:catch', error)
      return { error }
    }
  },

  // Today items: per-user per-day storage
  async getTodayItems(userId, day) {
    if (!supabase) return { data: null, error: null }
    try {
      const dayStr = (day instanceof Date) ? day.toISOString().slice(0,10) : day
      const { data, error } = await supabase
        .from('today_items')
        .select('items')
        .eq('user_id', userId)
        .eq('day', dayStr)
        .single()
      if (error && error.code !== 'PGRST116') {
        return { data: null, error }
      }
      return { data: data ? data.items : [], error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  async saveTodayItems(userId, day, items) {
    if (!supabase) return { data: null, error: null }
    try {
      const dayStr = (day instanceof Date) ? day.toISOString().slice(0,10) : day
      // upsert row for (user_id, day)
      const payload = { user_id: userId, day: dayStr, items: items, updated_at: new Date().toISOString() }
      const { data, error } = await supabase
        .from('today_items')
        .upsert(payload, { onConflict: '(user_id, day)' })
        .select()
        .single()
      if (error) return { data: null, error }
      return { data: data.items, error: null }
    } catch (error) {
      return { data: null, error }
    }
  },

  // Stages
  async createStage(stage) {
    if (!supabase) return { data: null, error: null }
    
    try {
      devLog('📝 Creating stage:', stage.name)
      const { data, error } = await supabase
        .from('stages')
        .insert(stage)
        .select()
        .single()
      
      if (error) logError('createStage', error)
      else devLog('✅ Stage created:', data.id)
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
      devLog('📝 Creating task:', task.title)
      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single()
      
      if (error) logError('createTask', error)
      else devLog('✅ Task created:', data.id)
      return { data, error }
    } catch (error) {
      logError('createTask:catch', error)
      return { data: null, error }
    }
  },

  async updateTask(id, updates) {
    if (!supabase) return { data: null, error: null }
    
    try {
      devLog('📝 Updating task:', id, updates)
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        logError('updateTask', error)
        return { data, error }
      }

      // If modified_by provided and project is shared, notify collaborators
      try {
        if (data && updates.modified_by) {
          // Determine project id via task -> stage -> project
          const { data: task } = await supabase
            .from('tasks')
            .select('stage_id, title')
            .eq('id', id)
            .single()
          if (task && task.stage_id) {
            const { data: stage } = await supabase
              .from('stages')
              .select('project_id')
              .eq('id', task.stage_id)
              .single()
            if (stage && stage.project_id) {
              const modifierId = updates.modified_by
              // If completion changed, use task_completed type
              if (Object.prototype.hasOwnProperty.call(updates, 'is_completed')) {
                const type = updates.is_completed ? 'task_completed' : 'task_uncompleted'
                await db.notifyCollaborators(stage.project_id, modifierId, {
                  type,
                  title: updates.is_completed ? 'Task completed' : 'Task updated',
                  message: `${task.title} (${updates.is_completed ? 'completed' : 'updated'})`,
                  task_id: id
                })
              } else {
                // Generic task modified
                await db.notifyCollaborators(stage.project_id, modifierId, {
                  type: 'task_modified',
                  title: 'Task modified',
                  message: `${task.title} → changes made`,
                  task_id: id
                })
              }
            }
          }
        }
      } catch (e) {
        // swallow notification errors but log
        logError('updateTask:notify', e)
      }

      devLog('✅ Task updated:', data?.id, 'reminder_date:', data?.reminder_date)
      return { data, error }
    } catch (error) {
      logError('updateTask:catch', error)
      return { data: null, error }
    }
  },
  async deleteTask(id) {
    if (!supabase) return { error: null }
    
    try {
      // Fetch task info to notify collaborators before deletion
      const { data: task } = await supabase
        .from('tasks')
        .select('title, stage_id')
        .eq('id', id)
        .single()

      // Determine project and notify
      if (task && task.stage_id) {
        const { data: stage } = await supabase
          .from('stages')
          .select('project_id')
          .eq('id', task.stage_id)
          .single()
        if (stage && stage.project_id) {
          try {
            await db.notifyCollaborators(stage.project_id, null, {
              type: 'task_deleted',
              title: 'Task deleted',
              message: `${task.title} was deleted`,
              task_id: id
            })
          } catch (e) {
            logError('deleteTask:notify', e)
          }
        }
      }

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
      devLog('📝 Updating subtask:', id, updates)
      const { data, error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) {
        logError('updateSubtask', error)
      } else {
        devLog('✅ Subtask updated:', data?.id)
        // Notify collaborators if not self
        if (data && updates.modified_by) {
          // Get project_id for this subtask
          const { data: task } = await supabase
            .from('tasks')
            .select('stage_id, title')
            .eq('id', data.task_id)
            .single()
          if (task && task.stage_id) {
            const { data: stage } = await supabase
              .from('stages')
              .select('project_id')
              .eq('id', task.stage_id)
              .single()
            if (stage && stage.project_id) {
              // Get all project members except the modifier
              const { data: members } = await supabase
                .from('project_members')
                .select('user_id')
                .eq('project_id', stage.project_id)
              const notifyIds = (members || []).map(m => m.user_id).filter(uid => uid !== updates.modified_by)
              // Also notify owner if not the modifier
              const { data: project } = await supabase
                .from('projects')
                .select('owner_id, title, emoji')
                .eq('id', stage.project_id)
                .single()
              if (project && project.owner_id && project.owner_id !== updates.modified_by && !notifyIds.includes(project.owner_id)) {
                notifyIds.push(project.owner_id)
              }
              // Get modifier's name
              let modifierName = ''
              if (updates.modified_by) {
                const { data: userData } = await supabase
                  .from('users')
                  .select('name, email')
                  .eq('id', updates.modified_by)
                  .single()
                modifierName = userData?.name || userData?.email || 'Someone'
              }
              // Create notifications
              for (const uid of notifyIds) {
                await supabase.from('notifications').insert({
                  user_id: uid,
                  type: 'subtask_modified',
                  title: 'Subtask modified',
                  message: `${project?.emoji || ''} ${project?.title || ''}: ${task.title} → ${data.title} (by ${modifierName})`,
                  project_id: stage.project_id,
                  task_id: data.task_id,
                  subtask_id: data.id,
                  is_read: false
                })
              }
            }
          }
        }
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
      // Notify collaborators about new comment
      try {
        if (data && comment.user_id) {
          // Lookup task -> stage -> project
          const { data: task } = await supabase
            .from('tasks')
            .select('title, stage_id')
            .eq('id', comment.task_id)
            .single()
          if (task && task.stage_id) {
            const { data: stage } = await supabase
              .from('stages')
              .select('project_id')
              .eq('id', task.stage_id)
              .single()
            if (stage && stage.project_id) {
              await db.notifyCollaborators(stage.project_id, comment.user_id, {
                type: 'comment_added',
                title: 'New comment',
                message: `${task.title}: ${comment.content}`,
                task_id: comment.task_id
              })
            }
          }
        }
      } catch (e) {
        logError('createComment:notify', e)
      }

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
      devLog('🔍 shareProject: Looking up user by email:', normalizedEmail)
      
      // Try to find existing user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, name')
        .ilike('email', normalizedEmail)
        .maybeSingle()
      
      if (userError && userError.code !== 'PGRST116') {
        devErr('Error looking up user:', userError)
      }
      
      devLog('🔍 shareProject: User lookup result:', { found: !!user, user, error: userError })

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
        devLog('📝 Adding existing user as member:', { projectId, userId: user.id, role })
        const { data, error } = await supabase
          .from('project_members')
          .insert({ project_id: projectId, user_id: user.id, role })
          .select()
          .single()
        
        if (error) {
          logError('shareProject:insert', error)
          devErr('Insert error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint })
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
        devLog('✅ Member added successfully:', memberWithUser)
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
      devLog('📝 Updating member priority:', { projectId, userId, priorityRank })
      const { error } = await supabase
        .from('project_members')
        .update({ priority_rank: priorityRank })
        .eq('project_id', projectId)
        .eq('user_id', userId)
      
      if (error) {
        logError('updateMemberPriority', error)
        return { error }
      }
      
      devLog('✅ Member priority updated')
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
    
    // Start the subscription and return the channel object so callers
    // can remove it later with `db.unsubscribe(channel)`.
    try {
      channel.subscribe()
    } catch (e) {
      devWarn('Failed to start channel subscription (ignored):', e)
    }
    return channel
  },

  // Unsubscribe from a channel
  unsubscribe(channel) {
    if (!supabase || !channel) return
    try {
      // If it's a RealtimeChannel, remove via supabase SDK
      if (channel && (channel.topic || channel.name || channel.unsubscribe)) {
        // If it has an unsubscribe method, call it first
        if (typeof channel.unsubscribe === 'function') {
          try { channel.unsubscribe() } catch (e) { devWarn('channel.unsubscribe failed:', e) }
        }
        try { supabase.removeChannel(channel) } catch (e) { devWarn('removeChannel failed, ignored:', e) }
        return
      }
      // Fallback
      supabase.removeChannel(channel)
    } catch (e) {
      devWarn('unsubscribe error:', e)
    }
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
      // Use upsert with onConflict to avoid creating duplicate notifications
      // for the same (user_id, type, task_id, subtask_id) combination.
      const conflictCols = ['user_id', 'type', 'task_id', 'subtask_id']
      const { data, error } = await supabase
        .from('notifications')
        .upsert(notification, { onConflict: conflictCols })
        .select()
        .single()

      if (error) {
        // If the error is due to unique constraint, try to fetch the existing notification and return it.
        const msg = (error && (error.message || '')).toString().toLowerCase()
        if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('constraint')) {
          try {
            const matchQuery = {
              user_id: notification.user_id,
              type: notification.type,
              task_id: notification.task_id || null,
              subtask_id: notification.subtask_id || null
            }
            const { data: existing, error: getErr } = await supabase
              .from('notifications')
              .select('*')
              .match(matchQuery)
              .limit(1)
              .single()
            if (!getErr) return { data: existing, error: null }
          } catch (e) {
            // fallthrough to log
          }
        }
        logError('createNotification', error)
        return { data: null, error }
      }
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
      
      // Create notifications for all collaborators (use upsert to avoid duplicates)
      const conflictCols = ['user_id', 'type', 'task_id', 'subtask_id']
      const notifications = Array.from(userIds).map(userId => ({
        user_id: userId,
        type: notification.type,
        title: notification.title,
        message: `${project.emoji} ${project.title} - ${notification.message}`,
        project_id: projectId,
        task_id: notification.task_id || null,
        subtask_id: notification.subtask_id || null,
        is_read: false,
        created_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('notifications')
        .upsert(notifications, { onConflict: conflictCols })

      if (error) logError('notifyCollaborators', error)
      return { error }
    } catch (error) {
      logError('notifyCollaborators:catch', error)
      return { error }
    }
  }
}
