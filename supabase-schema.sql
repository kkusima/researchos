-- ResearchOS Database Schema for Supabase
-- Idempotent version: safe to run multiple times

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 
-- TRIGGERS & FUNCTIONS FOR AUTOMATIC TIMESTAMP UPDATES
--

-- Function to handle project timestamp updates
CREATE OR REPLACE FUNCTION public.handle_project_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  project_id_val UUID;
  user_id_val UUID;
BEGIN
  -- Determine project_id and user_id based on table
  IF TG_TABLE_NAME = 'tasks' THEN
    IF (TG_OP = 'DELETE') THEN
       SELECT project_id INTO project_id_val FROM public.stages WHERE id = OLD.stage_id;
       user_id_val := OLD.modified_by; 
    ELSE
       SELECT project_id INTO project_id_val FROM public.stages WHERE id = NEW.stage_id;
       user_id_val := NEW.modified_by;
    END IF;
  ELSIF TG_TABLE_NAME = 'subtasks' THEN
     IF (TG_OP = 'DELETE') THEN
       SELECT s.project_id INTO project_id_val 
       FROM public.stages s
       JOIN public.tasks t ON t.stage_id = s.id
       WHERE t.id = OLD.task_id;
       user_id_val := OLD.modified_by;
     ELSE
       SELECT s.project_id INTO project_id_val 
       FROM public.stages s
       JOIN public.tasks t ON t.stage_id = s.id
       WHERE t.id = NEW.task_id;
       user_id_val := NEW.modified_by;
     END IF;
  END IF;

  -- Update Project
  IF project_id_val IS NOT NULL THEN
    UPDATE public.projects 
    SET updated_at = NOW(), 
        modified_by = user_id_val
    WHERE id = project_id_val;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if any to avoid errors
DROP TRIGGER IF EXISTS on_task_change ON public.tasks;
DROP TRIGGER IF EXISTS on_subtask_change ON public.subtasks;

-- Create Triggers
CREATE TRIGGER on_task_change
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_project_updated_at();

CREATE TRIGGER on_subtask_change
  AFTER INSERT OR UPDATE OR DELETE ON public.subtasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_project_updated_at();

-- Policies (examples, ensure specific policies match your auth requirements)
-- Users can see their own data and shared projects data
-- ... (Existing policies assumed to be managed via Supabase UI or earlier scripts)
