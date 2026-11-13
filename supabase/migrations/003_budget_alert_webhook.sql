-- ============================================================
-- CashFlow — Migration 003: budget alert webhook
--
-- Before running this: deploy the budget-alert Edge Function and set
-- its secrets first (see README "Email budget alerts" section) —
-- this trigger starts firing immediately once created.
--
-- Replace YOUR-PROJECT-REF below with your actual Supabase project
-- reference (visible in your project's API settings URL,
-- https://YOUR-PROJECT-REF.supabase.co) before running this.
-- ============================================================

create trigger "budget_alert_on_expense_insert"
after insert on public.expenses
for each row
execute function supabase_functions.http_request(
  'https://YOUR-PROJECT-REF.functions.supabase.co/budget-alert',
  'POST',
  '{"Content-Type":"application/json"}',
  '{}',
  '5000'
);

-- To remove this later: drop trigger "budget_alert_on_expense_insert" on public.expenses;
