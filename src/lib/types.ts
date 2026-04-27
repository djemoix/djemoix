export interface Reel {
  id: string
  url: string
  timestamp: string
  likes: number
  views: number
  comments: number
  caption: string
  audioUrl?: string
  videoUrl?: string
  thumbnailUrl?: string
  duration?: number
  ownerUsername: string
  transcript?: string
  performance?: 'top' | 'mid' | 'low'
}

export interface ScrapeJob {
  runId: string
  datasetId: string
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'READY'
}

export type Tab = 'mine' | 'competitors' | 'ideas'
