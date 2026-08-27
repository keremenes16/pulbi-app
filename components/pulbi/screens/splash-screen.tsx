'use client'

import { ArrowRight } from 'lucide-react'
import { PulbiMark, PulbiWordmark } from '@/components/pulbi/logo'
import { useTranslations } from '@/lib/i18n'

export function SplashScreen({
  step,
  onNext,
  onStart,
}: {
  step: number
  onNext: () => void
  onStart: () => void
}) {
  const t = useTranslations()
  const isIntro = step === 0
  const steps = [
    {
      title: t('splashStepOneTitle'),
      body: t('splashStepOneBody'),
    },
    {
      title: t('splashStepTwoTitle'),
      body: t('splashStepTwoBody'),
    },
    {
      title: t('splashStepThreeTitle'),
      body: t('splashStepThreeBody'),
    },
  ]

  return (
    <div className="flex h-full flex-col bg-background px-7 pb-10 pt-16">
      {isIntro ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="animate-breathe">
            <PulbiMark className="h-28 w-28" />
          </div>
          <PulbiWordmark className="mt-8 text-4xl text-glow-violet" />
          <p className="mt-6 max-w-[16rem] text-balance text-sm leading-relaxed text-muted-foreground animate-rise">
            {t('splashIntro')}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center">
          <div className="animate-drift">
            <PulbiMark className="h-16 w-16" />
          </div>
          <h1
            key={step}
            className="mt-10 text-balance text-3xl font-semibold leading-tight tracking-tight animate-rise"
          >
            {steps[step].title}
          </h1>
          <p
            key={`b-${step}`}
            className="mt-4 max-w-[18rem] text-pretty text-sm leading-relaxed text-muted-foreground animate-rise"
          >
            {steps[step].body}
          </p>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
            }`}
          />
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={step >= steps.length - 1 ? onStart : onNext}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-8px_var(--color-primary)] transition active:scale-[0.98]"
        >
          {step >= steps.length - 1 ? t('splashStart') : t('splashContinue')}
          <ArrowRight className="h-4 w-4" />
        </button>
        {step < steps.length - 1 && (
          <button
            type="button"
            onClick={onStart}
            className="w-full py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            {t('splashSkip')}
          </button>
        )}
      </div>
    </div>
  )
}
