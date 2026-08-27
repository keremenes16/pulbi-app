import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { LanguageSelector } from '@/components/pulbi/language-selector'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pulbi — Yollarınızın kesiştiği an',
  description:
    'Pulbi, sonsuz kaydırma yerine gerçek dünyadaki karşılaşmalara dayanan bir sosyal keşif uygulaması.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0B0F19',
  userScalable: false,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" className={`dark ${inter.variable} bg-background`}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <div className="fixed right-3 top-3 z-50 pointer-events-auto max-w-xs">
            <LanguageSelector />
          </div>
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
