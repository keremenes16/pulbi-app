'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type OtpInputProps = {
  length?: number
  value: string[]
  onChange: (value: string[]) => void
  onComplete?: (code: string) => void
  disabled?: boolean
  className?: string
}

export function createEmptyOtp(length: number) {
  return Array.from({ length }, () => '')
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  className,
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  function handleChange(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    const next = [...value]
    next[index] = digit
    onChange(next)

    if (digit && index < length - 1) {
      inputsRef.current[index + 1]?.focus()
    }

    if (next.every(Boolean)) {
      onComplete?.(next.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length)

    if (!pasted) return

    const next = createEmptyOtp(length)
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]
    }
    onChange(next)

    const focusIndex = Math.min(pasted.length, length - 1)
    inputsRef.current[focusIndex]?.focus()

    if (pasted.length === length) {
      onComplete?.(pasted)
    }
  }

  return (
    <div className={cn('flex justify-between gap-2 sm:gap-3', className)}>
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el
          }}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={cn(
            'h-14 w-full rounded-2xl border bg-card text-center text-xl font-semibold outline-none transition sm:h-16 sm:text-2xl',
            digit
              ? 'border-primary/60 text-glow-violet'
              : 'border-border',
            'focus:border-primary/60 focus:ring-4 focus:ring-primary/15 disabled:opacity-50',
          )}
        />
      ))}
    </div>
  )
}
