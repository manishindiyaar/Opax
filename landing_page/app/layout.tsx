import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Opax Machine — Private Clinical Intelligence',
  description: 'Local-first AI system for healthcare. Connect internal tools and execute real clinical workflows using natural language — without sending patient data to the cloud.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
