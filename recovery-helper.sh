#!/bin/bash

# HypotheSys Database Recovery Helper Script
# This script helps you backup and restore your Supabase database

echo "🔍 HypotheSys Database Recovery Helper"
echo "======================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo ""
    echo "To install:"
    echo "  macOS: brew install supabase/tap/supabase"
    echo "  Or: npm install -g supabase"
    echo ""
    echo "After installing, run: supabase login"
    exit 1
fi

echo "✅ Supabase CLI is installed"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "⚠️  You are not logged in to Supabase."
    echo "Run: supabase login"
    exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

# List projects
echo "📋 Your Supabase Projects:"
supabase projects list
echo ""

# Get project ref
read -p "Enter your project reference (ID from above): " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ No project reference provided"
    exit 1
fi

echo ""
echo "🔗 Linking to project: $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

echo ""
echo "What would you like to do?"
echo "1) Create a backup of current database"
echo "2) Apply the RLS policy fixes"
echo "3) Check for existing backups"
echo "4) View database status"
read -p "Enter choice (1-4): " CHOICE

case $CHOICE in
    1)
        BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
        echo ""
        echo "📦 Creating backup: $BACKUP_FILE"
        supabase db dump -f "$BACKUP_FILE"
        echo "✅ Backup created: $BACKUP_FILE"
        ;;
    2)
        echo ""
        echo "🔧 Applying RLS policy fixes..."
        supabase db execute -f fix-rls-policies.sql
        echo "✅ Fixes applied!"
        ;;
    3)
        echo ""
        echo "📂 Checking for backup files in current directory:"
        ls -lh *.sql 2>/dev/null || echo "No .sql files found"
        ;;
    4)
        echo ""
        echo "📊 Database Status:"
        supabase db execute -c "
        SELECT 
          'Projects' as table_name, 
          COUNT(*) as row_count 
        FROM public.projects
        UNION ALL
        SELECT 
          'Stages', 
          COUNT(*) 
        FROM public.stages
        UNION ALL
        SELECT 
          'Tasks', 
          COUNT(*) 
        FROM public.tasks
        UNION ALL
        SELECT 
          'Users', 
          COUNT(*) 
        FROM public.users;
        "
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✨ Done!"
