'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type PhoneInputProps = {
  value: string
  onChange: (value: string) => void
  countryCode?: string
  countryFlag?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

export function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ].filter(Boolean)
  return parts.join(' ')
}

export function toE164Phone(digits: string, countryCode = '90') {
  const normalized = digits.replace(/\D/g, '')
  return `+${countryCode}${normalized}`
}

export function isValidLocalPhone(value: string) {
  return value.replace(/\D/g, '').length >= 10
}

export function PhoneInput({
  value,
  onChange,
  countryCode = '+90',
  countryFlag = '🇹🇷',
  placeholder = '5XX XXX XX XX',
  disabled = false,
  autoFocus = false,
  className,
}: PhoneInputProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3.5 py-4 text-sm font-medium disabled:opacity-50"
      >
        <span className="text-base">{countryFlag}</span>
        {countryCode}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(formatPhoneNumber(e.target.value))}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-border bg-card px-4 py-4 text-sm tracking-wide outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/60 focus:ring-4 focus:ring-primary/15 disabled:opacity-50"
      />
    </div>
  )
}
