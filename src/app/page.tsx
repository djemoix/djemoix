'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Reel } from '@/lib/types'
import ReelCard from '@/components/ReelCard'
import MetricsOverview from '@/components/MetricsOverview'
import PerformanceChart from '@/components/PerformanceChart'
import ScrapeProgress from '@/components/ScrapeProgress'
import CompetitorSection from '@/components/CompetitorSection'
import ComparisonView from '@/components/ComparisonView'
import {
  RefreshCw, LayoutDashboard, Users2, Lightbulb, AlertCircle,
  Loader2, Sparkles, Filter, Plus, X, Clock, GitCompare,
} from 'lucide-react'
import clsx from 'clsx'

type Tab = 'mine' | 'competitors' | 'compare' | 'ideas'
type ScrapeState = 'idle' | 'starting' | 'polling' | 'fetching' | 'done' | 'error'
type PerfFilter = 'all' | 'top' | 'mid' | 'low'

const MY_URL = 'https://www.instagram.com/manthanjethwani/'

async function pollStatus(runId: string): Promise<string> {
  const res = await fetch(`/api/scrape-status?runId=${runId}`)
  const data = await res.json()
  return data.status as string
}

async function startAndWait(
  instagramUrl: string,
  limit: number,
  onStatus: (s: ScrapeState) => void,
): Promise<Reel[]> {
  onStatus('starting')
  const startRes = await fetch('/api/start-scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instagramUrl, limit }),
  })

  if (!startRes.ok) {
    const err = await startRes.json()
    throw new Error(err.error ?? 'Failed to start scrape')
  }

  const { runId, datasetId } = await startRes.json()
  onStatus('polling')

  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 6_000))
    const status = await pollStatus(runId)
    if (status === 'SUCCEEDED') break
    if (status === 'FAILED' || status === 'ABORTED') throw new Error('Apify run failed')
  }

  onStatus('fetching')
  const res = await fetch(`/api/scrape-results?datasetId=${datasetId}&limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch results')
  const { reels } = await res.json()
  return reels as Reel[]
}

async function saveCache(key: string, data: unknown) {
  await fetch('/api/cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, data }),
  })
}

async function loadCache<T>(key: string): Promise<T | null> {
  const res = await fetch(`/api/cache?key=${key}`)
  const { data } = await res.json()
  return data as T | null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const SCRAPE_MSG: Record<ScrapeState, string> = {
  idle: '', starting: 'Starting Apify scraper…',
  polling: 'Scraping Instagram reels… (1–3 min)',
  fetching: 'Downloading results…', done: '', error: '',
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('mine')
  const [cacheLoading, setCacheLoading] = useState(true)
  const [myReels, setMyReels] = useState<Reel[]>([])
  const [myLastSynced, setMyLastSynced] = useState<string | null>(null)
  const [myScrapeState, setMyScrapeState] = useState<ScrapeState>('idle')
  const [myError, setMyError] = useState('')
  const [perfFilter, setPerfFilter] = useState<PerfFilter>('all')
  const [transcribingId, setTranscribingId] = useState<string | null>(null)
  const [competitors, setCompetitors] = useState<Record<string, Reel[]>>({})
  const [compLastSynced, setCompLastSynced] = useState<Record<string, string>>({})
  const [scrapingUsernames, setScrapingUsernames] = useState<Set<string>>(new Set())
  const [compErrors, setCompErrors] = useState<Record<string, string>>({})
  const [newUsername, setNewUsername] = useState('')
  const [ideas, setIdeas] = useState('')
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [ideasError, setIdeasError] = useState('')

  const myReelsRef = useRef(myReels)
  const competitorsRef = useRef(competitors)

  useEffect(() => { myReelsRef.current = myReels }, [myReels])
  useEffect(() => { competitorsRef.current = competitors }, [competitors])

  useEffect(() => {
    Promise.all([
      loadCache<{ reels: Reel[]; fetchedAt?: string }>('my_reels'),
      loadCache<{ accounts: Record<string, { reels: Reel[]; fetchedAt: string }> }>('competitors'),
    ]).then(([myCache, compCache]) => {
      if (myCache?.reels?.length) {
        setMyReels(myCache.reels)
        setMyLastSynced(myCache.fetchedAt ?? null)
        setMyScrapeState('done')
      }
      if (compCache?.accounts) {
        const reels: Record<string, Reel[]> = {}
        const synced: Record<string, string> = {}
        for (const [u, v] of Object.entries(compCache.accounts)) {
          reels[u] = v.reels
          synced[u] = v.fetchedAt
        }
        setCompetitors(reels)
        setCompLastSynced(synced)
      }
      setCacheLoading(false)
    })
  }, [])

  const fetchMyReels = useCallback(async () => {
    setMyError('')
    try {
      const reels = await startAndWait(MY_URL, 30, setMyScrapeState)
      const now = new Date().toISOString()
      setMyReels(reels)
      setMyLastSynced(now)
      setMyScrapeState('done')
      await saveCache('my_reels', { reels, fetchedAt: now })
    } catch (e: unknown) {
      setMyError(e instanceof Error ? e.message : String(e))
      setMyScrapeState('error')
    }
  }, [])

  const fetchCompetitor = useCallback(async (username: string) => {
    const url = `https://www.instagram.com/${username}/`
    setScrapingUsernames((prev) => new Set(Array.from(prev).concat(username)))
    setCompErrors((prev) => { const n = { ...prev }; delete n[username]; return n })
    try {
      const reels = await startAndWait(url, 15, () => {})
      const now = new Date().toISOString()
      setCompetitors((prev) => {
        const updated = { ...prev, [username]: reels }
        const accounts: Record<string, { reels: Reel[]; fetchedAt: string }> = {}
        for (const [u, r] of Object.entries(updated)) {
          accounts[u] = { reels: r, fetchedAt: compLastSynced[u] ?? now }
        }
        accounts[username] = { reels, fetchedAt: now }
        saveCache('competitors', { accounts })
        return updated
      })
      setCompLastSynced((prev) => ({ ...prev, [username]: now }))
    } catch (e: unknown) {
      setCompErrors((prev) => ({ ...prev, [username]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setScrapingUsernames((prev) => { const n = new Set(Array.from(prev)); n.delete(username); return n })
    }
  }, [compLastSynced])

  const addCompetitor = useCallback(() => {
    const clean = newUsername.replace('@', '').trim().toLowerCase()
    if (!clean) return
    setNewUsername('')
    if (!competitors[clean]) fetchCompetitor(clean)
  }, [newUsername, competitors, fetchCompetitor])

  const removeCompetitor = useCallback((username: string) => {
    setCompetitors((prev) => {
      const updated = { ...prev }
      delete updated[username]
      const accounts: Record<string, { reels: Reel[]; fetchedAt: string }> = {}
      for (const [u, r] of Object.entries(updated)) {
        accounts[u] = { reels: r, fetchedAt: compLastSynced[u] ?? '' }
      }
      saveCache('competitors', { accounts })
      return updated
    })
    setCompLastSynced((prev) => { const n = { ...prev }; delete n[username]; return n })
  }, [compLastSynced])

  const handleTranscribe = useCallback(async (reel: Reel) => {
    if (!reel.audioUrl) return
    setTranscribingId(reel.id)
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: reel.audioUrl }),
      })
      const data = await res.json()
      if (data.transcript) {
        setMyReels((prev) => {
          const updated = prev.map((r) => r.id === reel.id ? { ...r, transcript: data.transcript } : r)
          saveCache('my_reels', { reels: updated, fetchedAt: myLastSynced })
          return updated
        })
      }
    } finally {
      setTranscribingId(null)
    }
  }, [myLastSynced])

  const generateIdeas = useCallback(async () => {
    setIdeasLoading(true)
    setIdeasError('')
    try {
      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ myReels: myReelsRef.current, competitorReels: competitorsRef.current }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setIdeas(data.ideas as string)
    } catch (e: unknown) {
      setIdeasError(e instanceof Error ? e.message : String(e))
    } finally {
      setIdeasLoading(false)
    }
  }, [])

  const filteredReels = perfFilter === 'all' ? myReels : myReels.filter((r) => r.performance === perfFilter)
  const competitorUsernames = Object.keys(competitors)

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'mine', label: 'My Reels', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'competitors', label: 'Competitors', icon: <Users2 className="w-4 h-4" /> },
    { id: 'compare', label: 'Compare', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'ideas', label: 'Content Ideas', icon: <Lightbulb className="w-4 h-4" /> },
  ]

  return (
    <main className="min-h-screen bg-[#0a0f1e]">
      <header className="border-b border-slate-800 bg-[#0a0f1e]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">Content Dashboard</h1>
              <p className="text-xs text-slate-500">@manthanjethwani</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  tab === t.id ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* MY REELS TAB */}
        {tab === 'mine' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">My Reels</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-slate-500 text-sm">Last 30 days · @manthanjethwani</p>
                  {myLastSynced && (
                    <span className="flex items-center gap-1 text-xs text-slate-600">
                      <Clock className="w-3 h-3" /> {timeAgo(myLastSynced)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={fetchMyReels}
                disabled={['starting', 'polling', 'fetching'].includes(myScrapeState)}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={clsx('w-4 h-4', myScrapeState === 'polling' && 'animate-spin')} />
                {myLastSynced ? 'Re-sync' : 'Fetch Reels'}
              </button>
            </div>

            {myScrapeState === 'error' && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-4 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{myError}</span>
              </div>
            )}

            {['starting', 'polling', 'fetching'].includes(myScrapeState) && (
              <ScrapeProgress message={SCRAPE_MSG[myScrapeState]} subtext="Apify is scraping your Instagram profile…" />
            )}

            {myReels.length > 0 && !['starting', 'polling', 'fetching'].includes(myScrapeState) && (
              <>
                <MetricsOverview reels={myReels} />
                <PerformanceChart reels={myReels} />

                <div className="flex items-center gap-2 mb-5">
                  <Filter className="w-4 h-4 text-slate-500" />
                  {(['all', 'top', 'mid', 'low'] as PerfFilter[]).map((f) => {
                    const count = f === 'all' ? myReels.length : myReels.filter((r) => r.performance === f).length
                    return (
                      <button
                        key={f}
                        onClick={() => setPerfFilter(f)}
                        className={clsx(
                          'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                          perfFilter === f
                            ? f === 'top' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : f === 'low' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                            : f === 'mid' ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                            : 'bg-slate-700 border-slate-600 text-white'
                            : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
                        )}
                      >
                        {f === 'all' ? 'All' : f === 'top' ? 'Top' : f === 'mid' ? 'Average' : 'Low'} ({count})
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredReels.map((reel) => (
                    <ReelCard key={reel.id} reel={reel} onTranscribe={handleTranscribe} transcribing={transcribingId === reel.id} />
                  ))}
                </div>

                {filteredReels.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-12">No reels match this filter.</p>
                )}
              </>
            )}

            {myScrapeState === 'idle' && myReels.length === 0 && (
              cacheLoading ? (
                <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading saved data…</span>
                </div>
              ) : (
                <div className="text-center py-24 border border-dashed border-slate-700 rounded-2xl">
                  <LayoutDashboard className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-white font-semibold mb-2">No data yet</h3>
                  <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                    Fetch your last 30 days of reels. Results are cached locally — no re-scrape needed on refresh.
                  </p>
                  <button onClick={fetchMyReels} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors">
                    Fetch My Reels
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* COMPETITORS TAB */}
        {tab === 'competitors' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">Competitors</h2>
              <p className="text-slate-500 text-sm mt-0.5">Add any Instagram username to scrape their reels</p>
            </div>

            <div className="flex gap-3 mb-6">
              <div className="relative flex-1 max-w-sm">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
                  placeholder="username"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 placeholder:text-slate-600"
                />
              </div>
              <button
                onClick={addCompetitor}
                disabled={!newUsername.trim()}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> Add &amp; Scrape
              </button>
            </div>

            {competitorUsernames.length === 0 && scrapingUsernames.size === 0 && (
              <div className="text-center py-20 border border-dashed border-slate-700 rounded-2xl">
                <Users2 className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">No competitors added</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                  Type a username above and click &quot;Add &amp; Scrape&quot;. Try <span className="text-violet-400">nateherk</span> or <span className="text-violet-400">nick_saraev</span>
                </p>
              </div>
            )}

            {Array.from(scrapingUsernames).map((username) => (
              <div key={username} className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  <span className="text-sm text-violet-300 font-medium">Scraping @{username}…</span>
                  <span className="text-xs text-slate-500">Apify is fetching their reels (1–3 min)</span>
                </div>
              </div>
            ))}

            {competitorUsernames.length > 0 && (
              <div className="space-y-6">
                {competitorUsernames.map((username) => (
                  <div key={username}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {compLastSynced[username] && (
                          <span className="flex items-center gap-1 text-xs text-slate-600">
                            <Clock className="w-3 h-3" /> {timeAgo(compLastSynced[username])}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fetchCompetitor(username)}
                          disabled={scrapingUsernames.has(username)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
                        >
                          <RefreshCw className={clsx('w-3 h-3', scrapingUsernames.has(username) && 'animate-spin')} />
                          Re-sync
                        </button>
                        <button
                          onClick={() => removeCompetitor(username)}
                          className="flex items-center gap-1 text-xs text-slate-600 hover:text-rose-400 transition-colors"
                        >
                          <X className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>

                    {compErrors[username] && (
                      <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-2 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {compErrors[username]}
                      </div>
                    )}

                    <CompetitorSection username={username} reels={competitors[username] ?? []} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMPARE TAB */}
        {tab === 'compare' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">Compare</h2>
              <p className="text-slate-500 text-sm mt-0.5">Me vs competitors — what&apos;s working, what&apos;s not, content gaps</p>
            </div>
            <ComparisonView myReels={myReels} competitors={competitors} />
          </div>
        )}

        {/* CONTENT IDEAS TAB */}
        {tab === 'ideas' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Content Ideas</h2>
                <p className="text-slate-500 text-sm mt-0.5">AI strategy based on your performance + competitor data</p>
              </div>
              <button
                onClick={generateIdeas}
                disabled={ideasLoading}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ideasLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-4 h-4" /> {ideas ? 'Regenerate' : 'Generate Ideas'}</>}
              </button>
            </div>

            {(myReels.length === 0 || competitorUsernames.length === 0) && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-4 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  {myReels.length === 0 && 'Fetch your reels first (My Reels tab). '}
                  {competitorUsernames.length === 0 && 'Add competitors (Competitors tab) for better ideas.'}
                </span>
              </div>
            )}

            {ideasError && (
              <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl p-4 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{ideasError}</span>
              </div>
            )}

            {ideasLoading && (
              <ScrapeProgress message="Analyzing your content + competitors…" subtext="GPT-4o is reviewing data and generating a strategy" />
            )}

            {ideas && !ideasLoading && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-300">Content Strategy Report</span>
                </div>
                <div className="space-y-1">
                  {ideas.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-2" />
                    if (line.match(/^\*\*.*\*\*$/) || line.match(/^#{1,3} /)) {
                      return <h3 key={i} className="text-base font-bold text-white mt-5 mb-2 pt-2">{line.replace(/\*\*/g, '').replace(/^#{1,3} /, '')}</h3>
                    }
                    if (line.startsWith('- ') || line.startsWith('• ')) {
                      return (
                        <div key={i} className="flex gap-2 text-slate-300 text-sm py-0.5">
                          <span className="text-emerald-400 flex-shrink-0 mt-0.5">•</span>
                          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                        </div>
                      )
                    }
                    return <p key={i} className="text-slate-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                  })}
                </div>
              </div>
            )}

            {!ideas && !ideasLoading && (
              <div className="text-center py-24 border border-dashed border-slate-700 rounded-2xl">
                <Lightbulb className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white font-semibold mb-2">No ideas yet</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                  Click &quot;Generate Ideas&quot; — GPT-4o will analyze your top performers vs competitors and tell you exactly what to make next.
                </p>
                <button onClick={generateIdeas} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors">
                  Generate Ideas
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
