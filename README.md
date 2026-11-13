# CashFlow — Personal Expense Tracker

A full-stack expense tracker built with **React + Tailwind CSS + Supabase (PostgreSQL + Auth)**, ready to deploy on **Vercel**.

Rebuilt from a simple single-user demo into something you can actually rely on day to day:

- 🔐 **Real accounts** — Supabase email/password auth, every user only sees their own data (enforced by Postgres Row Level Security, not just app logic)
- 💰 **Budgets with alerts** — set a monthly cap per category, see progress bars, get flagged when you're near or over budget
- 📊 **Dashboard charts** — spend-by-category pie chart and a 6-month income vs. expense trend, built with Recharts
- 🔁 **Recurring transactions** — set up rent, subscriptions, or salary once; CashFlow automatically logs each occurrence as its due date arrives, even catching up on missed periods
- 📅 **Filtering + CSV export** — filter expenses by category and date range, export to CSV for taxes or sharing
- 📈 **Income tracking** — log income separately and see net savings (income − expenses) per month
- 🏠 **Shared household budgets** — create a household, invite members by email, and tag budgets/expenses as shared so everyone sees the same combined numbers instead of a budget that only reflects one person's spending
- 🌓 **Dark mode** — toggle in the header; respects your system preference by default, remembers an explicit choice, and applies before first paint (no flash of the wrong theme)
- 📲 **Installable (PWA)** — add it to your phone's home screen or desktop like a native app; the app shell loads offline, though live financial data still requires a connection

---

## 1. Set up Supabase (free tier is enough)

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once it's ready, open **SQL Editor → New query**, paste in the contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates the `expenses`, `income`, `budgets`, `recurring_templates`, `households`, and `household_members` tables with Row Level Security already locked down per-user (and per-household, for shared data).
   - Already have an older CashFlow database without households? Don't re-run `schema.sql` — run [`supabase/migrations/002_household_sharing.sql`](./supabase/migrations/002_household_sharing.sql) instead, which upgrades your existing database in place without touching your data.
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
git commit -m "CashFlow: full-stack expense tracker"
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

## Email budget alerts (optional)

Sends an email automatically when an expense pushes a budget category to 80% ("approaching limit") or 100% ("over budget") of its monthly cap for the first time that month — personal budgets email you, shared household budgets email every active member. This runs as a Supabase Edge Function, triggered by a database webhook on every expense insert, sending via [Resend](https://resend.com).

**This part isn't optional to skip reading** — unlike the rest of the app, it needs real infrastructure setup (a deployed function + an email provider account), not just pasted SQL. Everything else in CashFlow works fully without doing this section.

1. **Create a free Resend account** at [resend.com](https://resend.com) and grab an API key from the dashboard. For testing, Resend's sandbox lets you send from `onboarding@resend.dev` without verifying a domain — use that as `ALERT_FROM_EMAIL` to start.

2. **Install the Supabase CLI** if you don't have it: `npm install -g supabase`, then `supabase login` and `supabase link --project-ref YOUR-PROJECT-REF` (find your project ref in Supabase's dashboard URL).

3. **Set the Edge Function's secrets:**
   ```bash
   supabase secrets set RESEND_API_KEY=re_your_key_here
   supabase secrets set ALERT_FROM_EMAIL=onboarding@resend.dev
   ```

4. **Deploy the function:**
   ```bash
   supabase functions deploy budget-alert
   ```

5. **Create the trigger** that calls it on every new expense: open [`supabase/migrations/003_budget_alert_webhook.sql`](./supabase/migrations/003_budget_alert_webhook.sql), replace `YOUR-PROJECT-REF` with your actual project ref, and run it in Supabase's SQL Editor. The trigger starts firing immediately once created.

6. **Test it**: add an expense that pushes a budgeted category over 80% or 100% of its limit, and check the recipient's inbox (and Resend's dashboard logs, and your function's logs via `supabase functions logs budget-alert`, if nothing arrives).

**What's actually tested here, and what isn't:** the alert-decision logic — *does this expense cross the 80%/100% threshold, and only on the crossing itself so you don't get spammed* — lives in `supabase/functions/budget-alert/alertLogic.js` as plain, framework-agnostic functions with no Deno or network dependencies, and is unit-tested the same way as the rest of the app's business logic (`npm run test` runs these too). The Edge Function itself (`index.ts`, which queries Supabase with a service-role key and calls the Resend API) was written carefully but could not be executed in the environment this was built in — no network access to Supabase's Functions platform or Resend from there. Test it for real after deploying, the way step 6 describes, before relying on it.

## Assistant: quick-add and "ask your finances"

A floating chat button (bottom-right, on every page) does two things:

1. **Quick-add (works out of the box, free).** Type `spent 450 on lunch yesterday`, `₹1,200 uber`, `paid 12000 rent on 1st` or `received salary 50000`. A rule-based parser (`src/utils/quickEntryParser.js`, no API calls) extracts amount, category, date and description, then shows a **confirm card**. Nothing is saved until you press Save. It understands `₹`/`rs`/`inr`, `450/-`, `k` and `lakh`, Indian digit grouping, day-first dates (`15/10`), `yesterday`, `3 days ago`, `last friday`, `3 march`.
2. **Ask your finances (needs an Anthropic API key).** Questions such as "How much did I spend on food this month?" or "Am I on track with my budgets?" go to the `finance-chat` Edge Function. It reads your data **with your own login token, not the service role**, so Row Level Security means the model can only ever see your rows. It sends a compact summary (monthly totals, category totals, budget status, 25 recent expenses), not whole tables. It can read but never write.

### Enabling the chat

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# optional: supabase secrets set ANTHROPIC_MODEL=claude-haiku-5-5
supabase functions deploy finance-chat
```

Keep JWT verification on (the default). Until this is deployed, the widget shows a friendly "not deployed yet" message and quick-add keeps working. The key stays server-side; it is never in the browser bundle.

### Receipt scanning

Tap the camera button in the assistant, take or pick a photo of a bill, and the `scan-receipt` Edge Function reads the total, date and merchant with Claude's vision model and pre-fills an expense. Details that matter:

- **You always review first.** The result lands in an editable card (amount, date, category, note). Nothing is saved until you press Save, because OCR can misread a digit.
- The photo is downscaled in the browser (max 1600px JPEG) before upload, so it is fast and cheap. Images are sent to the Anthropic API for reading and are not stored by the app.
- The function validates the model's output (positive amount, real non-future date, category from your list, trimmed merchant) before returning it, and the prompt treats printed receipt text as data, not instructions.
- If no date is readable, today's date is used and the card says so.

```bash
supabase functions deploy scan-receipt   # uses the same ANTHROPIC_API_KEY secret as finance-chat
```

Tested: the validation and response-parsing logic (`supabase/functions/scan-receipt/receiptLogic.js`), the resize maths, and the widget flow with Supabase mocked. **Not executed here:** `scan-receipt/index.ts` itself, and the browser canvas resize (needs a real browser). Try a few real receipts after deploying. Expect weaker results on crumpled, blurry or handwritten bills.

### What is tested, and what is not

- Tested (`npm run test`): the parser (63 cases), the request validation and context-building in `supabase/functions/finance-chat/chatLogic.js`, and the widget's behaviour (confirm before save, correct insert payloads, discard, error and not-deployed fallbacks) with Supabase mocked.
- **Not executed in the environment this was built in:** `supabase/functions/finance-chat/index.ts` (needs Deno, Supabase Functions and the Anthropic API). Deploy it and ask a real question before relying on it.
- Parser limits: it reads one amount per message, so `spent 50 on tea and 30 on biscuits` becomes ₹50. That is why every parsed entry goes through the confirm card. Household tagging is not part of quick-add; use the Expenses page for shared entries.

### Timezone note

All date handling uses local calendar dates (`toLocalISODate`) rather than `toISOString()`, which converts to UTC and would put a 1st-of-month rent on the previous month for users ahead of UTC such as India. Regression tests cover this.

## Installing as an app (PWA)

CashFlow is installable: on desktop Chrome/Edge, click the install icon in the address bar; on Android Chrome, use "Add to Home screen"; on iOS Safari, use Share → "Add to Home Screen". It works via a standard web app manifest (`vite-plugin-pwa` generates `manifest.webmanifest`) plus a Workbox-powered service worker that precaches the app shell (JS/CSS/icons) so the app still loads with no connection.

Live data is deliberately **not** cached: every Supabase request (expenses, budgets, auth) still requires a real network round-trip. Showing stale financial numbers while offline would be actively misleading for a money-tracking app, so only the shell — not the data — works offline. The service worker uses `autoUpdate`, so a new deployment is picked up automatically on the next load rather than requiring a manual reinstall.

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

## Notes on household sharing

A household is created by one user (its owner), who can invite others by email. An invite is stored as a `household_members` row with `status='pending'` and no `user_id` yet — the invitee can see it via an RLS policy matching their JWT's email claim, and "accepting" it is just an update that sets `user_id` and flips `status` to `'active'`. Once active, a member can tag any expense or budget as shared to that household instead of keeping it personal; shared rows become visible to (and editable by) every member, which is what makes a shared budget's "spent so far" figure reflect the whole household rather than just one person's transactions.

Income and recurring templates are intentionally left personal-only for now. The same `household_id` column + RLS policy pattern used on `expenses` and `budgets` would extend cleanly to them if needed later.

Before shipping this, the schema was tested against a real local Postgres instance (not just read over) — a script simulating three separate users verified that personal data stays isolated, invites are only visible to their intended recipient, accepted members can see and contribute to shared budgets/expenses, and non-owners can't invite new members. That testing caught two real RLS bugs (a bootstrap chicken-and-egg policy issue, and a missing `WITH CHECK` clause on the invite-accept update) before they reached a real deployment.

## Notes on the recurring engine

`src/utils/recurring.js` runs once per dashboard load. For every active recurring template it checks how many billing periods have elapsed since `last_generated` (or `start_date` if never run), inserts a real `expenses`/`income` row for each one that's due, and advances `last_generated`. This means it works correctly even if you don't open the app for a few months — it back-fills the missed entries rather than skipping them. For a production app you could move this into a [Supabase Edge Function on a cron schedule](https://supabase.com/docs/guides/functions/schedule-functions) instead of running it client-side, so entries appear even if no one opens the app.

## Testing

```bash
npm run test        # run the full suite once
npm run test:watch  # re-run on file changes while developing
```

48 tests across the pure business logic and presentational components: the forecasting/anomaly-detection math in `insights.js`, the recurring-transaction date calculations in `recurring.js`, CSV building, currency/date formatting, and the budget progress bar's status logic. Each piece of non-trivial logic (regression, anomaly detection, recurring date math) was deliberately written as a pure function separate from its Supabase/DOM side effects specifically so it could be tested without mocking the network.

## Performance: route-based code splitting

Every page in `src/App.jsx` is loaded with `React.lazy()` instead of a static import, so each route builds to its own JS chunk that's only fetched when that route is actually visited. This matters most for Recharts (used by Dashboard and Insights), which is a ~360KB chunk on its own — someone who only ever uses Expenses, Income, Budgets, Recurring, or Households never downloads it at all, and the Login/Signup screen loads roughly half the JS it used to.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`: install → lint (`oxlint`) → test (`vitest`) → production build. This catches lint errors, failing tests, or a broken build *before* Vercel ever builds the real deployment. Vercel's own build (using your real Supabase keys) still runs separately on push — this workflow is a safety check, not a replacement for it.

## Tech stack

React 19 · React Router 7 · Tailwind CSS 4 · Recharts · Supabase (PostgreSQL + Auth + Edge Functions) · Resend · vite-plugin-pwa (Workbox) · Vitest · React Testing Library · GitHub Actions · Vite · Vercel
