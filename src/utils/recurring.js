import { supabase } from '../lib/supabaseClient'

function addInterval(date, frequency) {
  const d = new Date(date + 'T00:00:00')
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * For each active recurring template, generate any occurrences that are
 * due (last_generated -> today), insert them as real expense/income rows,
 * and advance last_generated. Capped per template to avoid runaway loops
 * for templates left untouched for a long time.
 */
export async function runRecurringEngine(userId) {
  const today = new Date().toISOString().slice(0, 10)

  const { data: templates, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)

  if (error || !templates) return { generated: 0, error }

  let generated = 0

  for (const t of templates) {
    let cursor = t.last_generated || t.start_date
    let next = t.last_generated ? addInterval(cursor, t.frequency) : cursor
    const rowsToInsert = []
    let safety = 0

    while (next <= today && safety < 36) {
      rowsToInsert.push(next)
      cursor = next
      next = addInterval(next, t.frequency)
      safety++
    }

    if (rowsToInsert.length === 0) continue

    if (t.type === 'expense') {
      const rows = rowsToInsert.map((date) => ({
        user_id: userId,
        amount: t.amount,
        category: t.label,
        description: t.description || `${t.label} (auto-generated)`,
        expense_date: date,
      }))
      const { error: insertErr } = await supabase.from('expenses').insert(rows)
      if (!insertErr) generated += rows.length
    } else {
      const rows = rowsToInsert.map((date) => ({
        user_id: userId,
        amount: t.amount,
        source: t.label,
        income_date: date,
      }))
      const { error: insertErr } = await supabase.from('income').insert(rows)
      if (!insertErr) generated += rows.length
    }

    await supabase
      .from('recurring_templates')
      .update({ last_generated: cursor })
      .eq('id', t.id)
  }

  return { generated, error: null }
}
