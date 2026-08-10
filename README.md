# Tallybook — Personal Expense Tracker

A full-stack expense tracker built with **React + Tailwind CSS + Supabase (PostgreSQL + Auth)**, ready to deploy on **Vercel**.

Rebuilt from a simple single-user demo into something you can actually rely on day to day:

- 🔐 **Real accounts** — Supabase email/password auth, every user only sees their own data (enforced by Postgres Row Level Security, not just app logic)
- 💰 **Budgets with alerts** — set a monthly cap per category, see progress bars, get flagged when you're near or over budget
- 📊 **Dashboard charts** — spend-by-category pie chart and a 6-month income vs. expense trend, built with Recharts
- 🔁 **Recurring transactions** — set up rent, subscriptions, or salary once; Tallybook automatically logs each occurrence as its due date arrives, even catching up on missed periods
- 📅 **Filtering + CSV export** — filter expenses by category and date range, export to CSV for taxes or sharing
- 📈 **Income tracking** — log income separately and see net savings (income − expenses) per month

---

## 1. Set up Supabase (free tier is enough)

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once it's ready, open **SQL Editor → New query**, paste in the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the `expenses`, `income`, `budgets`, and `recurring_templates` tables with Row Level Security already locked down per-user.
3. Go to **Project Settings → API**. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
4. Go to **Authentication → Providers** and confirm **Email** is enabled (it is by default). If you don't want email confirmation for testing, go to **Authentication → Settings** and turn off "Confirm email."

## 2. Run it locally

```bash
npm install
cp .env.example .env
# paste your Supabase URL + anon key into .env
npm run dev
```

Visit `http://localhost:5173`, sign up, and start logging expenses.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Tallybook: full-stack expense tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 4. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
2. Framework preset: **Vite** (auto-detected).
3. Add environment variables in the Vercel dashboard (**Settings → Environment Variables**):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. The included `vercel.json` handles client-side routing so refreshing `/expenses`, `/budgets`, etc. works correctly.

---

## Project structure

```
src/
  components/     UI pieces: forms, nav, charts, budget progress bars
  contexts/       AuthContext (Supabase session)
  lib/            Supabase client
  pages/          Dashboard, Expenses, Income, Budgets, Recurring, Login, Signup
  utils/          category list, currency/date helpers, CSV export, recurring engine
supabase/
  schema.sql      tables + Row Level Security policies
```

## Notes on the recurring engine

`src/utils/recurring.js` runs once per dashboard load. For every active recurring template it checks how many billing periods have elapsed since `last_generated` (or `start_date` if never run), inserts a real `expenses`/`income` row for each one that's due, and advances `last_generated`. This means it works correctly even if you don't open the app for a few months — it back-fills the missed entries rather than skipping them. For a production app you could move this into a [Supabase Edge Function on a cron schedule](https://supabase.com/docs/guides/functions/schedule-functions) instead of running it client-side, so entries appear even if no one opens the app.

## Tech stack

React 19 · React Router 7 · Tailwind CSS 4 · Recharts · Supabase (PostgreSQL + Auth) · Vite · Vercel
