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
  role TEXT DEFAULT 'editor', -- 'viewer', 'editor', 'admin'
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

-- Enable Row Level Security on tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Users policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Users can view own profile'
      AND n.nspname = 'public' AND c.relname = 'users'
  ) THEN
    CREATE POLICY "Users can view own profile" ON public.users
      FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
  END IF;
END;
$$;

-- Allow users to look up other users by email (for sharing/inviting)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Users can lookup others by email'
      AND n.nspname = 'public' AND c.relname = 'users'
  ) THEN
    CREATE POLICY "Users can lookup others by email" ON public.users
      FOR SELECT TO authenticated USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Users can update own profile'
      AND n.nspname = 'public' AND c.relname = 'users'
  ) THEN
    CREATE POLICY "Users can update own profile" ON public.users
      FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Users can insert own profile'
      AND n.nspname = 'public' AND c.relname = 'users'
  ) THEN
    CREATE POLICY "Users can insert own profile" ON public.users
      FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
  END IF;
END;
$$;

-- Projects policies (view, create, update, delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Users can view own projects'
      AND n.nspname = 'public' AND c.relname = 'projects'
  ) THEN
    CREATE POLICY "Users can view own projects" ON public.projects
      FOR SELECT TO authenticated USING (
        owner_id = (SELECT auth.uid()) OR
        id IN (SELECT project_id FROM public.project_members WHERE user_id = (SELECT auth.uid()))
      );
  END IF;
END;
$$;

-- We'll create a trigger to set owner_id automatically (see function below).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Users can create projects'
      AND n.nspname = 'public' AND c.relname = 'projects'
  ) THEN
    -- Create policy but ensure it's scoped to authenticated users.
    CREATE POLICY "Users can create projects" ON public.projects
      FOR INSERT TO authenticated
      WITH CHECK (owner_id = (SELECT auth.uid()));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Owners can update projects'
      AND n.nspname = 'public' AND c.relname = 'projects'
  ) THEN
    CREATE POLICY "Owners can update projects" ON public.projects
      FOR UPDATE TO authenticated USING (owner_id = (SELECT auth.uid()));
  END IF;
END;
$$;

-- Project members with editor/admin role can update projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Editors can update projects'
      AND n.nspname = 'public' AND c.relname = 'projects'
  ) THEN
    CREATE POLICY "Editors can update projects" ON public.projects
      FOR UPDATE TO authenticated USING (
        id IN (
          SELECT project_id FROM public.project_members 
          WHERE user_id = (SELECT auth.uid()) AND role IN ('editor', 'admin')
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Owners can delete projects'
      AND n.nspname = 'public' AND c.relname = 'projects'
  ) THEN
    CREATE POLICY "Owners can delete projects" ON public.projects
      FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));
  END IF;
END;
$$;

-- Project members policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Project access for members'
      AND n.nspname = 'public' AND c.relname = 'project_members'
  ) THEN
    CREATE POLICY "Project access for members" ON public.project_members
      FOR SELECT TO authenticated USING (
        project_id IN (SELECT id FROM public.projects WHERE owner_id = (SELECT auth.uid())) OR
        user_id = (SELECT auth.uid())
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Owners can manage members'
      AND n.nspname = 'public' AND c.relname = 'project_members'
  ) THEN
    CREATE POLICY "Owners can manage members" ON public.project_members
      FOR ALL TO authenticated USING (
        project_id IN (SELECT id FROM public.projects WHERE owner_id = (SELECT auth.uid()))
      );
  END IF;
END;
$$;

-- Stages policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Stages viewable by project members'
      AND n.nspname = 'public' AND c.relname = 'stages'
  ) THEN
    CREATE POLICY "Stages viewable by project members" ON public.stages
      FOR SELECT TO authenticated USING (
        project_id IN (
          SELECT id FROM public.projects WHERE owner_id = (SELECT auth.uid())
          UNION
          SELECT project_id FROM public.project_members WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Stages manageable by project owners'
      AND n.nspname = 'public' AND c.relname = 'stages'
  ) THEN
    CREATE POLICY "Stages manageable by project owners" ON public.stages
      FOR ALL TO authenticated USING (
        project_id IN (SELECT id FROM public.projects WHERE owner_id = (SELECT auth.uid()))
      );
  END IF;
END;
$$;

-- Stages manageable by project members with editor/admin role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Stages manageable by project editors'
      AND n.nspname = 'public' AND c.relname = 'stages'
  ) THEN
    CREATE POLICY "Stages manageable by project editors" ON public.stages
      FOR ALL TO authenticated USING (
        project_id IN (
          SELECT project_id FROM public.project_members 
          WHERE user_id = (SELECT auth.uid()) AND role IN ('editor', 'admin')
        )
      );
  END IF;
END;
$$;

-- Tasks policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Tasks viewable by project members'
      AND n.nspname = 'public' AND c.relname = 'tasks'
  ) THEN
    CREATE POLICY "Tasks viewable by project members" ON public.tasks
      FOR SELECT TO authenticated USING (
        stage_id IN (
          SELECT s.id FROM public.stages s
          JOIN public.projects p ON s.project_id = p.id
          WHERE p.owner_id = (SELECT auth.uid())
          UNION
          SELECT s.id FROM public.stages s
          JOIN public.project_members pm ON s.project_id = pm.project_id
          WHERE pm.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Tasks manageable by project members'
      AND n.nspname = 'public' AND c.relname = 'tasks'
  ) THEN
    CREATE POLICY "Tasks manageable by project members" ON public.tasks
      FOR ALL TO authenticated USING (
        stage_id IN (
          SELECT s.id FROM public.stages s
          JOIN public.projects p ON s.project_id = p.id
          WHERE p.owner_id = (SELECT auth.uid())
          UNION
          SELECT s.id FROM public.stages s
          JOIN public.project_members pm ON s.project_id = pm.project_id
          WHERE pm.user_id = (SELECT auth.uid()) AND pm.role IN ('editor', 'admin')
        )
      );
  END IF;
END;
$$;

-- Subtasks policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Subtasks viewable by project members'
      AND n.nspname = 'public' AND c.relname = 'subtasks'
  ) THEN
    CREATE POLICY "Subtasks viewable by project members" ON public.subtasks
      FOR SELECT TO authenticated USING (
        task_id IN (SELECT id FROM public.tasks)
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Subtasks manageable by project members'
      AND n.nspname = 'public' AND c.relname = 'subtasks'
  ) THEN
    CREATE POLICY "Subtasks manageable by project members" ON public.subtasks
      FOR ALL TO authenticated USING (
        task_id IN (SELECT id FROM public.tasks)
      );
  END IF;
END;
$$;

-- Comments policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Comments viewable by project members'
      AND n.nspname = 'public' AND c.relname = 'comments'
  ) THEN
    CREATE POLICY "Comments viewable by project members" ON public.comments
      FOR SELECT TO authenticated USING (
        task_id IN (SELECT id FROM public.tasks)
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Users can create comments'
      AND n.nspname = 'public' AND c.relname = 'comments'
  ) THEN
    CREATE POLICY "Users can create comments" ON public.comments
      FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Users can delete own comments'
      AND n.nspname = 'public' AND c.relname = 'comments'
  ) THEN
    CREATE POLICY "Users can delete own comments" ON public.comments
      FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
  END IF;
END;
$$;

-- Functions for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at (conditional create)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'update_users_updated_at'
      AND n.nspname = 'public' AND c.relname = 'users'
  ) THEN
    EXECUTE $sql$
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON public.users
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    $sql$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'update_projects_updated_at'
      AND n.nspname = 'public' AND c.relname = 'projects'
  ) THEN
    EXECUTE $sql$
      CREATE TRIGGER update_projects_updated_at
        BEFORE UPDATE ON public.projects
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    $sql$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'update_tasks_updated_at'
      AND n.nspname = 'public' AND c.relname = 'tasks'
  ) THEN
    EXECUTE $sql$
      CREATE TRIGGER update_tasks_updated_at
        BEFORE UPDATE ON public.tasks
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    $sql$;
  END IF;
END;
$$;

-- Trigger function to set project owner automatically
CREATE OR REPLACE FUNCTION public.set_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := (SELECT auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'set_owner_before_insert' AND n.nspname = 'public' AND c.relname = 'projects'
  ) THEN
    EXECUTE $sql$
      CREATE TRIGGER set_owner_before_insert
        BEFORE INSERT ON public.projects
        FOR EACH ROW EXECUTE FUNCTION public.set_project_owner();
    $sql$;
  END IF;
END;
$$;

-- Recreate/ensure INSERT policy for projects (scoped to authenticated)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE p.polname = 'Users can create projects' AND n.nspname = 'public' AND c.relname = 'projects'
  ) THEN
    EXECUTE 'DROP POLICY "Users can create projects" ON public.projects';
  END IF;
END;
$$;

CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- Ensure a public.users row exists for every auth user.
-- Without this, `projects.owner_id REFERENCES public.users(id)` will reject inserts.
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth' AND c.relname = 'users'
  ) THEN
    EXECUTE $sql$
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
    $sql$;
  END IF;
END;
$$;
