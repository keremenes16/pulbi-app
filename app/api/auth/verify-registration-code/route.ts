import { NextResponse } from 'next/server'
import {
  createFirebaseUser,
  deletePendingRegistration,
  findPendingRegistration,
  normalizeEmail,
  pendingRegistrationStore,
  writeFirestoreUserDoc,
} from '../../../../lib/api-auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim()
    const normalizedEmail = normalizeEmail(email)
    const code = String(body.code || '').trim()
    const password = String(body.password || '')

    if (!normalizedEmail || !code || !password) {
      return NextResponse.json({ error: 'Lütfen e-posta, şifre ve doğrulama kodunu girin.' }, { status: 400 })
    }

    const pendingEntry = findPendingRegistration(code, normalizedEmail)

    if (!pendingEntry) {
      return NextResponse.json({ error: 'Kod geçersiz veya süresi dolmuş. Lütfen yeniden kayıt isteyin.' }, { status: 400 })
    }

    if (normalizeEmail(pendingEntry.email) !== normalizedEmail) {
      return NextResponse.json({ error: 'E-posta adresi ile doğrulama kodu eşleşmiyor.' }, { status: 400 })
    }

    if (Date.now() > pendingEntry.expiresAt) {
      deletePendingRegistration(code, pendingEntry.email)
      return NextResponse.json({ error: 'Doğrulama kodunun süresi dolmuş. Lütfen yeniden kayıt isteyin.' }, { status: 400 })
    }

    if (String(pendingEntry.password || '').trim() !== String(password || '').trim()) {
      return NextResponse.json({ error: 'Girilen şifre doğrulama sırasında eşleşmiyor.' }, { status: 400 })
    }
    const authResult = await createFirebaseUser(pendingEntry.email, pendingEntry.password)

    try {
      await writeFirestoreUserDoc(authResult.localId, {
        fullName: pendingEntry.fullName,
        username: pendingEntry.username,
        email: pendingEntry.email,
        birthDate: pendingEntry.birthDate,
        gender: pendingEntry.gender,
        source: 'email_signup',
      })
    } catch (firestoreError: any) {
      console.warn('[auth/verify-registration-code] Firestore kaydı oluşturulamadı:', firestoreError)
    }

    deletePendingRegistration(code, pendingEntry.email)

    return NextResponse.json(
      {
        message: 'Kayıt işleminiz tamamlandı. Giriş sayfasına yönlendiriliyorsunuz.',
        userId: authResult.localId,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[auth/verify-registration-code] Hata:', error)
    const errorMessage =
      error?.message === 'EMAIL_EXISTS'
        ? 'Bu e-posta adresi zaten kayıtlı.'
        : error?.message || 'Kullanıcı oluşturulurken bir hata oluştu.'
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }
}
