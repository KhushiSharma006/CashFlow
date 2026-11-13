import { formatCurrency } from '../utils/constants'

export default function BudgetProgress({ category, spent, limit, onEdit, onDelete, readOnly = false, householdName }) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
  const overPct = limit > 0 ? (spent / limit) * 100 : 0

  let barColor = 'bg-sage'
  let status = 'On track'
  let statusColor = 'text-sage'
  if (overPct >= 100) {
    barColor = 'bg-rust'
    status = 'Over budget'
    statusColor = 'text-rust'
  } else if (overPct >= 80) {
    barColor = 'bg-brass'
    status = 'Near limit'
    statusColor = 'text-brass'
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-ink">{category}</p>
            {householdName && (
              <span className="text-[10px] font-mono uppercase tracking-wide text-ink-soft border border-line rounded-full px-1.5 py-0.5">
                {householdName}
              </span>
            )}
          </div>
          <p className={`text-xs font-medium ${statusColor}`}>{status}</p>
        </div>
        {!readOnly && (
          <div className="flex gap-2 text-xs">
            <button onClick={onEdit} className="text-ink-soft hover:text-ink">Edit</button>
            <button onClick={onDelete} className="text-ink-soft hover:text-rust">Remove</button>
          </div>
        )}
      </div>

      <div className="w-full h-2.5 bg-paper-raised rounded-full overflow-hidden border border-line">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between mt-2 text-sm">
        <span className="font-mono text-ink">{formatCurrency(spent)}</span>
        <span className="font-mono text-ink-soft">of {formatCurrency(limit)}</span>
      </div>
    </div>
  )
}
