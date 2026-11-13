// Supabase Edge Function: scan-receipt
//
// Receives a (client-downscaled) receipt photo, asks Claude's vision model to
// read the total/date/merchant, validates the answer (receiptLogic.js) and
// returns a pre-filled expense. It NEVER saves anything: the browser shows a
// confirm card first, and the insert happens under the user's own RLS.
//
// Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (shared with finance-chat)
// Deploy: supabase functions deploy scan-receipt               (JWT verification stays ON)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateScanRequest, buildReceiptPrompt, parseReceiptResponse } from './receiptLogic.js'

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
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !userData?.user) return json({ error: 'Not signed in.' }, 401)

  let body
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON.' }, 400) }
  const v = validateScanRequest(body)
  if (!v.ok) return json({ error: v.error }, 400)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: buildReceiptPrompt(v.categories, v.today),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: v.mediaType, data: v.image } },
          { type: 'text', text: 'Extract the expense details from this receipt.' },
        ],
      }],
    }),
  })
  if (!res.ok) {
    console.error('Anthropic API error', res.status, await res.text())
    return json({ error: 'Receipt scanning is unavailable right now.' }, 502)
  }
  const out = await res.json()
  const text = (out.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n')
  const parsed = parseReceiptResponse(text, { categories: v.categories, today: v.today })
  if (!parsed.ok) return json({ error: parsed.error }, 422)
  return json({ entry: parsed.entry })
})
