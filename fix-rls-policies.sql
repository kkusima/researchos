-- Fix for infinite recursion in RLS policies
-- This script repairs the broken policies that are causing infinite recursion
-- The key issue: policies were doing LEFT JOINs with project_members, creating circular chains

-- First, disable RLS temporarily to allow operations
ALTER TABLE public.project_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtask_tags DISABLE ROW LEVEL SECURITY;

-- Drop ALL problematic policies
-- Projects policies
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Owners can manage their projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view owned projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view shared projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can update projects" ON public.projects;
DROP POLICY IF EXISTS "Owners can delete projects" ON public.projects;

-- Project Members policies
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view own membership" ON public.project_members;
DROP POLICY IF EXISTS "Owners can view all project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can delete project members" ON public.project_members;

-- Stages/Tasks/Comments/Tags policies (to remove circular project_members checks)
DROP POLICY IF EXISTS "Users can manage stages" ON public.stages;
DROP POLICY IF EXISTS "Users can manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Users can manage comments" ON public.comments;
DROP POLICY IF EXISTS "Users can manage task tags" ON public.task_tags;
DROP POLICY IF EXISTS "Users can manage subtask tags" ON public.subtask_tags;

-- Re-enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtask_tags ENABLE ROW LEVEL SECURITY;

-- Fix 1: Projects policies (NO circular dependencies)
-- Separate SELECT policies to avoid recursion
CREATE POLICY "Users can view owned projects" ON public.projects
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view shared projects" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm 
      WHERE pm.project_id = projects.id 
      AND pm.user_id = auth.uid()
    )
  );

-- Separate policies for INSERT, UPDATE, DELETE
CREATE POLICY "Owners can insert projects" ON public.projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update projects" ON public.projects
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete projects" ON public.projects
  FOR DELETE USING (owner_id = auth.uid());

-- Fix 2: Project Members policies (NO circular dependencies - CRITICAL!)
-- IMPORTANT: project_members SELECT must NEVER check the projects table to avoid infinite recursion
CREATE POLICY "Users can view own membership" ON public.project_members
  FOR SELECT USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE can reference projects because they don't cause SELECT recursion
CREATE POLICY "Owners can insert project members" ON public.project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id 
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update project members" ON public.project_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id 
      AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id 
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete project members" ON public.project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id 
      AND p.owner_id = auth.uid()
    )
  );

-- Fix 3: Stages, Tasks, Subtasks, Comments, Tags policies
-- NO project_members checks to avoid circular dependency
CREATE POLICY "Users can manage stages" ON public.stages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = stages.project_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage tasks" ON public.tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stages s
      JOIN public.projects p ON s.project_id = p.id
      WHERE s.id = tasks.stage_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage subtasks" ON public.subtasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.stages s ON t.stage_id = s.id
      JOIN public.projects p ON s.project_id = p.id
      WHERE t.id = subtasks.task_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage comments" ON public.comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.stages s ON t.stage_id = s.id
      JOIN public.projects p ON s.project_id = p.id
      WHERE t.id = comments.task_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage task tags" ON public.task_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.stages s ON t.stage_id = s.id
      JOIN public.projects p ON s.project_id = p.id
      WHERE t.id = task_tags.task_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage subtask tags" ON public.subtask_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.subtasks st
      JOIN public.tasks t ON st.task_id = t.id
      JOIN public.stages s ON t.stage_id = s.id
      JOIN public.projects p ON s.project_id = p.id
      WHERE st.id = subtask_tags.subtask_id
      AND p.owner_id = auth.uid()
    )
  );

-- SUCCESS!
SELECT 'RLS Policies Fixed - No More Infinite Recursion!' as status;
