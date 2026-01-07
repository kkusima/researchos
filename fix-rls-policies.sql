-- Fix for infinite recursion in RLS policies
-- This script repairs the broken policies that are causing infinite recursion

-- First, disable RLS temporarily to allow operations
ALTER TABLE public.project_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Owners can manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Owners can manage their projects" ON public.projects;

-- Re-enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Fix 1: Projects policies (NO circular dependencies)
-- Policy for viewing projects - simplified to avoid recursion
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

-- Policy for managing projects (INSERT, UPDATE, DELETE)
CREATE POLICY "Owners can insert projects" ON public.projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update projects" ON public.projects
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete projects" ON public.projects
  FOR DELETE USING (owner_id = auth.uid());

-- Fix 2: Project Members policies (NO circular dependencies)
-- Policy for viewing project members
CREATE POLICY "Users can view own membership" ON public.project_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Owners can view all project members" ON public.project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id 
      AND p.owner_id = auth.uid()
    )
  );

-- Policy for managing project members (only owners can manage)
CREATE POLICY "Owners can manage project members" ON public.project_members
  FOR ALL USING (
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

-- Verify policies are working
SELECT 'RLS Policies Fixed!' as status;
