import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Content Dashboard',
  description: 'Instagram analytics and content strategy dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
