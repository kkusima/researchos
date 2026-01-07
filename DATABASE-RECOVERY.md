# HypotheSys Database Recovery Guide

## Problem Summary
Your database had two critical issues:
1. **Infinite Recursion Error**: The RLS policy for "Users can view project members" was incomplete and created circular dependencies
2. **Data Loss**: Your projects were likely deleted when running a faulty SQL command

## What Was Fixed

### 1. The Infinite Recursion Bug
**The Problem:** The policy on line 253-259 of your schema was:
```sql
CREATE POLICY "Users can view project members" ON public.project_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_members.project_id  -- MISSING AUTH CHECK!
    )
  );
```

This policy:
- Allowed ANY user to see ALL project members (security issue)
- Created circular references when the projects table tried to check project_members
- Resulted in "infinite recursion detected in policy for relation 'projects'"

**The Fix:** Split the policies into separate, non-circular policies:
- `Users can view owned projects` - Direct owner check
- `Users can view shared projects` - Check project_members without recursion
- `Users can view own membership` - Direct user check
- `Owners can view all project members` - Check projects without circular reference

### 2. Fixed Files
- ✅ `supabase-schema.sql` - Updated with corrected RLS policies
- ✅ `fix-rls-policies.sql` - Standalone fix script you can run on Supabase

## How to Apply the Fix

### Step 1: Access Your Supabase Dashboard
1. Go to https://app.supabase.com
2. Select your HypotheSys project
3. Go to the SQL Editor (left sidebar)

### Step 2: Run the Fix Script
1. Click "New Query"
2. Copy the contents of `fix-rls-policies.sql` 
3. Paste into the SQL editor
4. Click "Run" or press Cmd+Enter
5. You should see: "RLS Policies Fixed!"

### Step 3: Test Project Creation
1. Open your HypotheSys app
2. Try creating a new project
3. The infinite recursion error should be gone

### Step 4: (Optional) Run Full Schema
If you need to rebuild everything:
1. In Supabase SQL Editor, run `supabase-schema.sql`
2. This will recreate all tables and policies safely (it's idempotent)

## About Your Lost Projects

Unfortunately, I could not find:
- Database backups in your repository
- Exported project data files
- SQL dumps

**Possible Recovery Options:**

1. **Supabase Point-in-Time Recovery (PITR)**
   - If you have a paid Supabase plan, you can restore to before the deletion
   - Go to: Settings → Database → Point in Time Recovery
   - Select a time before you ran the bad SQL

2. **Supabase Backups**
   - Check Settings → Database → Backups
   - Supabase Pro plans have daily backups

3. **Browser LocalStorage** (Long shot)
   - Your app might have cached project data
   - Open DevTools → Application → Local Storage
   - Look for Supabase auth/cache data

4. **Contact Supabase Support**
   - If on a paid plan, they may be able to help recover data
   - support@supabase.com

## Prevention for the Future

1. **Always backup before running SQL:**
   ```bash
   # Use Supabase CLI to backup
   supabase db dump -f backup.sql
   ```

2. **Test SQL in a staging environment first**

3. **Enable Point-in-Time Recovery** (requires Pro plan)

4. **Use migrations instead of direct SQL:**
   ```bash
   supabase migration new your_change_name
   # Edit the migration file
   supabase db push
   ```

## What's Different Now

### Before (Broken):
- Projects policy checked project_members → circular reference
- Project_members policy had no real auth check → security hole
- Inserting projects triggered infinite recursion

### After (Fixed):
- All policies are independent and non-circular
- Each policy checks only direct relationships
- Projects can be inserted, updated, and deleted normally
- Proper security: users only see their own projects and memberships

## Testing Checklist

After applying the fix, test:
- ✅ Create a new project
- ✅ View your projects list
- ✅ Edit a project
- ✅ Delete a project
- ✅ Share a project (if you have that feature)
- ✅ View project members

## Need Help?

If you still encounter issues:
1. Check the browser console for errors
2. Check Supabase logs: Logs → Database
3. Verify RLS is enabled: Database → Policies
4. Make sure you're authenticated (logged in)

---

**Summary:** The fix is ready. Run `fix-rls-policies.sql` in your Supabase SQL Editor to restore functionality. For data recovery, check Supabase backups/PITR or contact their support if you have a paid plan.
