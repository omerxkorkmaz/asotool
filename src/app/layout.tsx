import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ASO Tool',
  description: 'Google Play ASO dashboard — keyword tracking, competitor analysis, bulk scan',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
