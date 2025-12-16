-- ResearchOS Database Schema for Supabase (v2 - fixed RLS recursion)
-- Run this in your Supabase SQL Editor. It's idempotent.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------------------------------------
-- TABLES
--------------------------------------------------------------------------------

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '🧪',
  priority_rank INTEGER DEFAULT 2,
  current_stage_index INTEGER DEFAULT 0,
  publication_target TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project members (for sharing)
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor',
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
  is_completed BOOLEAN DEFAULT FALSE,
  reminder_date TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subtasks table
CREATE TABLE IF NOT EXISTS public.subtasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

--------------------------------------------------------------------------------
-- ENABLE RLS
--------------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- HELPER FUNCTIONS (SECURITY DEFINER to bypass RLS and avoid recursion)
--------------------------------------------------------------------------------

-- Check if current user is owner of a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND owner_id = auth.uid()
  );
$$;

-- Check if current user is a member of a project (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

-- Check if user can access a project (owner OR member)
CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_project_owner(p_project_id) OR public.is_project_member(p_project_id);
$$;

-- Get project_id from a stage_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_project_id_for_stage(p_stage_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT project_id FROM public.stages WHERE id = p_stage_id;
$$;

-- Get project_id from a task_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_project_id_for_task(p_task_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT s.project_id FROM public.stages s
  JOIN public.tasks t ON t.stage_id = s.id
  WHERE t.id = p_task_id;
$$;

--------------------------------------------------------------------------------
-- DROP OLD POLICIES (clean slate)
--------------------------------------------------------------------------------
DO $$ BEGIN
  -- users
  DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
  -- projects
  DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
  DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
  DROP POLICY IF EXISTS "Owners can update projects" ON public.projects;
  DROP POLICY IF EXISTS "Owners can delete projects" ON public.projects;
  DROP POLICY IF EXISTS "Temporary allow insert projects" ON public.projects;
  -- project_members
  DROP POLICY IF EXISTS "Project access for members" ON public.project_members;
  DROP POLICY IF EXISTS "Owners can manage members" ON public.project_members;
  -- stages
  DROP POLICY IF EXISTS "Stages viewable by project members" ON public.stages;
  DROP POLICY IF EXISTS "Stages manageable by project owners" ON public.stages;
  -- tasks
  DROP POLICY IF EXISTS "Tasks viewable by project members" ON public.tasks;
  DROP POLICY IF EXISTS "Tasks manageable by project members" ON public.tasks;
  -- subtasks
  DROP POLICY IF EXISTS "Subtasks viewable by project members" ON public.subtasks;
  DROP POLICY IF EXISTS "Subtasks manageable by project members" ON public.subtasks;
  -- comments
  DROP POLICY IF EXISTS "Comments viewable by project members" ON public.comments;
  DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
  DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
END $$;

--------------------------------------------------------------------------------
-- POLICIES: users
--------------------------------------------------------------------------------
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

--------------------------------------------------------------------------------
-- POLICIES: projects (no subquery to project_members; use helper)
--------------------------------------------------------------------------------
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR public.is_project_member(id)
  );

CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

--------------------------------------------------------------------------------
-- POLICIES: project_members (no subquery to projects; use helper)
--------------------------------------------------------------------------------
CREATE POLICY "Members can view membership" ON public.project_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR public.is_project_owner(project_id)
  );

CREATE POLICY "Owners can manage members" ON public.project_members
  FOR ALL TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

--------------------------------------------------------------------------------
-- POLICIES: stages
--------------------------------------------------------------------------------
CREATE POLICY "Stages access" ON public.stages
  FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Stages manage" ON public.stages
  FOR ALL TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

--------------------------------------------------------------------------------
-- POLICIES: tasks
--------------------------------------------------------------------------------
CREATE POLICY "Tasks access" ON public.tasks
  FOR SELECT TO authenticated
  USING (public.can_access_project(public.get_project_id_for_stage(stage_id)));

CREATE POLICY "Tasks manage" ON public.tasks
  FOR ALL TO authenticated
  USING (public.is_project_owner(public.get_project_id_for_stage(stage_id)))
  WITH CHECK (public.is_project_owner(public.get_project_id_for_stage(stage_id)));

--------------------------------------------------------------------------------
-- POLICIES: subtasks
--------------------------------------------------------------------------------
CREATE POLICY "Subtasks access" ON public.subtasks
  FOR SELECT TO authenticated
  USING (public.can_access_project(public.get_project_id_for_task(task_id)));

CREATE POLICY "Subtasks manage" ON public.subtasks
  FOR ALL TO authenticated
  USING (public.is_project_owner(public.get_project_id_for_task(task_id)))
  WITH CHECK (public.is_project_owner(public.get_project_id_for_task(task_id)));

--------------------------------------------------------------------------------
-- POLICIES: comments
--------------------------------------------------------------------------------
CREATE POLICY "Comments access" ON public.comments
  FOR SELECT TO authenticated
  USING (public.can_access_project(public.get_project_id_for_task(task_id)));

CREATE POLICY "Users can create comments" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments" ON public.comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

--------------------------------------------------------------------------------
-- TRIGGERS: updated_at
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at') THEN
    CREATE TRIGGER update_projects_updated_at
      BEFORE UPDATE ON public.projects
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tasks_updated_at') THEN
    CREATE TRIGGER update_tasks_updated_at
      BEFORE UPDATE ON public.tasks
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- TRIGGER: auto-create public.users row when auth.users row is created
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- Done!
--------------------------------------------------------------------------------
