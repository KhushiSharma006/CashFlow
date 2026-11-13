import { supabase } from '../lib/supabaseClient'
import { toLocalISODate } from './constants'

export function addInterval(date, frequency) {
  const d = new Date(date + 'T00:00:00')
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return toLocalISODate(d)
}

/**
 * Pure function: given a template's last-generated date (or start date, if
 * it's never run), its frequency, and "today", returns every occurrence
 * date that is now due, plus the new last_generated value to persist.
 * Capped at 36 iterations so a very old, never-run template can't produce
 * an unbounded loop.
 */
export function computeDueDates({ lastGenerated, startDate, frequency }, today) {
  let cursor = lastGenerated || startDate
  let next = lastGenerated ? addInterval(cursor, frequency) : cursor
  const dueDates = []
  let safety = 0

  while (next <= today && safety < 36) {
    dueDates.push(next)
    cursor = next
    next = addInterval(next, frequency)
    safety++
  }

  return { dueDates, newLastGenerated: dueDates.length > 0 ? cursor : lastGenerated }
}

/**
 * For each active recurring template, generate any occurrences that are
 * due, insert them as real expense/income rows, and advance last_generated.
 */
export async function runRecurringEngine(userId) {
  const today = toLocalISODate(new Date())

  const { data: templates, error } = await supabase
    .from('recurring_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)

  if (error || !templates) return { generated: 0, error }

  let generated = 0

  for (const t of templates) {
    const { dueDates, newLastGenerated } = computeDueDates(
      { lastGenerated: t.last_generated, startDate: t.start_date, frequency: t.frequency },
      today
    )

    if (dueDates.length === 0) continue

    if (t.type === 'expense') {
      const rows = dueDates.map((date) => ({
        user_id: userId,
        amount: t.amount,
        category: t.label,
        description: t.description || `${t.label} (auto-generated)`,
        expense_date: date,
      }))
      const { error: insertErr } = await supabase.from('expenses').insert(rows)
      if (!insertErr) generated += rows.length
    } else {
      const rows = dueDates.map((date) => ({
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
      .update({ last_generated: newLastGenerated })
      .eq('id', t.id)
  }

  return { generated, error: null }
}
