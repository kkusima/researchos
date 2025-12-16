# ResearchOS 🔬

A modern, collaborative research project management application designed for researchers, academics, and teams working on complex projects.

![ResearchOS](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

🔗 **Live App**: [researchos.vercel.app](https://researchos.vercel.app/)

## What is ResearchOS?

ResearchOS is a lightweight project management tool built specifically for research workflows. It helps you organize projects into customizable stages, track tasks with subtasks, and collaborate with team members in real-time.

https://github.com/kkusima/researchos/blob/main/V1.webm

https://github.com/kkusima/researchos/blob/main/V2.webm

## Key Features

- **📁 Project Organization** — Create projects with custom emojis, descriptions, and flexible stage-based workflows
- **✅ Task Management** — Break down work into tasks and subtasks with progress tracking
- **👥 Team Collaboration** — Share projects with collaborators via email or invite links
- **🔄 Drag & Drop Reordering** — Prioritize projects with intuitive drag-and-drop
- **📊 Sorting & Filtering** — Sort by date, alphabetically, or by progress (ascending/descending)
- **🔐 Google Sign-In** — Secure authentication with your Google account
- **☁️ Cloud Sync** — Data stored securely in Supabase with real-time sync
- **📱 Responsive Design** — Works seamlessly on desktop and mobile

## Use Cases

- **Academic Research** — Track experiments, literature reviews, and paper submissions
- **Thesis/Dissertation** — Organize chapters, deadlines, and advisor feedback
- **Lab Projects** — Coordinate team members across multiple concurrent studies
- **Grant Applications** — Manage timelines and deliverables
- **Personal Learning** — Structure self-directed learning projects

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **Hosting**: Vercel

## Getting Started

```bash
# Clone the repository
git clone https://github.com/kkusima/researchos.git
cd researchos

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase credentials to .env

# Run development server
npm run dev
```

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## License

MIT License

---

© 2025 [Kenneth Kusima](http://tinyurl.com/kennethkusima). All rights reserved.
