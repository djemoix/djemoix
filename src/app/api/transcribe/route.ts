import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { audioUrl } = await req.json()

  if (!audioUrl) return NextResponse.json({ error: 'audioUrl required' }, { status: 400 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set in .env.local' }, { status: 500 })
  }

  try {
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(30_000) })

    if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`)

    const audioBuffer = await audioRes.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' })

    const form = new FormData()
    form.append('file', audioBlob, 'audio.mp4')
    form.append('model', 'whisper-1')
    form.append('response_format', 'text')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      throw new Error(`Whisper API error: ${err}`)
    }

    const transcript = await whisperRes.text()
    return NextResponse.json({ transcript: transcript.trim() })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
