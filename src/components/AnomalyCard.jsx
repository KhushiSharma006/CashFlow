import { formatCurrency } from '../utils/constants'

export default function AnomalyCard({ category, mean, current, pctAboveAvg }) {
  return (
    <div className="bg-surface border border-rust/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-ink">{category}</p>
        <span className="font-mono text-xs text-rust bg-rust-soft rounded-full px-2 py-0.5">
          +{Math.round(pctAboveAvg)}% vs. usual
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-mono text-rust font-medium">{formatCurrency(current)}</span>
        <span className="font-mono text-ink-soft">avg {formatCurrency(mean)}</span>
      </div>
      <p className="text-xs text-ink-soft mt-2">
        Projected pace this month is well above your historical average for this category.
      </p>
    </div>
  )
}
