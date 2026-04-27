import type { Reel } from './types'

const APIFY_TOKEN = process.env.APIFY_TOKEN ?? ''

const ACTOR_ID = 'shu8hvrXbJbY3Eb9W'

const BASE = 'https://api.apify.com/v2'

export async function startScrapeRun(instagramUrl: string, limit = 30) {
  const res = await fetch(`${BASE}/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directUrls: [instagramUrl],
      resultsType: 'posts',
      resultsLimit: limit,
      mediaType: 'VIDEO',
      addParentData: false,
    }),
  })
  if (!res.ok) throw new Error(`Apify start failed: ${res.status}`)
  const data = await res.json()
  return {
    runId: data.data.id as string,
    datasetId: data.data.defaultDatasetId as string,
  }
}

export async function getRunStatus(runId: string): Promise<string> {
  const res = await fetch(`${BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`)
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
  const data = await res.json()
  return data.data.status as string
}

export async function fetchResults(datasetId: string, limit = 30): Promise<Reel[]> {
  const res = await fetch(
    `${BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&format=json`
  )
  if (!res.ok) throw new Error(`Results fetch failed: ${res.status}`)
  const items = await res.json()
  return (items as Record<string, unknown>[]).map((item) => ({
    id: (item.id ?? item.url ?? String(Math.random())) as string,
    url: item.url as string ?? '',
    timestamp: item.timestamp as string ?? '',
    likes: Number(item.likesCount ?? 0),
    views: Number(item.videoPlayCount ?? 0),
    comments: Number(item.commentsCount ?? 0),
    caption: (item.caption as string ?? '').slice(0, 600),
    audioUrl: item.audioUrl as string | undefined,
    videoUrl: item.videoUrl as string | undefined,
    thumbnailUrl: (item.displayUrl ?? item.thumbnailUrl) as string | undefined,
    duration: item.videoDuration as number | undefined,
    ownerUsername: item.ownerUsername as string ?? '',
  }))
}

export function tagPerformance(reels: Reel[]): Reel[] {
  if (reels.length === 0) return reels
  const avg = reels.reduce((s, r) => s + r.views, 0) / reels.length
  return reels.map((r) => ({
    ...r,
    performance: r.views >= avg * 1.4 ? 'top' : r.views < avg * 0.6 ? 'low' : 'mid',
  }))
}
