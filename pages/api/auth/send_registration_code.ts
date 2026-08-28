import type { NextApiRequest, NextApiResponse } from 'next'
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import {
  generate4DigitCode,
  isAdminEmail,
  normalizeEmail,
  sendEmail,
  sendJson,
} from '../../../lib/api-auth'

async function resolveEmailIdentifier(username: string): Promise<string | null> {
  const usersRef = collection(db, 'users')
  const q = query(usersRef, where('username', '==', username))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  return snapshot.docs[0].data().email || null
}

async function checkEmailRegistered(email: string): Promise<boolean> {
  const usersRef = collection(db, 'users')
  const q = query(usersRef, where('email', '==', email.toLowerCase()))
  const snapshot = await getDocs(q)
  return !snapshot.empty
}

const SUBJECT = 'Pulbi Doğrulama Kodu'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Yalnızca POST isteği desteklenir.' })
  }

  const fullName = String(req.body.fullName || '').trim()
  const username = String(req.body.username || '').trim()
  const email = String(req.body.email || '').trim()
  const normalizedEmail = normalizeEmail(email)
  const birthDate = String(req.body.birthDate || '').trim()
  const gender = String(req.body.gender || '').trim()
  const password = String(req.body.password || '')

  if (!fullName || !username || !email || !password) {
    return sendJson(res, 400, { error: 'Lütfen tüm zorunlu alanları doldurun.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return sendJson(res, 400, { error: 'Geçerli bir e-posta adresi girin.' })
  }
  if (password.length < 6) {
    return sendJson(res, 400, { error: 'Şifre en az 6 karakter olmalıdır.' })
  }
  if (username.includes(' ')) {
    return sendJson(res, 400, { error: 'Kullanıcı adı boşluk içeremez.' })
  }

  try {
    const existingUserEmail = await resolveEmailIdentifier(username)
    if (existingUserEmail) {
      return sendJson(res, 400, { error: 'Bu kullanıcı adı zaten kullanılıyor.' })
    }

    const isEmailRegistered = await checkEmailRegistered(normalizedEmail)
    if (isEmailRegistered) {
      return sendJson(res, 400, { error: 'Bu e-posta adresi zaten kayıtlı.' })
    }
  } catch (dbError: any) {
    console.error('[Firebase Firestore Error]:', dbError)
    return sendJson(res, 500, { error: 'Veritabanı bağlantı hatası oluştu.' })
  }

  const code = isAdminEmail(normalizedEmail) ? 'admin' : generate4DigitCode()
  const expiresAt = Date.now() + 15 * 60 * 1000
  const entry = {
    fullName,
    username,
    email: normalizedEmail,
    password,
    birthDate,
    gender,
    expiresAt,
  }

  try {
    await setDoc(doc(db, 'pendingRegistrations', code), entry)
    await setDoc(doc(db, 'pendingRegistrations', normalizedEmail), entry)
  } catch (fsError: any) {
    console.error('[Firestore Pending Registration Error]:', fsError)
    return sendJson(res, 500, { error: 'Kayıt talebi oluşturulamadı.' })
  }

  const text = `Pulbi kayıt doğrulama kodunuz: ${code}\n\nBu kod 15 dakika sonra geçersiz hale gelecektir.`
  const html = `<p>Merhaba ${fullName || 'Pulbi kullanıcısı'},</p><p>Kayıt doğrulama kodunuz <strong>${code}</strong>.</p><p>Bu kod 15 dakika sonra geçersiz hale gelecektir.</p>`

  if (isAdminEmail(normalizedEmail)) {
    return sendJson(res, 200, {
      message: 'Doğrulama e-postası atlandı. Kayıt işlemi doğrudan tamamlanıyor.',
      skipVerification: true,
    })
  }

  try {
    await sendEmail(normalizedEmail, SUBJECT, text, html)
    return sendJson(res, 200, {
      message: 'Doğrulama kodu e-posta adresinize gönderildi. E-posta gelen kutunuzu kontrol edin.',
    })
  } catch (error: any) {
    console.error('[auth/send_registration_code] E-posta Hatası:', error)
    try {
      await deleteDoc(doc(db, 'pendingRegistrations', code))
      await deleteDoc(doc(db, 'pendingRegistrations', normalizedEmail))
    } catch (e) {}
    return sendJson(res, 400, {
      error: error?.message || 'Doğrulama kodu gönderilirken bir hata oluştu.',
    })
  }
}