'use client'

import type { Reel } from '@/lib/types'
import { Eye, Heart, MessageCircle, ExternalLink } from 'lucide-react'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

interface Props {
  username: string
  reels: Reel[]
}

function CompetitorReel({ reel, rank }: { reel: Reel; rank: number }) {
  const engRate = reel.views > 0
    ? (((reel.likes + reel.comments) / reel.views) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="flex gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-800/40 hover:border-slate-600/60 transition-colors">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-400">
        {rank}
      </div>
      {reel.thumbnailUrl && (
        <img
          src={`/api/proxy-image?url=${encodeURIComponent(reel.thumbnailUrl)}`}
          alt=""
          className="flex-shrink-0 w-12 h-16 rounded object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-2">
          {reel.caption || '(no caption)'}
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3 text-sky-400" /> {fmt(reel.views)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-rose-400" /> {fmt(reel.likes)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-violet-400" /> {fmt(reel.comments)}
          </span>
          <span className="text-amber-400">{engRate}%</span>
          <a href={reel.url} target="_blank" rel="noopener noreferrer" className="ml-auto hover:text-slate-300">
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

export default function CompetitorSection({ username, reels }: Props) {
  const sorted = [...reels].sort((a, b) => b.views - a.views)

  const avgViews = reels.length > 0 ? reels.reduce((s, r) => s + r.views, 0) / reels.length : 0

  const avgEng = reels.length > 0
    ? reels.reduce((s, r) => s + (r.views > 0 ? (r.likes + r.comments) / r.views : 0), 0) / reels.length * 100
    : 0

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">@{username}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{reels.length} reels scraped</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-sm font-bold text-amber-400">{fmt(avgViews)}</div>
            <div className="text-xs text-slate-500">avg views</div>
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-400">{avgEng.toFixed(1)}%</div>
            <div className="text-xs text-slate-500">avg eng.</div>
          </div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2.5 max-h-[500px] overflow-y-auto">
        {sorted.slice(0, 10).map((reel, i) => (
          <CompetitorReel key={reel.id} reel={reel} rank={i + 1} />
        ))}
        {reels.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">No data scraped yet.</p>
        )}
      </div>
    </div>
  )
}
