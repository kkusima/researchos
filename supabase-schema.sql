-- HypotheSys™ Database Schema for Supabase
-- Idempotent version: safe to run multiple times

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  email_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '🚀',
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  priority_rank INTEGER DEFAULT 999,
  current_stage_index INTEGER DEFAULT 0,
  modified_by UUID REFERENCES public.users(id),
  archived BOOLEAN DEFAULT FALSE
);

-- Project Members table (for sharing)
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor', -- 'editor', 'viewer'
  priority_rank INTEGER DEFAULT 999, -- Personal priority for this user
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Stages table
CREATE TABLE IF NOT EXISTS public.stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stage_id UUID NOT NULL REFERENCES public.stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  reminder_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  modified_by UUID REFERENCES public.users(id)
);

-- Subtasks table
CREATE TABLE IF NOT EXISTS public.subtasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  reminder_date TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  modified_by UUID REFERENCES public.users(id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe migration for existing tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'comments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.comments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  -- Add email_notifications column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE public.users ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE;
  END IF;
END;
$$;

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'task_reminder', 'subtask_reminder', 'project_shared', 'project_invite', 'task_created', 'subtask_created', 'task_reminder_set', 'subtask_reminder_set', 'task_overdue', 'subtask_overdue'
  title TEXT NOT NULL,
  message TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  subtask_id UUID REFERENCES public.subtasks(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  reminder_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Task Tags table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.task_tags (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, tag_id)
);

-- Subtask Tags table (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.subtask_tags (
  subtask_id UUID NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (subtask_id, tag_id)
);

-- Prevent duplicate notifications for the same user and entity/type combination.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_unique_per_entity'
  ) THEN
    EXECUTE 'ALTER TABLE public.notifications ADD CONSTRAINT notifications_unique_per_entity UNIQUE (user_id, type, task_id, subtask_id)';
  END IF;
END;
$$;

-- Today items table
CREATE TABLE IF NOT EXISTS public.today_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day)
);

-- Project invitations
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'editor',
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  UNIQUE(project_id, email)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_stages_project ON public.stages(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON public.tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON public.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task ON public.comments(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_today_items_user_day ON public.today_items(user_id, day);
CREATE INDEX IF NOT EXISTS idx_tags_user ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_task ON public.task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON public.task_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_subtask_tags_subtask ON public.subtask_tags(subtask_id);

-- Enable Row Level Security (Schema continues same as before...)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.today_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtask_tags ENABLE ROW LEVEL SECURITY;

-- 
-- RLS POLICIES
--

-- Projects: Owners and members can view/manage
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;
CREATE POLICY "Users can view projects they are members of" ON public.projects
  FOR SELECT USING (
    owner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = projects.id AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners can manage their projects" ON public.projects;
CREATE POLICY "Owners can manage their projects" ON public.projects
  FOR ALL USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Project Members: Owner can manage, members can view
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
CREATE POLICY "Users can view project members" ON public.project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_members.project_id 
      AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage project members" ON public.project_members;
CREATE POLICY "Owners can manage project members" ON public.project_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
  );

-- Stages: Project access required
DROP POLICY IF EXISTS "Users can manage stages" ON public.stages;
CREATE POLICY "Users can manage stages" ON public.stages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      LEFT JOIN public.project_members pm ON pm.project_id = p.id
      WHERE p.id = stages.project_id
      AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
  );

-- Tasks: Project access required
DROP POLICY IF EXISTS "Users can manage tasks" ON public.tasks;
CREATE POLICY "Users can manage tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stages s
      JOIN public.projects p ON s.project_id = p.id
      LEFT JOIN public.project_members pm ON pm.project_id = p.id
      WHERE s.id = tasks.stage_id
      AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
  );

-- Subtasks: Project access required
DROP POLICY IF EXISTS "Users can manage subtasks" ON public.subtasks;
CREATE POLICY "Users can manage subtasks" ON public.subtasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.stages s ON t.stage_id = s.id
      JOIN public.projects p ON s.project_id = p.id
      LEFT JOIN public.project_members pm ON pm.project_id = p.id
      WHERE t.id = subtasks.task_id
      AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
  );

-- Comments: Project access required
DROP POLICY IF EXISTS "Users can manage comments" ON public.comments;
CREATE POLICY "Users can manage comments" ON public.comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.stages s ON t.stage_id = s.id
      JOIN public.projects p ON s.project_id = p.id
      LEFT JOIN public.project_members pm ON pm.project_id = p.id
      WHERE t.id = comments.task_id
      AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
  );

-- 
-- RLS POLICIES FOR TAGS
--
-- Tags: Users can manage their own tags
DROP POLICY IF EXISTS "Users can manage own tags" ON public.tags;
CREATE POLICY "Users can manage own tags" ON public.tags
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Task Tags: Users can manage tags on tasks they have access to
DROP POLICY IF EXISTS "Users can manage task tags" ON public.task_tags;
CREATE POLICY "Users can manage task tags" ON public.task_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.stages s ON t.stage_id = s.id
      JOIN public.projects p ON s.project_id = p.id
      LEFT JOIN public.project_members pm ON pm.project_id = p.id
      WHERE t.id = task_tags.task_id
      AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
  );

-- Subtask Tags: Users can manage tags on subtasks they have access to
DROP POLICY IF EXISTS "Users can manage subtask tags" ON public.subtask_tags;
CREATE POLICY "Users can manage subtask tags" ON public.subtask_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.subtasks st
      JOIN public.tasks t ON st.task_id = t.id
      JOIN public.stages s ON t.stage_id = s.id
      JOIN public.projects p ON s.project_id = p.id
      LEFT JOIN public.project_members pm ON pm.project_id = p.id
      WHERE st.id = subtask_tags.subtask_id
      AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
    )
  );

-- 
-- TRIGGERS & FUNCTIONS FOR AUTOMATIC TIMESTAMP UPDATES
--

-- Function to handle project timestamp updates
-- Function: When a Subtask or Comment changes, update the parent Task
CREATE OR REPLACE FUNCTION public.handle_task_child_change()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_task_id UUID;
  modifier_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'subtasks' THEN
    IF (TG_OP = 'DELETE') THEN
       target_task_id := OLD.task_id;
       modifier_id := OLD.modified_by; 
    ELSE
       target_task_id := NEW.task_id;
       modifier_id := NEW.modified_by;
    END IF;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    IF (TG_OP = 'DELETE') THEN
       target_task_id := OLD.task_id; 
       modifier_id := OLD.user_id;
    ELSE
       target_task_id := NEW.task_id;
       modifier_id := NEW.user_id;
    END IF;
  END IF;

  IF target_task_id IS NOT NULL THEN
    UPDATE public.tasks 
    SET updated_at = NOW(), 
        modified_by = modifier_id
    WHERE id = target_task_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to handle project timestamp updates (Only triggered by Tasks now)
CREATE OR REPLACE FUNCTION public.handle_project_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_id_val UUID;
  user_id_val UUID := null; -- Start as null
BEGIN
  IF TG_TABLE_NAME = 'stages' THEN
    IF (TG_OP = 'DELETE') THEN
       project_id_val := OLD.project_id;
    ELSE
       project_id_val := NEW.project_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    IF (TG_OP = 'DELETE') THEN
       SELECT project_id INTO project_id_val FROM public.stages WHERE id = OLD.stage_id;
       user_id_val := OLD.modified_by; 
    ELSE
       SELECT project_id INTO project_id_val FROM public.stages WHERE id = NEW.stage_id;
       user_id_val := NEW.modified_by;
    END IF;
  END IF;

  -- Update Project
  IF project_id_val IS NOT NULL THEN
    UPDATE public.projects 
    SET updated_at = NOW(), 
        modified_by = COALESCE(user_id_val, modified_by)
    WHERE id = project_id_val;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if any to avoid errors
DROP TRIGGER IF EXISTS on_task_change ON public.tasks;
DROP TRIGGER IF EXISTS on_subtask_change ON public.subtasks;
DROP TRIGGER IF EXISTS on_subtask_update_task ON public.subtasks;
DROP TRIGGER IF EXISTS on_comment_update_task ON public.comments;

-- Create Triggers
-- 1. Tasks -> Projects
CREATE TRIGGER on_task_change
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_project_updated_at();

-- 1b. Stages -> Projects
DROP TRIGGER IF EXISTS on_stage_change ON public.stages;
CREATE TRIGGER on_stage_change
  AFTER INSERT OR UPDATE OR DELETE ON public.stages
  FOR EACH ROW EXECUTE PROCEDURE public.handle_project_updated_at();

-- 2. Subtasks -> Tasks (Cascade)
CREATE TRIGGER on_subtask_update_task
  AFTER INSERT OR UPDATE OR DELETE ON public.subtasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_task_child_change();

-- 3. Comments -> Tasks (Cascade)
CREATE TRIGGER on_comment_update_task
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_task_child_change();

