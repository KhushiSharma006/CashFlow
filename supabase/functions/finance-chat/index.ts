// Supabase Edge Function: finance-chat
//
// "Ask your finances". The browser sends the recent conversation; this function
//   1. authenticates the caller from their JWT,
//   2. reads their data using THAT JWT (not the service role), so Row Level
//      Security guarantees the model can only ever see the caller's own rows,
//   3. builds a compact summary (chatLogic.js) and asks Claude to answer from it.
//
// Required secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Optional secret:   ANTHROPIC_MODEL (default below)
// SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically.
// Deploy: supabase functions deploy finance-chat   (JWT verification stays ON)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateChatRequest, buildFinanceContext, buildSystemPrompt } from './chatLogic.js'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured.' }, 500)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON.' }, 400) }
  const v = validateChatRequest(body)
  if (!v.ok) return json({ error: v.error }, 400)

  // Client acts as the caller: RLS applies to every query below.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !userData?.user) return json({ error: 'Not signed in.' }, 401)
  const userId = userData.user.id

  // Last ~6 months of history, bounded.
  const start = new Date(v.today + 'T00:00:00Z')
  start.setUTCMonth(start.getUTCMonth() - 5)
  start.setUTCDate(1)
  const since = start.toISOString().slice(0, 10)

  const [exp, inc, bud] = await Promise.all([
    supabase.from('expenses').select('amount,category,description,expense_date').eq('user_id', userId).is('household_id', null).gte('expense_date', since).limit(2000),
    supabase.from('income').select('amount,source,income_date').eq('user_id', userId).gte('income_date', since).limit(500),
    supabase.from('budgets').select('category,monthly_limit,household_id').eq('user_id', userId).is('household_id', null),
  ])
  if (exp.error || inc.error || bud.error) return json({ error: 'Could not load your data.' }, 500)

  const context = buildFinanceContext({
    expenses: exp.data ?? [], income: inc.data ?? [], budgets: bud.data ?? [], today: v.today,
  })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: buildSystemPrompt(context),
      messages: v.messages,
    }),
  })
  if (!res.ok) {
    console.error('Anthropic API error', res.status, await res.text())
    return json({ error: 'The assistant is unavailable right now.' }, 502)
  }
  const out = await res.json()
  const reply = (out.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n').trim()
  return json({ reply: reply || "Sorry, I couldn't come up with an answer." })
})
