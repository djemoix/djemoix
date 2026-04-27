'use client'

import { useState } from 'react'
import type { Reel } from '@/lib/types'
import { Eye, Heart, MessageCircle, Play, Loader2, FileText, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

interface Props {
  reel: Reel
  onTranscribe?: (reel: Reel) => void
  transcribing?: boolean
}

const PERF_STYLES = {
  top: 'border-amber-500/60 bg-amber-500/5',
  mid: 'border-slate-600/60 bg-slate-800/60',
  low: 'border-rose-500/40 bg-rose-500/5',
}

const PERF_BADGE = {
  top: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  mid: 'bg-slate-600/30 text-slate-400 border border-slate-600/30',
  low: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
}

const PERF_LABEL = { top: 'Top Performer', mid: 'Average', low: 'Underperforming' }

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default function ReelCard({ reel, onTranscribe, transcribing }: Props) {
  const [showTranscript, setShowTranscript] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  const perf = reel.performance ?? 'mid'
  const engRate = reel.views > 0 ? (((reel.likes + reel.comments) / reel.views) * 100).toFixed(1) : '0.0'
  const postedDate = reel.timestamp ? new Date(reel.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

  return (
    <div className={clsx('rounded-xl border card-hover flex flex-col', PERF_STYLES[perf])}>
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] max-h-52 rounded-t-xl overflow-hidden bg-slate-800 flex-shrink-0">
        {reel.thumbnailUrl && !imgFailed ? (
          <img
            src={`/api/proxy-image?url=${encodeURIComponent(reel.thumbnailUrl)}`}
            alt="reel"
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Play className="w-8 h-8 text-slate-600" />
            {imgFailed && <span className="text-xs text-slate-600">preview unavailable</span>}
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', PERF_BADGE[perf])}>
            {PERF_LABEL[perf]}
          </span>
        </div>
        <div className="absolute bottom-2 left-2 text-xs text-white/70 bg-black/50 rounded px-1.5 py-0.5">
          {postedDate}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex justify-between items-center px-3 py-2 border-b border-slate-700/50 gap-2">
        <div className="flex items-center gap-1 text-slate-300 min-w-0">
          <Eye className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
          <span className="text-sm font-semibold">{fmt(reel.views)}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-300">
          <Heart className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          <span className="text-sm">{fmt(reel.likes)}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-300">
          <MessageCircle className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
          <span className="text-sm">{fmt(reel.comments)}</span>
        </div>
        <div className="text-xs text-amber-400 font-mono">{engRate}%</div>
      </div>

      {/* Caption */}
      <div className="px-3 pt-2 pb-1 flex-1">
        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
          {reel.caption || '(no caption)'}
        </p>
      </div>

      {/* Transcript section */}
      {reel.transcript && (
        <div className="mx-3 mb-2 mt-1">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            {showTranscript ? 'Hide transcript' : 'Show transcript'}
          </button>
          {showTranscript && (
            <p className="mt-1.5 text-xs text-slate-400 bg-slate-800/80 rounded p-2 leading-relaxed max-h-28 overflow-y-auto">
              {reel.transcript}
            </p>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex gap-2 px-3 pb-3 pt-1">
        {!reel.transcript && reel.audioUrl && onTranscribe && (
          <button
            onClick={() => onTranscribe(reel)}
            disabled={transcribing}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-600/30 rounded-lg py-1.5 transition-colors disabled:opacity-50"
          >
            {transcribing ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Transcribing…</>
            ) : (
              <><FileText className="w-3 h-3" /> Transcribe</>
            )}
          </button>
        )}
        <a
          href={reel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors ml-auto"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
