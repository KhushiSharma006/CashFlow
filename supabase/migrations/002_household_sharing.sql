-- ============================================================
-- CashFlow — Migration 002: shared household budgets
-- Run this in Supabase Dashboard → SQL Editor → New query.
-- Safe to run on an existing database — only adds new tables/
-- columns, doesn't touch your existing personal data.
-- ============================================================

-- ---------- households ----------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- household_members ----------
create table if not exists public.household_members (
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

create index if not exists household_members_household_idx on public.household_members (household_id);
create index if not exists household_members_user_idx on public.household_members (user_id);

-- ---------- helper functions ----------

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

-- ---------- Extend budgets with optional household sharing ----------
alter table public.budgets add column if not exists household_id uuid references public.households(id) on delete cascade;

alter table public.budgets drop constraint if exists budgets_user_id_category_key;
create unique index if not exists budgets_personal_unique on public.budgets (user_id, category) where household_id is null;
create unique index if not exists budgets_household_unique on public.budgets (household_id, category) where household_id is not null;

drop policy if exists "budgets_select_own" on public.budgets;
drop policy if exists "budgets_insert_own" on public.budgets;
drop policy if exists "budgets_update_own" on public.budgets;
drop policy if exists "budgets_delete_own" on public.budgets;

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

-- ---------- Extend expenses with optional household sharing ----------
alter table public.expenses add column if not exists household_id uuid references public.households(id) on delete cascade;
create index if not exists expenses_household_idx on public.expenses (household_id);

drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;

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

-- ============================================================
-- Done. income and recurring_templates are intentionally left
-- personal-only for now — the same household_id + RLS pattern
-- above can be applied to them later if needed.
-- ============================================================
