'use client'

import type { Reel } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

const PERF_COLOR = { top: '#f59e0b', mid: '#6366f1', low: '#f43f5e' }

interface TooltipPayload {
  payload?: { views: number; likes: number; caption: string }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs max-w-56 shadow-xl">
      <div className="text-white font-semibold mb-1">{fmt(d.views)} views</div>
      <div className="text-slate-400">❤️ {fmt(d.likes)} likes</div>
      <p className="text-slate-500 mt-1.5 line-clamp-2">{d.caption}</p>
    </div>
  )
}

export default function PerformanceChart({ reels }: { reels: Reel[] }) {
  if (reels.length === 0) return null
  const sorted = [...reels].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const data = sorted.map((r, i) => ({
    name: `#${i + 1}`,
    views: r.views,
    likes: r.likes,
    caption: r.caption.slice(0, 80),
    performance: r.performance ?? 'mid',
  }))
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5 mb-8">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Views by Reel (chronological)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="views" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((d, i) => (
              <Cell key={i} fill={PERF_COLOR[d.performance as keyof typeof PERF_COLOR]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-5 mt-3 justify-center">
        {(['top', 'mid', 'low'] as const).map((p) => (
          <div key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: PERF_COLOR[p] }} />
            {p === 'top' ? 'Top' : p === 'mid' ? 'Average' : 'Low'}
          </div>
        ))}
      </div>
    </div>
  )
}
