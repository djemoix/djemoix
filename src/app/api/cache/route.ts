import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  ensureDir()
  const file = path.join(DATA_DIR, `${key}.json`)
  if (!fs.existsSync(file)) return NextResponse.json({ data: null })

  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ data: null })
  }
}

export async function POST(req: NextRequest) {
  const { key, data } = await req.json()
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })

  ensureDir()
  const file = path.join(DATA_DIR, `${key}.json`)
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  return NextResponse.json({ ok: true })
}
