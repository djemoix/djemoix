import { NextRequest, NextResponse } from 'next/server'
import { startScrapeRun } from '@/lib/apify'

export async function POST(req: NextRequest) {
  try {
    const { instagramUrl, limit } = await req.json()

    if (!instagramUrl) return NextResponse.json({ error: 'instagramUrl required' }, { status: 400 })

    if (!process.env.APIFY_TOKEN) {
      return NextResponse.json({ error: 'APIFY_TOKEN not set in .env.local' }, { status: 500 })
    }

    const job = await startScrapeRun(instagramUrl, limit ?? 30)

    return NextResponse.json(job)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
