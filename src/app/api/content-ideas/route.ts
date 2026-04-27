import { NextRequest, NextResponse } from 'next/server'
import type { Reel } from '@/lib/types'

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
  }

  const { myReels, competitorReels }: { myReels: Reel[]; competitorReels: Record<string, Reel[]> } =
    await req.json()

  const myTopReels = [...(myReels ?? [])]
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((r) => `- ${r.views.toLocaleString()} views | Caption: ${r.caption.slice(0, 200)}`)
    .join('\n')

  const myLowReels = [...(myReels ?? [])]
    .sort((a, b) => a.views - b.views)
    .slice(0, 3)
    .map((r) => `- ${r.views.toLocaleString()} views | Caption: ${r.caption.slice(0, 150)}`)
    .join('\n')

  const competitorContext = Object.entries(competitorReels ?? {})
    .map(([username, reels]) => {
      const topReels = [...reels]
        .sort((a, b) => b.views - a.views)
        .slice(0, 3)
        .map((r) => ` - ${r.views.toLocaleString()} views | ${r.caption.slice(0, 200)}`)
        .join('\n')
      return `@${username} top reels:\n${topReels}`
    })
    .join('\n\n')

  const prompt = `You are a world-class Instagram content strategist.

MY ACCOUNT: @manthanjethwani

TOP PERFORMING REELS (by views):
${myTopReels || '(no data yet)'}

UNDERPERFORMING REELS:
${myLowReels || '(no data yet)'}

COMPETITOR DATA:
${competitorContext || '(no competitor data yet)'}

Based on this data, provide:

1. **3 content themes that are clearly working** (from my top reels and competitors' top reels)

2. **3 content themes I should STOP making** (from underperforming reels)

3. **5 specific reel ideas I should make this week** — each with:
   - Hook (first 3 seconds)
   - Core content angle
   - Why it will work (based on data)

4. **Best time/day to post** (based on timestamps if available)

5. **1 headline insight** — the single biggest observation from the data

Keep it sharp, specific, and actionable. No fluff. Reference specific view counts where relevant.`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`)

    const data = await res.json()
    const ideas = data.choices[0].message.content as string
    return NextResponse.json({ ideas })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
