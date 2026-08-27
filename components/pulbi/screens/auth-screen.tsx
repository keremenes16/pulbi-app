'use client'

import { useState } from 'react'
import { ArrowRight, ShieldCheck, Mail } from 'lucide-react'
import { LegalDocModal } from '@/components/pulbi/legal-doc-modal'
import { PulbiMark } from '@/components/pulbi/logo'
import { useTranslations } from '@/lib/i18n'
import { legalDocuments, type LegalDocKey } from '@/lib/legal-docs'

export function AuthScreen({ onDone }: { onDone: () => void }) {
  const t = useTranslations()
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [kvkkAgreed, setKvkkAgreed] = useState(false)
  const [birthDate, setBirthDate] = useState('')
  const [ageError, setAgeError] = useState<string | null>(null)
  const [showLegalModal, setShowLegalModal] = useState(false)
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocKey | null>(null)
  const [loading, setLoading] = useState(false)

  function calculateAge(value: string) {
    if (!value) return null
    const birth = new Date(value)
    if (Number.isNaN(birth.getTime())) return null

    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1
    }
    return age
  }

  // E-posta veya diğer giriş akışına geçiş fonksiyonu
  async function handleContinue() {
    const age = calculateAge(birthDate)
    if (!birthDate || age === null || age < 18) {
      setAgeError(t('ageErrorTooYoung'))
      return
    }

    if (!termsAgreed || !kvkkAgreed) {
      setAgeError(t('ageErrorMissingConsent'))
      return
    }

    setAgeError(null)
    setLoading(true)

    // Burada e-posta kayıt/giriş ekranına yönlendirme yapabilirsin
    setTimeout(() => {
      setLoading(false)
      onDone()
    }, 500)
  }

  const age = calculateAge(birthDate)
  const canContinue = termsAgreed && kvkkAgreed && birthDate && age !== null && age >= 18 && !loading

  return (
    <div className="flex h-full flex-col bg-background px-7 pb-10 pt-16">
      <PulbiMark className="h-14 w-14" />

      <div className="mt-10 flex flex-1 flex-col">
        <h1 className="text-balance text-3xl font-semibold tracking-tight">
          {t('loginWelcomeTitle')}
        </h1>
        <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
          {t('loginWelcomeSubtitle')}
        </p>

        <div className="mt-5">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('birthDateLabel')}
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => {
              setBirthDate(e.target.value)
              if (ageError) setAgeError(null)
            }}
            className="w-full rounded-2xl border border-border bg-card px-4 py-4 text-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/15"
          />
        </div>

        <div className="mt-6 space-y-4">
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-amber" />
            {t('privacyProtected')}
          </p>

          <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">{t('requiredApprovals')}</p>
            <label className="mt-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border border-border bg-card"
              />
              <span className="text-xs leading-5 text-muted-foreground">
                <button
                  type="button"
                  className="font-semibold text-primary underline decoration-primary/50 underline-offset-2"
                  onClick={() => {
                    setActiveLegalDoc('terms')
                    setShowLegalModal(true)
                  }}
                >
                  {t('termsLinkText')}
                </button>
                {' '}{t('readAndAgreeSuffix')}
              </span>
            </label>

            <label className="mt-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={kvkkAgreed}
                onChange={(e) => setKvkkAgreed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border border-border bg-card"
              />
              <span className="text-xs leading-5 text-muted-foreground">
                <button
                  type="button"
                  className="font-semibold text-primary underline decoration-primary/50 underline-offset-2"
                  onClick={() => {
                    setActiveLegalDoc('kvkk')
                    setShowLegalModal(true)
                  }}
                >
                  {t('kvkkLinkText')}
                </button>
                {' '}{t('readAndAgreeSuffix2')}
              </span>
            </label>
          </div>

          {ageError ? <p className="text-center text-xs text-red-500">{ageError}</p> : null}

          <button
            type="button"
            disabled={!canContinue}
            onClick={handleContinue}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-8px_var(--color-primary)] transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            {loading ? 'İşleniyor...' : 'E-posta ile Devam Et'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {activeLegalDoc ? (
        <LegalDocModal
          open={showLegalModal}
          title={legalDocuments[activeLegalDoc].title}
          content={legalDocuments[activeLegalDoc].content}
          onClose={() => {
            setShowLegalModal(false)
            setActiveLegalDoc(null)
          }}
        />
      ) : null}
    </div>
  )
}