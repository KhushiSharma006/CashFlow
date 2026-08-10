import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { colorForCategory, formatCurrency } from '../utils/constants'

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-surface border border-line rounded-md px-3 py-2 shadow-sm text-sm">
      <p className="font-medium text-ink">{p.name}</p>
      <p className="font-mono text-ink-soft">{formatCurrency(p.value)}</p>
    </div>
  )
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-line rounded-md px-3 py-2 shadow-sm text-sm">
      <p className="font-medium text-ink mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-mono" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export function CategoryPieChart({ data }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-ink-soft">
        No expenses logged for this month yet.
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={colorForCategory(entry.name)} stroke="var(--surface)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MonthlyTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
        <YAxis tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--paper-raised)' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="Income" fill="var(--sage)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="var(--rust)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
