import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import type { NextApiResponse } from 'next'

export type PendingRegistration = {
  fullName: string
  username: string
  email: string
  password: string
  birthDate: string
  gender: string
  expiresAt: number
}

export const isAdminEmail = (email: string) => email.trim().toLowerCase() === 'admin@gmail.com'

export type ResetEntry = {
  email: string
  oobCode: string
  expiresAt: number
}

const PENDING_REGISTRATION_FILE = path.join(process.cwd(), '.pulbi-pending-registration.json')

export const resetCodeStore = new Map<string, ResetEntry>()
export const pendingRegistrationStore = new Map<string, PendingRegistration>()

export const savePendingRegistrationStore = () => {
  const entries = Object.fromEntries(pendingRegistrationStore.entries())
  fs.writeFileSync(PENDING_REGISTRATION_FILE, JSON.stringify(entries, null, 2), 'utf8')
}

const hydratePendingRegistrationStore = () => {
  try {
    const raw = fs.readFileSync(PENDING_REGISTRATION_FILE, 'utf8')
    if (!raw) {
      pendingRegistrationStore.clear()
      return
    }

    const parsed = JSON.parse(raw) as Record<string, PendingRegistration>
    pendingRegistrationStore.clear()
    for (const [key, value] of Object.entries(parsed)) {
      pendingRegistrationStore.set(key, value)
    }
  } catch {
    pendingRegistrationStore.clear()
  }
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const findPendingRegistration = (code: string, email: string) => {
  hydratePendingRegistrationStore()

  const normalizedCode = String(code || '').trim()
  const normalizedEmail = normalizeEmail(email)

  const byCode = pendingRegistrationStore.get(normalizedCode)
  if (byCode && normalizeEmail(byCode.email) === normalizedEmail) {
    return byCode
  }

  const byEmail = pendingRegistrationStore.get(normalizedEmail)
  if (byEmail && normalizeEmail(byEmail.email) === normalizedEmail) {
    return byEmail
  }

  for (const [key, value] of pendingRegistrationStore.entries()) {
    if (key === normalizedCode && normalizeEmail(value.email) === normalizedEmail) {
      return value
    }

    if (normalizeEmail(value.email) === normalizedEmail) {
      return value
    }
  }

  return null
}

export const deletePendingRegistration = (code: string, email: string) => {
  hydratePendingRegistrationStore()

  const normalizedCode = String(code || '').trim()
  const normalizedEmail = normalizeEmail(email)
  const keysToDelete: string[] = []

  for (const [key, value] of pendingRegistrationStore.entries()) {
    const storedEmail = normalizeEmail(value.email)
    if (key === normalizedCode || key === normalizedEmail || storedEmail === normalizedEmail) {
      keysToDelete.push(key)
    }
  }

  for (const key of keysToDelete) {
    pendingRegistrationStore.delete(key)
  }

  savePendingRegistrationStore()
}

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const SMTP_HOST = process.env.EMAIL_HOST || process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = process.env.EMAIL_PORT || process.env.EMAIL_SMTP_PORT || '465'
const SMTP_USER = process.env.EMAIL_USER || process.env.EMAIL_SMTP_USER
const SMTP_PASS = process.env.EMAIL_PASS || process.env.EMAIL_SMTP_PASS
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || 'pulbiapp@gmail.com'

if (!FIREBASE_API_KEY || !FIREBASE_PROJECT_ID) {
  console.warn(
    '[auth/helpers] Firebase API key and project ID are required for auth API routes.'
  )
}

const createTransport = () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: Number(SMTP_PORT || 465) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  })
}

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  const transporter = createTransport()
  if (!transporter) {
    throw new Error('Gmail SMTP ayarlari eksik. .env.local icinde EMAIL_USER ve EMAIL_PASS tanimlanmali.')
  }

  await transporter.sendMail({
    from: `Pulbi <${EMAIL_FROM}>`,
    to,
    subject,
    text,
    html,
  })
}
export const sendJson = (
  res: NextApiResponse,
  status: number,
  payload: Record<string, unknown>
) => {
  res.status(status).json(payload)
}

export const generate4DigitCode = () => Math.floor(1000 + Math.random() * 9000).toString()

export const buildFirestoreQueryByUsername = (username: string) => ({
  structuredQuery: {
    from: [{ collectionId: 'users' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'username' },
        op: 'EQUAL',
        value: { stringValue: username },
      },
    },
    limit: 1,
  },
})

export const resolveEmailIdentifier = async (identifier: string) => {
  const trimmed = identifier.trim()
  if (!trimmed) return null
  if (trimmed.includes('@')) return trimmed

  if (!FIREBASE_PROJECT_ID) return null

  const queryBody = buildFirestoreQueryByUsername(trimmed)
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'http://localhost:3000',
      },
      body: JSON.stringify(queryBody),
    }
  )

  if (!response.ok) {
    console.warn('[auth/helpers] Firestore query failed for username resolution.', {
      status: response.status,
      statusText: response.statusText,
    })
    return null
  }

  const results = await response.json()
  if (!Array.isArray(results) || results.length === 0) return null

  const firstDoc = results[0]?.document
  const email = firstDoc?.fields?.email?.stringValue
  return typeof email === 'string' && email ? email : null
}

export const sendFirebasePasswordResetCode = async (email: string) => {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase API anahtarı yapılandırılmamış.')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': 'http://localhost:3000',
      },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    }
  )

  const json = await response.json()
  if (!response.ok || !json.oobCode) {
    const errorMessage = json?.error?.message || 'Şifre sıfırlama kodu oluşturulamadı.'
    throw new Error(errorMessage)
  }

  return { oobCode: json.oobCode as string }
}

export const confirmPasswordResetWithOobCode = async (oobCode: string, newPassword: string) => {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase API anahtarı yapılandırılmamış.')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': 'http://localhost:3000',
      },
      body: JSON.stringify({ oobCode, newPassword }),
    }
  )

  const json = await response.json()
  if (!response.ok) {
    const errorMessage = json?.error?.message || 'Şifre sıfırlama doğrulanamadı.'
    throw new Error(errorMessage)
  }

  return json
}

export const createFirebaseUser = async (email: string, password: string) => {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase API anahtarı yapılandırılmamış.')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': 'http://localhost:3000',
      },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  )

  const json = await response.json()
  if (!response.ok) {
    const errorMessage = json?.error?.message || 'Kullanıcı oluşturulamadı.'
    throw new Error(errorMessage)
  }

  return json
}

export const writeFirestoreUserDoc = async (
  userId: string,
  userData: {
    fullName: string
    username: string
    email: string
    birthDate: string
    gender: string
    source?: string
  }
) => {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error('Firebase proje kimliği yapılandırılmamış.')
  }

  const timestamp = new Date().toISOString()
  const source = userData.source || 'email_signup'

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users?documentId=${userId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'http://localhost:3000',
      },
      body: JSON.stringify({
        fields: {
          uid: { stringValue: userId },
          fullName: { stringValue: String(userData.fullName || '') },
          username: { stringValue: String(userData.username || '') },
          email: { stringValue: String(userData.email || '') },
          birthDate: { stringValue: String(userData.birthDate || '') },
          gender: { stringValue: String(userData.gender || '') },
          consents: {
            mapValue: {
              fields: {
                terms: {
                  mapValue: {
                    fields: {
                      agreed: { booleanValue: true },
                      at: { timestampValue: timestamp },
                      source: { stringValue: source },
                    },
                  },
                },
                kvkk: {
                  mapValue: {
                    fields: {
                      agreed: { booleanValue: true },
                      at: { timestampValue: timestamp },
                      source: { stringValue: source },
                    },
                  },
                },
              },
            },
          },
          createdAt: { timestampValue: timestamp },
          updatedAt: { timestampValue: timestamp },
        },
      }),
    }
  )

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.error?.message || 'Firestore kullanıcı kaydı oluşturulamadı.')
  }

  return json
}

export const checkEmailRegistered = async (email: string) => {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase API anahtarı yapılandırılmamış.')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': 'http://localhost:3000',
      },
      body: JSON.stringify({ identifier: email, continueUri: 'http://localhost' }),
    }
  )

  const json = await response.json()
  if (!response.ok) {
    const errorMessage = json?.error?.message || 'E-posta kontrolü yapılamadı.'
    throw new Error(errorMessage)
  }

  return Boolean(json.registered)
}

export const cleanupExpiredEntries = (resetMap: Map<string, ResetEntry>, registrationMap: Map<string, PendingRegistration>) => {
  const now = Date.now()
  for (const [key, value] of resetMap.entries()) {
    if (value.expiresAt <= now) resetMap.delete(key)
  }
  for (const [key, value] of registrationMap.entries()) {
    if (value.expiresAt <= now) registrationMap.delete(key)
  }
}