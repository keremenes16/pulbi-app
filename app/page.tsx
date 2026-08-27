'use client'

import { useEffect, useRef, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { PulbiApp } from '@/components/pulbi/pulbi-app'
import { PulbiMark } from '@/components/pulbi/logo'
import { ArrowLeft, Sparkles, Mail, UserPlus, LogIn } from 'lucide-react'
import { LegalDocModal } from '@/components/pulbi/legal-doc-modal'
import { legalDocuments, type LegalDocKey } from '@/lib/legal-docs'

export default function Page() {
  const [showSplash, setShowSplash] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authStatusText, setAuthStatusText] = useState<string | null>(null)

  const [flowStep, setFlowStep] = useState<
    | 'welcome'
    | 'onboarding'
    | 'authMethodSelection'
    | 'socialCompleteProfile'
    | 'login'
    | 'register'
    | 'forgot'
    | 'reset'
    | 'verifyRegister'
    | 'app'
  >('welcome')

  const [authIntent, setAuthIntent] = useState<'signup' | 'signin'>('signup')

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1)

  // Kayıt formu alanları (Manuel)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('Erkek')

  // Yasal Sözleşme ve 18 Yaş State'leri
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [kvkkAgreed, setKvkkAgreed] = useState(false)
  const [showLegalModal, setShowLegalModal] = useState(false)
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocKey | null>(null)

  // Geçici sosyal kullanıcı verisi
  const [pendingSocialUser, setPendingSocialUser] = useState<User | null>(null)

  // Giriş yap alanları
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [forgotIdentifier, setForgotIdentifier] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [resetNewPassword, setResetNewPassword] = useState('')
  const [resetConfirmPassword, setResetConfirmPassword] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [pendingRegistration, setPendingRegistration] = useState<
    | {
        fullName: string
        username: string
        email: string
        password: string
        birthDate: string
        gender: string
      }
    | null
  >(null)
  const [registrationError, setRegistrationError] = useState<string | null>(null)
  const [registrationMessage, setRegistrationMessage] = useState<string | null>(null)
  const processingAuthUidRef = useRef<string | null>(null)

  const resolveAuthenticatedUser = async (nextUser: User, source: string) => {
    console.log('[auth] resolveAuthenticatedUser start', {
      source,
      uid: nextUser?.uid,
      email: nextUser?.email,
      flowStep,
      authIntent,
    })

    if (processingAuthUidRef.current === nextUser.uid) {
      return
    }
    processingAuthUidRef.current = nextUser.uid

    try {
      const userRef = doc(db, 'users', nextUser.uid)
      const userSnap = await getDoc(userRef)

      if (userSnap.exists()) {
        setPendingSocialUser(null)
        setUser(nextUser)
        setError(null)
        setAuthStatusText(null)
        setLoading(false)
        setFlowStep('app')
        return
      }

      setPendingSocialUser(nextUser)
      setUser(null)
      setError(null)
      setAuthStatusText(null)
      setLoading(false)
      setFlowStep('socialCompleteProfile')
    } catch (err: any) {
      console.error('[auth] Kullanıcı çözümleme hatası:', err)
      setUser(nextUser)
      setPendingSocialUser(null)
      setError(err.message || 'Kimlik doğrulama sırasında hata oluştu.')
      setLoading(false)
      setAuthStatusText(null)
      setFlowStep('app')
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
      const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding')
      if (!hasSeenOnboarding) {
        setFlowStep('onboarding')
      }
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const isAuthFlowStep =
      flowStep === 'login' ||
      flowStep === 'register' ||
      flowStep === 'forgot' ||
      flowStep === 'reset' ||
      flowStep === 'verifyRegister' ||
      flowStep === 'authMethodSelection' ||
      flowStep === 'socialCompleteProfile' ||
      flowStep === 'onboarding'

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        processingAuthUidRef.current = null
        setUser(null)
        if (!isAuthFlowStep) {
          setFlowStep('welcome')
        }
        setCheckingAuth(false)
        return
      }

      await resolveAuthenticatedUser(nextUser, 'state')
      setCheckingAuth(false)
    })
    return () => unsubscribe()
  }, [flowStep, authStatusText, authIntent])

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

  async function parseJsonResponse(response: Response) {
    const contentType = response.headers.get('content-type') || ''
    const rawText = await response.text()

    if (!rawText) return {}

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(rawText)
      } catch {
        throw new Error('Sunucudan geçersiz JSON yanıtı geldi.')
      }
    }

    const cleanMessage = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    throw new Error(cleanMessage || 'Sunucu yanıtı beklenenden farklı geldi.')
  }

  // SOSYAL GİRİŞ SONRASI PROFİL VE KVKK TAMAMLAMA
  const handleCompleteSocialProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedUsername = username.trim()
    const trimmedFullName = fullName.trim()

    if (!trimmedUsername || !trimmedFullName || !birthDate) {
      setError('Lütfen kullanıcı adı, ad soyad ve doğum tarihi alanlarını doldurun.')
      return
    }

    const age = calculateAge(birthDate)
    if (age === null || age < 18) {
      setError('Üzgünüz, 18 yaşından küçük kullanıcılar kayıt olamaz.')
      return
    }

    if (!termsAgreed || !kvkkAgreed) {
      setError('Lütfen kullanıcı sözleşmesini ve KVKK aydınlatma metnini onaylayın.')
      return
    }

    if (!pendingSocialUser) {
      setError('Kullanıcı oturumu bulunamadı. Lütfen tekrar deneyin.')
      return
    }

    setLoading(true)
    setAuthStatusText('Hesabınız oluşturuluyor...')

    try {
      const q = query(collection(db, 'users'), where('username', '==', trimmedUsername))
      const querySnapshot = await getDocs(q)
      if (!querySnapshot.empty) {
        setError('Bu kullanıcı adı zaten alınmış. Lütfen başka bir tane seçin.')
        setLoading(false)
        setAuthStatusText(null)
        return
      }

      const userRef = doc(db, 'users', pendingSocialUser.uid)
      await setDoc(userRef, {
        uid: pendingSocialUser.uid,
        email: pendingSocialUser.email || email,
        fullName: trimmedFullName,
        username: trimmedUsername,
        birthDate,
        gender,
        consents: {
          terms: { agreed: true, at: serverTimestamp(), source: 'google_signup' },
          kvkk: { agreed: true, at: serverTimestamp(), source: 'google_signup' },
        },
        createdAt: serverTimestamp(),
      })

      setAuthStatusText('Kayıt tamamlandı! Yönlendiriliyorsun...')
      await new Promise((resolve) => setTimeout(resolve, 1200))

      setUser(pendingSocialUser)
      setAuthStatusText(null)
      setFlowStep('app')
    } catch (err: any) {
      setError(err.message || 'Kayıt sırasında bir hata oluştu.')
      setAuthStatusText(null)
    } finally {
      setLoading(false)
    }
  }
 
  // MANUEL KAYIT OL İŞLEMİ
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const q = query(collection(db, 'users'), where('username', '==', username.trim()))
      const querySnapshot = await getDocs(q)
      
      if (!querySnapshot.empty) {
        setError('Bu kullanıcı adı zaten alınmış. Lütfen başka bir tane oluşturun.')
        setLoading(false)
        return
      }
    } catch {
      setError('Kullanıcı adı kontrol edilirken hata oluştu.')
      setLoading(false)
      return
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{6,}$/

    if (!passwordRegex.test(password)) {
      setError('Şifre en az 6 karakter olmalı, en az bir büyük harf ve bir rakam içermelidir.')
      setLoading(false)
      return
    }

    if (password !== passwordConfirm) {
      setError('Şifreler birbiriyle eşleşmiyor.')
      setLoading(false)
      return
    }

    if (!termsAgreed || !kvkkAgreed) {
      setError('Lütfen yasal onayları kabul edin.')
      setLoading(false)
      return
    }

    setAuthStatusText('Doğrulama kodu gönderiliyor...')

    try {
      const response = await fetch('/api/auth/send_registration_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password,
          birthDate,
          gender,
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) throw new Error(result.error || 'Kayıt doğrulama kodu gönderilemedi.')

      setPendingRegistration({
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        birthDate,
        gender,
      })
      setRegistrationMessage('E-posta adresinize gelen doğrulama kodunu girin.')
      setFlowStep('verifyRegister')
    } catch (err: any) {
      setError(err.message || 'Kayıt sırasında bir hata oluştu.')
    } finally {
      setAuthStatusText(null)
      setLoading(false)
    }
  }

  // MANUEL GİRİŞ YAP İŞLEMİ (Gmail yazılsa bile artık Google sayfasına ATMAZ, doğrudan e-posta ve şifreyle giriş yapar)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setAuthStatusText('Giriş yapılıyor...')

    try {
      let targetEmail = loginIdentifier.trim()

      if (!targetEmail.includes('@')) {
        const q = query(collection(db, 'users'), where('username', '==', targetEmail))
        const querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          setError('Bu kullanıcı adıyla kayıtlı bir hesap bulunamadı.')
          setLoading(false)
          setAuthStatusText(null)
          return
        }

        targetEmail = querySnapshot.docs[0].data().email
      }

      setAuthIntent('signin')
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, loginPassword)
      setAuthStatusText('Hoş geldin! Yönlendiriliyorsun...')
      await new Promise((resolve) => setTimeout(resolve, 1500))

      setUser(userCredential.user)
      setAuthStatusText(null)
      setFlowStep('app')
    } catch {
      const currentUser = auth.currentUser
      if (currentUser) {
        await Promise.all([
          deleteDoc(doc(db, 'active_sparks', currentUser.uid)).catch(() => {}),
          updateDoc(doc(db, 'users', currentUser.uid), {
            locationEnabled: false,
            lastSeen: serverTimestamp(),
          }).catch(() => {}),
        ])
      }

      await signOut(auth).catch(() => {})
      setError('E-posta/Kullanıcı adı veya şifre yanlış.')
      setUser(null)
      setAuthStatusText(null)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setRegistrationError(null)
    setLoading(true)
    setAuthStatusText('Doğrulama kodu kontrol ediliyor...')

    try {
      if (!pendingRegistration) {
        setRegistrationError('Doğrulama verisi bulunamadı.')
        return
      }

      const response = await fetch('/api/auth/verify-registration-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: registrationCode.trim(),
          ...pendingRegistration,
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        setRegistrationError(result.error || 'Doğrulama başarısız.')
        return
      }

      const userId = String(result.userId || '')
      if (!userId) {
        throw new Error('Kullanıcı kimliği doğrulama sonrası alınamadı.')
      }

      const finalEmail = pendingRegistration.email.trim().toLowerCase()
      const loginUser = await signInWithEmailAndPassword(auth, finalEmail, pendingRegistration.password)

      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        email: finalEmail,
        fullName: pendingRegistration.fullName,
        username: pendingRegistration.username,
        birthDate: pendingRegistration.birthDate,
        gender: pendingRegistration.gender,
        consents: {
          terms: { agreed: true, at: serverTimestamp(), source: 'email_signup' },
          kvkk: { agreed: true, at: serverTimestamp(), source: 'email_signup' },
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setUser(loginUser.user)
      setAuthIntent('signin')
      setAuthStatusText('Hesabın oluşturuldu. Giriş ekranına yönlendiriliyorsun...')
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setFlowStep('app')
    } catch (err: any) {
      setRegistrationError(err.message || 'Hata oluştu.')
    } finally {
      setAuthStatusText(null)
      setLoading(false)
    }
  }

  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setAuthStatusText('Sıfırlama kodu gönderiliyor...')

    try {
      const response = await fetch('/api/auth/send-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        setError(result.error || 'Kod gönderilemedi.')
        return
      }

      setFlowStep('reset')
    } catch (err: any) {
      setError(err.message || 'Hata oluştu.')
    } finally {
      setAuthStatusText(null)
      setLoading(false)
    }
  }

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (resetNewPassword !== resetConfirmPassword) {
        setError('Şifreler eşleşmiyor.')
        setLoading(false)
        return
      }

      const response = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: resetCode.trim(), password: resetNewPassword }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        setError(result.error || 'Şifre güncellenemedi.')
        setLoading(false)
        return
      }

      setFlowStep('login')
    } catch (err: any) {
      setError(err.message || 'Hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth && showSplash) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-0 sm:p-6">
        <div className="relative flex h-dvh w-full flex-col items-center justify-center overflow-hidden bg-background sm:h-[860px] sm:max-h-[92vh] sm:w-[400px] sm:rounded-[3rem] sm:border sm:border-border sm:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
          <div className="relative flex flex-col items-center justify-center animate-fade-in">
            <div className="absolute -inset-6 rounded-full bg-primary/20 blur-2xl animate-pulse" />
            <div className="relative flex items-center justify-center p-6 rounded-3xl bg-background/40 border border-white/10 shadow-2xl backdrop-blur-xl">
              <PulbiMark className="h-20 w-20 animate-bounce"/>
            </div>
            <h1 className="mt-6 text-4xl font-normal tracking-wide text-foreground">Pulbi</h1>
            <p className="mt-2 text-xs tracking-widest text-muted-foreground uppercase">Yollarınızın Kesiştiği An</p>
          </div>
        </div>
      </main>
    )
  }

  const effectiveUser = user ?? auth.currentUser ?? null
  if (effectiveUser && !authStatusText) {
    return <PulbiApp initialPhase="app"/>
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-0 sm:p-6">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-background sm:h-[860px] sm:max-h-[92vh] sm:w-[400px] sm:rounded-[3rem] sm:border sm:border-border sm:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
        <div className="pointer-events-none absolute left-1/2 top-2 z-30 hidden h-6 w-32 -translate-x-1/2 rounded-full bg-background sm:block" />

        {authStatusText ? (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md px-6 text-center">
            <div className="relative flex items-center justify-center p-6 rounded-3xl bg-primary/10 border border-primary/20 shadow-2xl mb-6">
              <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-primary animate-bounce"/>
              <div className="animate-spin" style={{ animationDuration: '3s' }}>
                <PulbiMark className="h-16 w-16"/>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-4">{authStatusText}</h2>
            
            <button
              type="button"
              onClick={() => {
                setLoading(false)
                setAuthStatusText(null)
                setError('Giriş işlemi iptal edildi.')
              }}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-secondary transition"
            >
              Vazgeç / İptal Et
            </button>
          </div>
        ) : null}

        <div className="flex h-full flex-col bg-background px-7 pb-8 pt-12 overflow-y-auto">
          <div className="flex items-center justify-between">
            <PulbiMark className="h-12 w-12"/>
            {flowStep === 'onboarding' && (
              <button
                onClick={() => {
                  localStorage.setItem('hasSeenOnboarding', 'true')
                  setFlowStep('welcome')
                  setOnboardingStep(1)
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Atla
              </button>
            )}
            {flowStep !== 'welcome' && flowStep !== 'onboarding' && flowStep !== 'socialCompleteProfile' && (
              <button
                onClick={() => {
                  if (flowStep === 'authMethodSelection') {
                    setFlowStep('welcome')
                  } else if (flowStep === 'register' || flowStep === 'login') {
                    setFlowStep('authMethodSelection')
                  } else {
                    setFlowStep('welcome')
                  }
                  setError(null)
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5"/> Geri Dön
              </button>
            )}
          </div>

          <div className="mt-8 flex flex-1 flex-col">
            {flowStep === 'onboarding' && (
              <div className="flex flex-col flex-1 justify-between">
                <div className="flex-1 flex flex-col justify-center">
                  {onboardingStep === 1 && (
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-8 relative">
                        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                          <div className="w-20 h-20 rounded-full bg-primary/40 flex items-center justify-center animate-pulse">
                            <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="8" strokeWidth="2" />
                              <circle cx="12" cy="12" r="5" strokeWidth="2" />
                              <circle cx="12" cy="12" r="2" strokeWidth="2" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <h2 className="text-2xl font-semibold text-foreground mb-3">Radar</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Canlı radar ekranı ile çevrendeki kişileri ve hareketliliği anında keşfet.
                      </p>
                    </div>
                  )}

                  {onboardingStep === 2 && (
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-8 relative">
                        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                          <div className="w-20 h-20 rounded-full bg-primary/40 flex items-center justify-center">
                            <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeWidth="2" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <h2 className="text-2xl font-semibold text-foreground mb-3">Kesişme</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Yollarının kesiştiği insanlarla tanış, anı yakala.
                      </p>
                    </div>
                  )}

                  {onboardingStep === 3 && (
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-8 relative">
                        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                          <div className="w-20 h-20 rounded-full bg-primary/40 flex items-center justify-center">
                            <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeWidth="2" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <h2 className="text-2xl font-semibold text-foreground mb-3">Kapsül</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Kendi dijital kapsülünü bırak ve anıları ölümsüzleştir. Kendi dünyanı paylaşmak için hemen aramıza katılarak başla!
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-2 my-8">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`h-2 rounded-full transition-all ${
                        step === onboardingStep ? 'w-8 bg-primary' : 'w-2 bg-primary/30'
                      }`}
                    />
                  ))}
                </div>

                <div className="space-y-3 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (onboardingStep < 3) {
                        setOnboardingStep((onboardingStep + 1) as 1 | 2 | 3)
                      } else {
                        localStorage.setItem('hasSeenOnboarding', 'true')
                        setFlowStep('welcome')
                        setOnboardingStep(1)
                      }
                    }}
                    className="w-full rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-lg transition active:scale-[0.98]"
                  >
                    {onboardingStep === 3 ? 'Başla' : 'Devam Et'}
                  </button>
                </div>
              </div>
            )}

            {flowStep === 'welcome' && (
              <div className="flex flex-col flex-1 justify-between">
                <div>
                  <h1 className="text-balance text-3xl font-semibold tracking-tight">Pulbi'ye Hoş Geldin</h1>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Yollarının kesiştiği an. Devam etmek için kayıt ol veya giriş yap.
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthIntent('signup')
                      setFlowStep('register') // Doğrudan e-posta kayıt sayfasına yönlendirir
                      setError(null)
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-lg transition active:scale-[0.98]"
                  >
                    <UserPlus className="w-4 h-4"/> Kayıt Ol
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthIntent('signin')
                      setFlowStep('login') // Doğrudan e-posta giriş sayfasına yönlendirir
                      setError(null)
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 py-4 text-sm font-semibold text-foreground transition active:scale-[0.98]"
                  >
                    <LogIn className="w-4 h-4"/> Giriş Yap
                  </button>
                </div>
              </div>
            )}

            {flowStep === 'socialCompleteProfile' && (
              <form onSubmit={handleCompleteSocialProfile} className="flex flex-col space-y-3.5 pb-6">
                <div>
                  <h1 className="text-balance text-2xl font-semibold tracking-tight">Profili Tamamla</h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Lütfen ek bilgileri doldur.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Ad Soyad</label>
                    <input
                      type="text"
                      required
                      placeholder="Adın Soyadın"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Kullanıcı Adı</label>
                    <input
                      type="text"
                      required
                      placeholder="kullanici_adi"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Doğum Tarihi (18+)</label>
                      <input
                        type="date"
                        required
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Cinsiyet</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Erkek">Erkek</option>
                        <option value="Kadın">Kadın</option>
                        <option value="Belirtmek İstemiyorum">Belirtmek İstemiyorum</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-2.5 space-y-1.5 mt-1">
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-primary">Yasal Onaylar</p>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={termsAgreed}
                        onChange={(e) => setTermsAgreed(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border border-border bg-card accent-primary"
                      />
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        <button
                          type="button"
                          className="font-semibold text-primary underline decoration-primary/50 underline-offset-2"
                          onClick={() => {
                            setActiveLegalDoc('terms')
                            setShowLegalModal(true)
                          }}
                        >
                          Kullanıcı Sözleşmesi
                        </button>
                        'ni okudum, onaylıyorum.
                      </span>
                    </label>

                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={kvkkAgreed}
                        onChange={(e) => setKvkkAgreed(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border border-border bg-card accent-primary"
                      />
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        <button
                          type="button"
                          className="font-semibold text-primary underline decoration-primary/50 underline-offset-2"
                          onClick={() => {
                            setActiveLegalDoc('kvkk')
                            setShowLegalModal(true)
                          }}
                        >
                          KVKK Aydınlatma Metni
                        </button>
                        'ni okudum, onaylıyorum.
                      </span>
                    </label>
                  </div>
                </div>

                {error && <p className="text-xs text-destructive text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <span>Kaydı Tamamla ve Giriş Yap</span>
                  )}
                </button>
              </form>
            )}

            {flowStep === 'register' && (
              <form onSubmit={handleRegister} className="flex flex-col space-y-3 pb-6">
                <div>
                  <h1 className="text-balance text-2xl font-semibold tracking-tight">E-posta ile Kayıt Ol</h1>
                  <p className="mt-1 text-xs text-muted-foreground">Bilgilerini doldurarak hesap oluştur.</p>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Ad Soyad</label>
                    <input
                      type="text"
                      required
                      placeholder="Adın Soyadın"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Kullanıcı Adı</label>
                    <input
                      type="text"
                      required
                      placeholder="kullanici_adi"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">E-posta Adresi</label>
                    <input
                      type="email"
                      required
                      placeholder="ornek@mail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Doğum Tarihi (18+)</label>
                      <input
                        type="date"
                        required
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full mt-1 rounded-xl border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Cinsiyet</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full mt-1 rounded-xl border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Erkek">Erkek</option>
                        <option value="Kadın">Kadın</option>
                        <option value="Belirtmek İstemiyorum">Belirtmek İstemiyorum</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Şifre</label>
                    <input
                      type="password"
                      required
                      placeholder="En az 6 karakter"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Şifre Tekrar</label>
                    <input
                      type="password"
                      required
                      placeholder="Şifreyi tekrar gir"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-2.5 space-y-1.5 mt-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-primary">Yasal Onaylar</p>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={termsAgreed}
                        onChange={(e) => setTermsAgreed(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border border-border bg-card accent-primary"
                      />
                      <span className="text-[10px] leading-snug text-muted-foreground">
                        <button
                          type="button"
                          className="font-semibold text-primary underline decoration-primary/50 underline-offset-2"
                          onClick={() => {
                            setActiveLegalDoc('terms')
                            setShowLegalModal(true)
                          }}
                        >
                          Kullanıcı Sözleşmesi
                        </button>
                        'ni okudum, onaylıyorum.
                      </span>
                    </label>

                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={kvkkAgreed}
                        onChange={(e) => setKvkkAgreed(e.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border border-border bg-card accent-primary"
                      />
                      <span className="text-[10px] leading-snug text-muted-foreground">
                        <button
                          type="button"
                          className="font-semibold text-primary underline decoration-primary/50 underline-offset-2"
                          onClick={() => {
                            setActiveLegalDoc('kvkk')
                            setShowLegalModal(true)
                          }}
                        >
                          KVKK Aydınlatma Metni
                        </button>
                        'ni okudum, onaylıyorum.
                      </span>
                    </label>
                  </div>
                </div>

                {error && <p className="text-xs text-destructive text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Kaydediliyor...</span>
                    </>
                  ) : (
                    <span>Kayıt Ol</span>
                  )}
                </button>
              </form>
            )}

            {flowStep === 'verifyRegister' && (
              <form onSubmit={handleConfirmRegistration} className="flex flex-col space-y-4 pb-6">
                <div>
                  <h1 className="text-balance text-2xl font-semibold tracking-tight">E-posta Doğrulaması</h1>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    E-posta adresinize gelen doğrulama kodunu girin.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Doğrulama Kodu</label>
                  <input
                    type="text"
                    required
                    placeholder="Kod"
                    value={registrationCode}
                    onChange={(e) => setRegistrationCode(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {registrationError && <p className="text-xs text-destructive text-center">{registrationError}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center space-x-2 transition"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Doğrulanıyor...</span>
                    </>
                  ) : (
                    <span>Doğrulamayı Tamamla</span>
                  )}
                </button>
              </form>
            )}

            {flowStep === 'login' && (
              <form onSubmit={handleLogin} className="flex flex-col space-y-4 pb-6">
                <div>
                  <h1 className="text-balance text-2xl font-semibold tracking-tight">E-posta ile Giriş Yap</h1>
                  <p className="mt-1 text-xs text-muted-foreground">E-posta/Kullanıcı adın ve şifrenle giriş yap.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">E-posta veya Kullanıcı Adı</label>
                    <input
                      type="text"
                      required
                      placeholder="ornek@mail.com"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Şifre</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {error && <p className="text-xs text-destructive text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center space-x-2 transition"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Giriş Yapılıyor...</span>
                    </>
                  ) : (
                    <span>Giriş Yap</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFlowStep('forgot')
                    setError(null)
                  }}
                  className="w-full text-center text-xs text-primary underline"
                >
                  Şifremi unuttum
                </button>
              </form>
            )}

            {flowStep === 'forgot' && (
              <form onSubmit={handleSendPasswordReset} className="flex flex-col space-y-4 pb-6">
                <div>
                  <h1 className="text-balance text-2xl font-semibold tracking-tight">Şifremi Unuttum</h1>
                  <p className="mt-1 text-xs text-muted-foreground">Kayıtlı e-postanı gir.</p>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">E-posta</label>
                  <input
                    type="text"
                    required
                    placeholder="ornek@mail.com"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-3 text-xs text-foreground"
                  />
                </div>

                {error && <p className="text-xs text-destructive text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center space-x-2 transition"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Gönderiliyor...</span>
                    </>
                  ) : (
                    <span>Sıfırlama Kodu Gönder</span>
                  )}
                </button>
              </form>
            )}

            {flowStep === 'reset' && (
              <form onSubmit={handleConfirmReset} className="flex flex-col space-y-4 pb-6">
                <div>
                  <h1 className="text-balance text-2xl font-semibold tracking-tight">Yeni Şifre Belirle</h1>
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Sıfırlama Kodu"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-xs text-foreground"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Yeni Şifre"
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-xs text-foreground"
                  />
                  <input
                    type="password"
                    required
                    placeholder="Yeni Şifre Tekrar"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-3 text-xs text-foreground"
                  />
                </div>

                {error && <p className="text-xs text-destructive text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center space-x-2 transition"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-primary-foreground" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Güncelleniyor...</span>
                    </>
                  ) : (
                    <span>Şifreyi Güncelle</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {activeLegalDoc && (
        <LegalDocModal
          open={showLegalModal}
          onClose={() => {
            setActiveLegalDoc(null)
            setShowLegalModal(false)
          }}
          title={legalDocuments[activeLegalDoc].title}
          content={legalDocuments[activeLegalDoc].content}
        />
      )}
    </main>
  )
}
