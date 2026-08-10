export default function StatCard({ label, value, accent = 'ink', sub }) {
  const accentClass = {
    ink: 'text-ink',
    brass: 'text-brass',
    rust: 'text-rust',
    sage: 'text-sage',
  }[accent]

  return (
    <div className="bg-surface border border-line rounded-xl p-5">
      <p className="font-mono text-[11px] uppercase tracking-widest text-ink-soft mb-2">
        {label}
      </p>
      <p className={`font-display text-3xl font-semibold ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-ink-soft mt-1.5">{sub}</p>}
    </div>
  )
}
