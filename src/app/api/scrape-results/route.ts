import { NextRequest, NextResponse } from 'next/server'
import { fetchResults, tagPerformance } from '@/lib/apify'

export async function GET(req: NextRequest) {
  const datasetId = req.nextUrl.searchParams.get('datasetId')
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 30)

  if (!datasetId) return NextResponse.json({ error: 'datasetId required' }, { status: 400 })

  try {
    const reels = await fetchResults(datasetId, limit)
    const tagged = tagPerformance(reels)
    return NextResponse.json({ reels: tagged })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
