-- ============================================================
-- CashFlow — Supabase schema (fresh install)
-- Run this in Supabase Dashboard → SQL Editor → New query.
--
-- Already have an older CashFlow database deployed? Don't run this —
-- run supabase/migrations/002_household_sharing.sql instead, which
-- upgrades an existing database in place without touching your data.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- households ----------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- household_members ----------
-- status: 'pending' = invited by email, not yet accepted (user_id is null
-- until they accept). 'active' = a real member with database access.
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'pending' check (status in ('pending', 'active')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, invited_email)
);

create index household_members_household_idx on public.household_members (household_id);
create index household_members_user_idx on public.household_members (user_id);

-- ---------- helper functions (security definer = bypass RLS internally,
-- so these can safely be used *inside* RLS policies without recursion) ----------

create or replace function public.is_household_member(hh_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members hm
    where hm.household_id = hh_id
      and hm.user_id = auth.uid()
      and hm.status = 'active'
  );
$$;

create or replace function public.is_household_owner(hh_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from household_members hm
    where hm.household_id = hh_id
      and hm.user_id = auth.uid()
      and hm.status = 'active'
      and hm.role = 'owner'
  );
$$;

-- Used only for the bootstrap step (creating a household, then adding
-- yourself as its first owner). Needs security definer too: at that
-- instant the creator isn't an active member yet, so without bypassing
-- RLS here, the households table's own "members only" SELECT policy
-- would hide the very row we're checking created_by against.
create or replace function public.is_household_creator(hh_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from households h
    where h.id = hh_id
      and h.created_by = auth.uid()
  );
$$;

-- ---------- RLS: households ----------
alter table public.households enable row level security;

create policy "households_select_member" on public.households
  for select using (is_household_member(id));
create policy "households_insert_self" on public.households
  for insert with check (created_by = auth.uid());
create policy "households_update_owner" on public.households
  for update using (is_household_owner(id));
create policy "households_delete_owner" on public.households
  for delete using (is_household_owner(id));

-- ---------- RLS: household_members ----------
alter table public.household_members enable row level security;

create policy "household_members_select" on public.household_members
  for select using (
    is_household_member(household_id)
    or invited_email = (auth.jwt() ->> 'email')
  );

create policy "household_members_insert" on public.household_members
  for insert with check (
    (
      user_id = auth.uid() and role = 'owner' and status = 'active'
      and is_household_creator(household_id)
    )
    or is_household_owner(household_id)
  );

-- USING governs which existing rows can be targeted; WITH CHECK governs
-- what the row is allowed to become. These differ here: an invitee's
-- pending row (checked via USING) transitions to status='active' with
-- user_id set to themself (checked via WITH CHECK) — without an explicit
-- WITH CHECK, Postgres reuses USING on the *new* row and the accept would
-- be rejected, since the new row's status is no longer 'pending'.
create policy "household_members_update" on public.household_members
  for update
  using (
    is_household_owner(household_id)
    or (invited_email = (auth.jwt() ->> 'email') and status = 'pending')
  )
  with check (
    is_household_owner(household_id)
    or (user_id = auth.uid() and status = 'active')
  );

create policy "household_members_delete" on public.household_members
  for delete using (
    is_household_owner(household_id)
    or user_id = auth.uid()
  );

-- ---------- expenses ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  category text not null,
  description text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses (user_id, expense_date desc);
create index expenses_household_idx on public.expenses (household_id);

alter table public.expenses enable row level security;

create policy "expenses_select_own_or_household" on public.expenses
  for select using (
    auth.uid() = user_id
    or (household_id is not null and is_household_member(household_id))
  );
create policy "expenses_insert_own_or_household" on public.expenses
  for insert with check (
    auth.uid() = user_id
    and (household_id is null or is_household_member(household_id))
  );
create policy "expenses_update_own_or_household" on public.expenses
  for update using (
    auth.uid() = user_id
    or (household_id is not null and is_household_member(household_id))
  );
create policy "expenses_delete_own_or_household" on public.expenses
  for delete using (
    auth.uid() = user_id
    or (household_id is not null and is_household_member(household_id))
  );

-- ---------- income (personal only) ----------
create table public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  source text not null,
  income_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index income_user_date_idx on public.income (user_id, income_date desc);

alter table public.income enable row level security;

create policy "income_select_own" on public.income
  for select using (auth.uid() = user_id);
create policy "income_insert_own" on public.income
  for insert with check (auth.uid() = user_id);
create policy "income_update_own" on public.income
  for update using (auth.uid() = user_id);
create policy "income_delete_own" on public.income
  for delete using (auth.uid() = user_id);

-- ---------- budgets (personal, or shared to a household) ----------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now()
);

-- One budget per category — either per personal user, or per household.
create unique index budgets_personal_unique on public.budgets (user_id, category) where household_id is null;
create unique index budgets_household_unique on public.budgets (household_id, category) where household_id is not null;

alter table public.budgets enable row level security;

create policy "budgets_select_own_or_household" on public.budgets
  for select using (
    (household_id is null and auth.uid() = user_id)
    or (household_id is not null and is_household_member(household_id))
  );
create policy "budgets_insert_own_or_household" on public.budgets
  for insert with check (
    auth.uid() = user_id
    and (household_id is null or is_household_member(household_id))
  );
create policy "budgets_update_own_or_household" on public.budgets
  for update using (
    (household_id is null and auth.uid() = user_id)
    or (household_id is not null and is_household_member(household_id))
  );
create policy "budgets_delete_own_or_household" on public.budgets
  for delete using (
    (household_id is null and auth.uid() = user_id)
    or (household_id is not null and is_household_member(household_id))
  );

-- ---------- recurring_templates (personal only) ----------
create table public.recurring_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount numeric(12,2) not null check (amount > 0),
  label text not null,
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
