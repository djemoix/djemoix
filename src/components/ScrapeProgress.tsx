'use client'

import { Loader2 } from 'lucide-react'

interface Props {
  message: string
  subtext?: string
}

export default function ScrapeProgress({ message, subtext }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-full border-2 border-slate-700 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
      </div>
      <p className="text-white font-semibold text-lg">{message}</p>
      {subtext && <p className="text-slate-500 text-sm mt-1">{subtext}</p>}
    </div>
  )
}
