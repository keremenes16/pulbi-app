import type { NextApiRequest, NextApiResponse } from 'next'
import {
  cleanupExpiredEntries,
  generate4DigitCode,
  resolveEmailIdentifier,
  sendEmail,
  sendFirebasePasswordResetCode,
  sendJson,
  resetCodeStore,
} from '../../../lib/api-auth'

const SUBJECT = 'Pulbi Şifre Sıfırlama Kodu'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Yalnızca POST isteği desteklenir.' })
  }

  cleanupExpiredEntries(resetCodeStore, new Map())

  const identifier = String(req.body.identifier || '').trim()
  if (!identifier) {
    return sendJson(res, 400, { error: 'Lütfen e-posta adresinizi veya kullanıcı adınızı girin.' })
  }

  try {
    const targetEmail = await resolveEmailIdentifier(identifier)
    if (!targetEmail) {
      return sendJson(res, 404, { error: 'Bu e-posta veya kullanıcı adına ait bir hesap bulunamadı.' })
    }

    const { oobCode } = await sendFirebasePasswordResetCode(targetEmail)
    const code = generate4DigitCode()
    const expiresAt = Date.now() + 15 * 60 * 1000

    resetCodeStore.set(code, { email: targetEmail, oobCode, expiresAt })

    const text = `Pulbi şifre sıfırlama kodunuz: ${code}\n\nBu kod 15 dakika sonra geçersiz hale gelecektir.`
    const html = `<p>Merhaba,</p><p>Pulbi şifre sıfırlama kodunuz <strong>${code}</strong>.</p><p>Bu kod 15 dakika sonra geçersiz hale gelecektir.</p>`
    await sendEmail(targetEmail, SUBJECT, text, html)

    return sendJson(res, 200, {
      message: 'Şifre sıfırlama kodu e-posta adresine gönderildi. Lütfen gelen kutunuzu kontrol edin.',
    })
  } catch (error: any) {
    console.error('[auth/send-reset-code] Hata:', error)
    const message =
      error?.message === 'EMAIL_NOT_FOUND'
        ? 'Bu e-posta adresine ait bir hesap bulunamadı.'
        : error?.message || 'Şifre sıfırlama kodu gönderilirken bir hata oluştu.'
    return sendJson(res, 400, { error: message })
  }
}
