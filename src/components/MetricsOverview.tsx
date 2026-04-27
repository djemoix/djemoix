'use client'

import type { Reel } from '@/lib/types'
import { Eye, Heart, TrendingUp, BarChart2, Zap, ThumbsDown } from 'lucide-react'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toLocaleString()
}

export default function MetricsOverview({ reels }: { reels: Reel[] }) {
  if (reels.length === 0) return null

  const totalViews = reels.reduce((s, r) => s + r.views, 0)
  const totalLikes = reels.reduce((s, r) => s + r.likes, 0)
  const avgViews = totalViews / reels.length
  const avgEng = reels.reduce((s, r) => s + (r.views > 0 ? (r.likes + r.comments) / r.views : 0), 0) / reels.length * 100
  const topReel = reels.reduce((a, b) => (b.views > a.views ? b : a), reels[0])
  const topCount = reels.filter((r) => r.performance === 'top').length
  const lowCount = reels.filter((r) => r.performance === 'low').length

  const stats = [
    {
      icon: <Eye className="w-5 h-5 text-sky-400" />,
      label: 'Total Views',
      value: fmt(totalViews),
      sub: `${reels.length} reels`,
      color: 'from-sky-500/10',
    },
    {
      icon: <BarChart2 className="w-5 h-5 text-violet-400" />,
      label: 'Avg Views / Reel',
      value: fmt(avgViews),
      sub: 'last 30 days',
      color: 'from-violet-500/10',
    },
    {
      icon: <Heart className="w-5 h-5 text-rose-400" />,
      label: 'Total Likes',
      value: fmt(totalLikes),
      sub: `${avgEng.toFixed(1)}% avg eng.`,
      color: 'from-rose-500/10',
    },
    {
      icon: <TrendingUp className="w-5 h-5 text-amber-400" />,
      label: 'Best Reel',
      value: fmt(topReel.views),
      sub: new Date(topReel.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      color: 'from-amber-500/10',
    },
    {
      icon: <Zap className="w-5 h-5 text-emerald-400" />,
      label: 'Top Performers',
      value: String(topCount),
      sub: `${Math.round((topCount / reels.length) * 100)}% of reels`,
      color: 'from-emerald-500/10',
    },
    {
      icon: <ThumbsDown className="w-5 h-5 text-red-400" />,
      label: 'Underperforming',
      value: String(lowCount),
      sub: `${Math.round((lowCount / reels.length) * 100)}% of reels`,
      color: 'from-red-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`rounded-xl border border-slate-700/60 bg-gradient-to-b ${s.color} to-slate-800/80 p-4`}
        >
          <div className="flex items-center gap-2 mb-3">
            {s.icon}
            <span className="text-xs text-slate-500">{s.label}</span>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">{s.value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
        </div>
      ))}
    </div>
  )
}
