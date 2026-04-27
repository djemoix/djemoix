'use client'

import type { Reel } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Math.round(n).toLocaleString()
}

const THEME_KEYWORDS: Record<string, string[]> = {
  'AI & Tools': ['ai', 'chatgpt', 'claude', 'gpt', 'llm', 'openai', 'gemini', 'cursor', 'artificial intelligence'],
  'Automation': ['automate', 'automation', 'n8n', 'zapier', 'make.com', 'workflow', 'no-code', 'agentic'],
  'Business/Money': ['business', 'money', 'income', 'revenue', 'profit', 'earn', 'sales', 'client', 'freelance', 'lpa', 'salary'],
  'Tutorials': ['how to', 'guide', 'tutorial', 'learn', 'tips', 'tricks', 'step by step', 'beginner'],
  'Content/Reels': ['content', 'reel', 'video', 'editing', 'creator', 'viral', 'instagram', 'growth', 'followers'],
  'Coding/Dev': ['code', 'coding', 'developer', 'software', 'app', 'build', 'deploy', 'api', 'tech', 'github'],
  'Productivity': ['productive', 'save time', 'faster', 'efficient', 'replace', 'hours', 'workflow'],
  'Agency/Clients': ['agency', 'client', 'freelancer', 'retainer', 'proposal', 'leads', 'offer'],
}

function detectThemes(reels: Reel[]): Record<string, number> {
  const text = reels.map((r) => `${r.caption} ${r.transcript ?? ''}`).join(' ').toLowerCase()
  const scores: Record<string, number> = {}
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    scores[theme] = keywords.reduce((s, kw) => s + (text.split(kw).length - 1), 0)
  }
  return scores
}

function detectThemesTopReels(reels: Reel[]): Record<string, number> {
  const avg = reels.length > 0 ? reels.reduce((s, r) => s + r.views, 0) / reels.length : 0
  const topReels = reels.filter((r) => r.views >= avg)
  return detectThemes(topReels.length > 0 ? topReels : reels)
}

const ACCOUNT_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#10b981']

interface Props {
  myReels: Reel[]
  competitors: Record<string, Reel[]>
  myUsername?: string
}

export default function ComparisonView({ myReels, competitors, myUsername = 'manthanjethwani' }: Props) {
  const allAccounts = [
    { username: myUsername, reels: myReels, isMe: true },
    ...Object.entries(competitors).map(([username, reels]) => ({ username, reels, isMe: false })),
  ].filter((a) => a.reels.length > 0)

  if (allAccounts.length < 2) {
    return (
      <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-5 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>Fetch your reels and at least one competitor to see the comparison.</span>
      </div>
    )
  }

  const metrics = allAccounts.map((a, i) => {
    const avg = a.reels.reduce((s, r) => s + r.views, 0) / a.reels.length
    const avgEng = a.reels.reduce((s, r) => s + (r.views > 0 ? (r.likes + r.comments) / r.views : 0), 0) / a.reels.length * 100
    const topReel = a.reels.reduce((best, r) => r.views > best.views ? r : best, a.reels[0])
    return { ...a, avgViews: avg, avgEng, topReel, color: ACCOUNT_COLORS[i] }
  })

  const meMetrics = metrics[0]
  const chartData = metrics.map((m) => ({ name: `@${m.username}`, views: Math.round(m.avgViews), eng: parseFloat(m.avgEng.toFixed(2)) }))

  const themeScores = metrics.map((m) => ({ username: m.username, themes: detectThemesTopReels(m.reels), isMe: m.isMe }))
  const allThemes = Object.keys(THEME_KEYWORDS)

  const maxByTheme: Record<string, number> = {}
  for (const theme of allThemes) {
    maxByTheme[theme] = Math.max(1, ...themeScores.map((t) => t.themes[theme] ?? 0))
  }

  const radarData = allThemes.map((theme) => {
    const row: Record<string, string | number> = { theme }
    for (const ts of themeScores) {
      row[ts.username] = Math.round(((ts.themes[theme] ?? 0) / maxByTheme[theme]) * 100)
    }
    return row
  })

  const myThemes = themeScores[0].themes
  const competitorThemes: Record<string, number> = {}
  for (const ts of themeScores.slice(1)) {
    for (const [theme, score] of Object.entries(ts.themes)) {
      competitorThemes[theme] = (competitorThemes[theme] ?? 0) + score
    }
  }

  const gaps = allThemes
    .filter((t) => competitorThemes[t] > 5 && (myThemes[t] ?? 0) < competitorThemes[t] * 0.4)
    .sort((a, b) => competitorThemes[b] - competitorThemes[a])
    .slice(0, 4)

  const strengths = allThemes
    .filter((t) => (myThemes[t] ?? 0) > 3)
    .sort((a, b) => (myThemes[b] ?? 0) - (myThemes[a] ?? 0))
    .slice(0, 4)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
        {metrics.map((m, i) => (
          <div key={m.username} className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: m.color }} />
              <span className={`font-semibold text-sm ${m.isMe ? 'text-amber-300' : 'text-slate-300'}`}>
                @{m.username} {m.isMe && <span className="text-xs text-slate-500 ml-1">(you)</span>}
              </span>
            </div>
            <div className="text-3xl font-black text-white tracking-tight">{fmt(m.avgViews)}</div>
            <div className="text-xs text-slate-500 mb-2">avg views / reel</div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-emerald-400 font-medium">{m.avgEng.toFixed(1)}%</span>
              <span className="text-slate-600 text-xs">eng. rate</span>
            </div>
            {i > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700/50">
                {m.avgViews > meMetrics.avgViews ? (
                  <div className="flex items-center gap-1 text-xs text-rose-400">
                    <TrendingUp className="w-3 h-3" />
                    {Math.round(((m.avgViews - meMetrics.avgViews) / meMetrics.avgViews) * 100)}% more views than you
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <TrendingDown className="w-3 h-3" />
                    You&apos;re beating by {Math.round(((meMetrics.avgViews - m.avgViews) / m.avgViews) * 100)}%
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Avg Views Comparison</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={130} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="views" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {chartData.map((_, i) => (
                <rect key={i} fill={ACCOUNT_COLORS[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar chart */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Content Theme Comparison</h3>
        <p className="text-xs text-slate-500 mb-4">Based on top-performing reels per account</p>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#1e293b" />
            <PolarAngleAxis dataKey="theme" tick={{ fontSize: 11, fill: '#64748b' }} />
            {themeScores.map((ts, i) => (
              <Radar
                key={ts.username}
                name={`@${ts.username}`}
                dataKey={ts.username}
                stroke={ACCOUNT_COLORS[i]}
                fill={ACCOUNT_COLORS[i]}
                fillOpacity={0.1}
              />
            ))}
            <Legend formatter={(v) => <span className="text-xs text-slate-400">{v}</span>} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <h3 className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Your Strengths
          </h3>
          {strengths.length > 0 ? (
            <div className="space-y-2">
              {strengths.map((t) => (
                <div key={t} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{t}</span>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 rounded-full bg-emerald-500/40" style={{ width: `${Math.min(80, (myThemes[t] / 10) * 80)}px` }} />
                    <span className="text-xs text-slate-500">{myThemes[t]} signals</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Fetch your reels to analyze strengths.</p>
          )}
        </div>

        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <h3 className="text-sm font-semibold text-rose-300 mb-3 flex items-center gap-2">
            <Minus className="w-4 h-4" /> Content Gaps (competitors win here)
          </h3>
          {gaps.length > 0 ? (
            <div className="space-y-2">
              {gaps.map((t) => (
                <div key={t} className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{t}</span>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 rounded-full bg-rose-500/40" style={{ width: `${Math.min(80, (competitorThemes[t] / 20) * 80)}px` }} />
                    <span className="text-xs text-slate-500">{competitorThemes[t]} signals</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No significant gaps detected.</p>
          )}
        </div>
      </div>

      {/* Top reels */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/60">
          <h3 className="text-sm font-semibold text-slate-300">Top Reel per Account</h3>
        </div>
        <div className="divide-y divide-slate-700/40">
          {metrics.map((m) => (
            <div key={m.username} className="flex gap-4 p-4 items-start">
              <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: m.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-200">@{m.username}</span>
                  {m.isMe && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">you</span>}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-2">{m.topReel.caption || '(no caption)'}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="text-white font-semibold">{fmt(m.topReel.views)} views</span>
                  <span>❤️ {fmt(m.topReel.likes)}</span>
                  <a href={m.topReel.url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline ml-auto">View →</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
