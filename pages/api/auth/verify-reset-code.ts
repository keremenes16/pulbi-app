import type { NextApiRequest, NextApiResponse } from 'next'
import {
  cleanupExpiredEntries,
  confirmPasswordResetWithOobCode,
  resetCodeStore,
  sendJson,
} from '../../../lib/api-auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Yalnızca POST isteği desteklenir.' })
  }

  cleanupExpiredEntries(resetCodeStore, new Map())

  const code = String(req.body.code || '').trim()
  const newPassword = String(req.body.password || '')

  if (!code) {
    return sendJson(res, 400, { error: 'Lütfen şifre sıfırlama kodunu girin.' })
  }
  if (newPassword.length < 6) {
    return sendJson(res, 400, { error: 'Yeni şifre en az 6 karakter olmalıdır.' })
  }

  const entry = resetCodeStore.get(code)
  if (!entry || entry.expiresAt <= Date.now()) {
    return sendJson(res, 400, { error: 'Kod geçersiz veya süresi dolmuş. Lütfen yeni bir kod isteyin.' })
  }

  try {
    await confirmPasswordResetWithOobCode(entry.oobCode, newPassword)
    resetCodeStore.delete(code)
    return sendJson(res, 200, { message: 'Şifreniz başarıyla güncellendi.' })
  } catch (error: any) {
    console.error('[auth/verify-reset-code] Hata:', error)
    const message =
      error?.message === 'EXPIRED_OOB_CODE' ||
      error?.message === 'INVALID_OOB_CODE' ||
      error?.message === 'INVALID_CODE'
        ? 'Kod geçersiz veya süresi dolmuş. Yeni bir şifre sıfırlama isteği gönderin.'
        : error?.message || 'Şifre sıfırlama doğrulanamadı.'
    return sendJson(res, 400, { error: message })
  }
}
