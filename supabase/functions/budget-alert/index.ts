// Supabase Edge Function: budget-alert
//
// Triggered by a database webhook on every INSERT into `expenses`
// (see supabase/migrations/003_budget_alert_webhook.sql). Checks whether
// the new expense pushed its budget category across the 80% or 100%
// threshold for the first time this month, and if so, emails the
// relevant person(s) via Resend.
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   RESEND_API_KEY   — from resend.com
//   ALERT_FROM_EMAIL — a sender address verified in your Resend account
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically
// by the Edge Functions runtime — do not set them yourself.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { evaluateBudgetCrossing, buildAlertEmail } from './alertLogic.js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const ALERT_FROM_EMAIL = Deno.env.get('ALERT_FROM_EMAIL') ?? 'alerts@example.com'

async function sendEmail(to: string[], subject: string, text: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: ALERT_FROM_EMAIL, to, subject, text }),
  })
  if (!res.ok) {
    console.error('Resend API error:', res.status, await res.text())
  }
}

serve(async (req) => {
  try {
    const payload = await req.json()

    // Supabase database webhooks send { type, table, record, old_record, schema }
    if (payload.type !== 'INSERT' || payload.table !== 'expenses') {
      return new Response('ignored: not an expense insert', { status: 200 })
    }

    const expense = payload.record
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Find the budget that matches this expense's scope (personal, or a
    // specific household) and category.
    let budgetQuery = admin.from('budgets').select('*').eq('category', expense.category)
    budgetQuery = expense.household_id
      ? budgetQuery.eq('household_id', expense.household_id)
      : budgetQuery.eq('user_id', expense.user_id).is('household_id', null)
    const { data: budget } = await budgetQuery.maybeSingle()

    if (!budget) {
      return new Response('ok: no budget set for this category/scope', { status: 200 })
    }

    // Month-to-date spend in this same scope + category, used both to
    // know the "after" total and to back out the "before" total.
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthStartStr = monthStart.toISOString().slice(0, 10)

    let spendQuery = admin
      .from('expenses')
      .select('amount')
      .gte('expense_date', monthStartStr)
      .eq('category', expense.category)
    spendQuery = expense.household_id
      ? spendQuery.eq('household_id', expense.household_id)
      : spendQuery.eq('user_id', expense.user_id).is('household_id', null)

    const { data: rows } = await spendQuery
    const newSpend = (rows || []).reduce((sum: number, r: { amount: number }) => sum + Number(r.amount), 0)
    const previousSpend = newSpend - Number(expense.amount)

    const level = evaluateBudgetCrossing(previousSpend, newSpend, Number(budget.monthly_limit))
    if (!level) {
      return new Response('ok: no threshold crossed', { status: 200 })
    }

    // Resolve who to email: the household's active members, or just the
    // expense owner for a personal budget.
    let recipients: string[] = []
    let scopeName: string | null = null

    if (expense.household_id) {
      const { data: members } = await admin
        .from('household_members')
        .select('invited_email')
        .eq('household_id', expense.household_id)
        .eq('status', 'active')
      recipients = (members || []).map((m: { invited_email: string }) => m.invited_email).filter(Boolean)

      const { data: household } = await admin
        .from('households')
        .select('name')
        .eq('id', expense.household_id)
        .single()
      scopeName = household?.name ?? null
    } else {
      const { data: userRes } = await admin.auth.admin.getUserById(expense.user_id)
      if (userRes?.user?.email) recipients = [userRes.user.email]
    }

    if (recipients.length === 0) {
      return new Response('ok: no recipients resolved', { status: 200 })
    }

    const { subject, body } = buildAlertEmail({
      level,
      category: expense.category,
      scopeName,
      spent: newSpend,
      limit: Number(budget.monthly_limit),
    })

    await sendEmail(recipients, subject, body)

    return new Response(`ok: ${level} alert sent to ${recipients.length} recipient(s)`, { status: 200 })
  } catch (err) {
    console.error('budget-alert error:', err)
    return new Response('error', { status: 500 })
  }
})
