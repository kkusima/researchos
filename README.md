# ResearchOS 🔬

A modern, collaborative research project management application with Google Sign-In, real-time sync, and beautiful UI.

![ResearchOS](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **🔐 Google Sign-In** - Secure authentication via Supabase Auth
- **👥 Multi-user Collaboration** - Share projects with team members
- **🔄 Real-time Sync** - Changes sync instantly across devices
- **📊 Stage-based Workflow** - Track progress through research phases
- **✅ Task Management** - Tasks, subtasks, comments, and reminders
- **🎨 Beautiful UI** - Modern glass-morphism design
- **📱 Responsive** - Works on desktop, tablet, and mobile
- **🌐 Deployable** - Ready for Vercel, Netlify, or any static host

## 🚀 Quick Start

### Option 1: Demo Mode (No Setup Required)

```bash
# Clone and run
git clone <your-repo>
cd researchos
npm install
npm run dev
```

Open http://localhost:5173 - the app runs in demo mode with localStorage.

### Option 2: Full Setup with Supabase (Recommended)

#### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project" and fill in the details
3. Wait for the project to be created (~2 minutes)

#### Step 2: Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the contents of `supabase-schema.sql` and paste it
4. Click "Run" to create all tables and policies

#### Step 3: Enable Google Auth

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click to enable it
3. You'll need to create Google OAuth credentials:

   **In Google Cloud Console:**
   1. Go to [console.cloud.google.com](https://console.cloud.google.com)
   2. Create a new project or select existing
   3. Go to **APIs & Services** → **Credentials**
   4. Click **Create Credentials** → **OAuth client ID**
   5. Choose "Web application"
   6. Add Authorized redirect URI: `https://your-project-id.supabase.co/auth/v1/callback`
   7. Copy the Client ID and Client Secret

   **Back in Supabase:**
   1. Paste the Client ID and Client Secret
   2. Click "Save"

#### Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your vim  credentials (found in Project Settings → API):
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
https://geqdrllnzjjrciojriuy.supabase.co/auth/v1/callback

#### Step 5: Run the App

```bash
npm install
npm run dev
```

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

**Important:** Update the Google OAuth redirect URI to include your Vercel domain:
- `https://your-app.vercel.app/` (add to Authorized JavaScript origins)
- `https://your-project-id.supabase.co/auth/v1/callback` (already added)

### Deploy to Netlify

1. Push your code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Select your repository
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Add environment variables in Site Settings → Environment Variables
7. Deploy!

### Deploy to GitHub Pages

1. Update `vite.config.js`:
   ```js
   export default defineConfig({
     plugins: [react()],
     base: '/your-repo-name/'
   })
   ```

2. Build and deploy:
   ```bash
   npm run build
   npx gh-pages -d dist
   ```

## 📁 Project Structure

```
researchos/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts (Auth)
│   ├── lib/             # Supabase client & helpers
│   ├── App.jsx          # Main application
│   ├── index.css        # Global styles
│   └── main.jsx         # Entry point
├── .env.example         # Environment template
├── supabase-schema.sql  # Database schema
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## 🔧 Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Auth:** Google OAuth via Supabase
- **Icons:** Lucide React
- **Deployment:** Vercel / Netlify / Any static host

## 🛡️ Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own projects and shared projects
- Project owners control member permissions
- All data encrypted at rest and in transit

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

---

Built with ❤️ for researchers everywhere.
