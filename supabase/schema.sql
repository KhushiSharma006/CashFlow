-- ============================================================
-- Expense Tracker — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- expenses ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  description text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists expenses_user_date_idx on public.expenses (user_id, expense_date desc);

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
  for select using (auth.uid() = user_id);
create policy "expenses_insert_own" on public.expenses
  for insert with check (auth.uid() = user_id);
create policy "expenses_update_own" on public.expenses
  for update using (auth.uid() = user_id);
create policy "expenses_delete_own" on public.expenses
  for delete using (auth.uid() = user_id);

-- ---------- income ----------
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  source text not null,
  income_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists income_user_date_idx on public.income (user_id, income_date desc);

alter table public.income enable row level security;

create policy "income_select_own" on public.income
  for select using (auth.uid() = user_id);
create policy "income_insert_own" on public.income
  for insert with check (auth.uid() = user_id);
create policy "income_update_own" on public.income
  for update using (auth.uid() = user_id);
create policy "income_delete_own" on public.income
  for delete using (auth.uid() = user_id);

-- ---------- budgets (one monthly limit per category per user) ----------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

alter table public.budgets enable row level security;

create policy "budgets_select_own" on public.budgets
  for select using (auth.uid() = user_id);
create policy "budgets_insert_own" on public.budgets
  for insert with check (auth.uid() = user_id);
create policy "budgets_update_own" on public.budgets
  for update using (auth.uid() = user_id);
create policy "budgets_delete_own" on public.budgets
  for delete using (auth.uid() = user_id);

-- ---------- recurring_templates (rent, subscriptions, salary, etc.) ----------
create table if not exists public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount numeric(12,2) not null check (amount > 0),
  label text not null,          -- category (expense) or source (income)
  description text,
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  start_date date not null default current_date,
  last_generated date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.recurring_templates enable row level security;

create policy "recurring_select_own" on public.recurring_templates
  for select using (auth.uid() = user_id);
create policy "recurring_insert_own" on public.recurring_templates
  for insert with check (auth.uid() = user_id);
create policy "recurring_update_own" on public.recurring_templates
  for update using (auth.uid() = user_id);
create policy "recurring_delete_own" on public.recurring_templates
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Done. After running this, go to Authentication → Providers
-- and make sure Email provider is enabled (it is by default).
-- ============================================================
