import { NextRequest, NextResponse } from 'next/server'
import { getRunStatus } from '@/lib/apify'

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('runId')

  if (!runId) return NextResponse.json({ error: 'runId required' }, { status: 400 })

  try {
    const status = await getRunStatus(runId)
    return NextResponse.json({ status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
