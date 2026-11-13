import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import { formatCurrency } from '../utils/constants'

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const isForecast = p.payload.isForecast
  return (
    <div className="bg-surface border border-line rounded-md px-3 py-2 shadow-sm text-sm">
      <p className="font-medium text-ink mb-0.5">{label}{isForecast ? ' (forecast)' : ''}</p>
      <p className="font-mono" style={{ color: isForecast ? 'var(--brass)' : 'var(--ink-soft)' }}>
        {formatCurrency(p.value)}
      </p>
    </div>
  )
}

export default function ForecastChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} axisLine={{ stroke: 'var(--line)' }} tickLine={false} />
        <YAxis tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
        <Tooltip content={<ForecastTooltip />} cursor={{ fill: 'var(--paper-raised)' }} />
        <Bar dataKey="total" radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.isForecast ? 'var(--brass)' : 'var(--ink-soft)'} fillOpacity={d.isForecast ? 0.85 : 1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
