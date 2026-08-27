'use client'

import { useLanguage, localeNames, supportedLocales } from '@/lib/i18n'
import { Globe } from 'lucide-react'

export function LanguageSelector() {
  const { locale, setLocale } = useLanguage()

  return (
    <div className="pointer-events-auto">
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/95 px-2.5 py-2 shadow-xl backdrop-blur-xl transition hover:border-border hover:bg-card/98 sm:px-3">
        <Globe className="h-3.5 w-3.5 text-primary shrink-0" />
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as typeof locale)}
          className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer sm:text-sm"
          aria-label="Dil seçimi"
        >
          {supportedLocales.map((localeOption) => (
            <option key={localeOption} value={localeOption}>
              {localeNames[localeOption]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
