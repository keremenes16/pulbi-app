'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  AtSign,
  Camera,
  Check,
  ShieldCheck,
  User,
  Mail,
  Sparkles,
  Trash2,
  X,
  ChevronRight,
  UserX,
  ChevronDown,
  FileText,
  Users2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import { useTranslations } from '@/lib/i18n'
import { LegalDocModal } from '@/components/pulbi/legal-doc-modal'
import { legalDocuments, type LegalDocKey } from '@/lib/legal-docs'
import {
  deleteUser as deleteFirebaseUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, updateDoc, where, arrayRemove } from 'firebase/firestore'

type BlockedUser = {
  encounterId: string
  blockedUserId: string
  fullName?: string
}

function Field({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  prefix,
  maxLength,
  multiline,
  readOnly,
}: {
  icon: LucideIcon
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  prefix?: string
  maxLength?: number
  multiline?: boolean
  readOnly?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-widest text-primary/90">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </span>
      <div className={`flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 transition-all duration-300 ${readOnly ? 'opacity-70 bg-white/[0.01]' : 'focus-within:border-primary/50 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_20px_rgba(var(--primary),0.15)]'}`}>
        {prefix && (
          <span className="shrink-0 text-sm font-semibold text-muted-foreground">
            {prefix}
          </span>
        )}
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={3}
            readOnly={readOnly}
            className="w-full resize-none bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 shadow-inner"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            readOnly={readOnly}
            className="w-full bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 shadow-inner"
          />
        )}
      </div>
      {maxLength && (
        <span className="mt-1.5 block px-1 text-right text-[10px] text-muted-foreground/80 font-medium">
          {value.length}/{maxLength}
        </span>
      )}
    </label>
  )
}

export function ProfileScreen({
  userId,
  onBack,
}: {
  userId?: string
  onBack?: () => void
}) {
  const t = useTranslations()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [currentUsername, setCurrentUsername] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('belirtilmemis')

  const [saved, setSaved] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showLegalModal, setShowLegalModal] = useState(false)
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocKey | null>(null)
  
  const [showPoliciesAccordion, setShowPoliciesAccordion] = useState(false)

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)
  const [deleteAccountStep, setDeleteAccountStep] = useState<1 | 2>(1)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteAccountStatus, setDeleteAccountStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [matchedBefore, setMatchedBefore] = useState<{ count: number; lastPlace: string; lastTime: string } | null>(null)
  const [accessNotice, setAccessNotice] = useState<string | null>(null)

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [showBlockedModal, setShowBlockedModal] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isOwnProfile = !userId || userId === auth.currentUser?.uid

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview)
      }
    }
  }, [avatarPreview])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const handleAuth = (currentUser: typeof auth.currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser || !isOwnProfile) {
        setBlockedUsers([])
        return
      }

      const userDocRef = doc(db, 'users', currentUser.uid)
      unsubscribe = onSnapshot(userDocRef, async (userSnap) => {
        if (!auth.currentUser) return
        if (!userSnap.exists()) return

        const userData = userSnap.data();
        const blockedIds: string[] = userData.blockedUsers || [];
        const list: BlockedUser[] = [];

        for (const blockedId of blockedIds) {
          let otherName = t('anonymousUser');
          try {
            const otherUserDoc = await getDoc(doc(db, 'users', blockedId));
            if (otherUserDoc.exists()) {
              const otherData = otherUserDoc.data();
              otherName = otherData.fullName || otherData.name || t('anonymousUser');
            }
          } catch (e) {
            console.error('Engellenen kullanıcı adı alınamadı', e);
          }

          list.push({
            encounterId: blockedId,
            blockedUserId: blockedId,
            fullName: otherName,
          });
        }

        setBlockedUsers((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(list)) {
            return prev;
          }
          return list;
        });
      }, (error) => {
        if (!auth.currentUser) return
        console.error("Engellenenler yüklenirken hata:", error);
      })
    }

    const authUnsub = auth.onAuthStateChanged(handleAuth)
    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, [isOwnProfile, t])

  const handleUnblockUser = async (blockedUserId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        blockedUsers: arrayRemove(blockedUserId)
      });
    } catch (error) {
      console.error('Engel kaldırılırken hata oluştu:', error);
    }
  };

  useEffect(() => {
    async function fetchUserData() {
      const currentUser = auth.currentUser
      if (!currentUser) return

      const targetUserId = typeof userId === 'string' && userId ? userId : currentUser.uid
      const currentIsOwn = !userId || userId === currentUser.uid
      setAccessNotice(null)

      try {
        if (!targetUserId || typeof targetUserId !== 'string') {
          setLoading(false)
          return
        }

        const userDocRef = doc(db, 'users', targetUserId)
        const userDocSnap = await getDoc(userDocRef)

        if (!currentIsOwn) {
          const currentUserDocRef = doc(db, 'users', currentUser.uid)
          const currentUserDocSnap = await getDoc(currentUserDocRef)
          const currentBlockedUsers = currentUserDocSnap.exists() ? (currentUserDocSnap.data().blockedUsers || []) : []
          const targetBlockedUsers = userDocSnap.exists() ? (userDocSnap.data().blockedUsers || []) : []

          if (currentBlockedUsers.includes(targetUserId)) {
            setAccessNotice(t('blockedYouAccessDenied'))
            setLoading(false)
            return
          }

          if (targetBlockedUsers.includes(currentUser.uid)) {
            setAccessNotice(t('blockedByUserProfile'))
            setLoading(false)
            return
          }
        }

        if (userDocSnap.exists()) {
          const data = userDocSnap.data()
          setName(data.fullName || '')
          setUsername(data.username || '')
          setCurrentUsername(data.username || '')
          setBio(data.bio || '')
          setEmail(data.email || currentUser.email || '')
          setAvatarPreview(data.photoURL || currentUser.photoURL || null)
          
          const rawGender = (data.gender || 'belirtilmemis').toLowerCase()
          setGender(['erkek', 'kadin', 'belirtilmemis'].includes(rawGender) ? rawGender : 'belirtilmemis')
        } else if (currentIsOwn) {
          setEmail(currentUser.email || '')
        }

        if (!currentIsOwn) {
          const encountersQuery = query(
            collection(db, 'encounters'),
            where('users', 'array-contains', currentUser.uid)
          )
          const encounterSnap = await getDocs(encountersQuery)

          let count = 0
          let latestTime = 0
          let lastPlace = t('unknownLocation')

          encounterSnap.forEach((docSnap) => {
            const data = docSnap.data()
            const users: string[] = data.users || []
            if (users.includes(targetUserId)) {
              count += data.count || 1
              const timestamp = data.lastEncounter?.toMillis?.() || data.createdAt?.toMillis?.() || 0
              if (timestamp > latestTime) {
                latestTime = timestamp
                lastPlace = data.place || lastPlace
              }
            }
          })

          setMatchedBefore({
            count,
            lastPlace,
            lastTime: latestTime
              ? new Date(latestTime).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
              : t('notYet'),
          })
        }
      } catch (error) {
        console.error('Kullanıcı bilgileri çekilirken hata oluştu:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [userId])

  const fileToDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result && typeof reader.result === 'string') {
          resolve(reader.result)
        } else {
          reject(new Error(t('imageReadError')))
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleSave() {
    const currentUser = auth.currentUser
    if (!currentUser) return

    setProfileError(null)

    try {
      const trimmedUsername = username.trim()
      if (!trimmedUsername) {
        setProfileError(t('usernameRequired'))
        return
      }

      if (trimmedUsername !== currentUsername) {
        const usernameQuery = query(
          collection(db, 'users'),
          where('username', '==', trimmedUsername)
        )
        const usernameSnapshot = await getDocs(usernameQuery)
        const takenByOther = usernameSnapshot.docs.some(
          (doc) => doc.id !== currentUser.uid
        )

        if (takenByOther) {
          setProfileError(t('usernameTaken'))
          return
        }
      }

      const userDocRef = doc(db, 'users', currentUser.uid)
      let photoURL = avatarPreview

      if (avatarFile) {
        if (avatarPreview?.startsWith('blob:')) {
          URL.revokeObjectURL(avatarPreview)
        }
        photoURL = await fileToDataUrl(avatarFile)
      }

      await updateDoc(userDocRef, {
        fullName: name,
        username: trimmedUsername,
        bio: bio,
        photoURL: photoURL || null,
      })

      const isUsernameChanged = trimmedUsername !== currentUsername
      setCurrentUsername(trimmedUsername)
      
      setSavedMessage(
        isUsernameChanged
          ? 'Kullanıcı adı değiştirildi ve profil bilgilerin kaydedildi.'
          : 'Profil bilgilerin başarıyla kaydedildi.'
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (error) {
      console.error('Profil güncellenirken hata oluştu:', error)
      setProfileError(t('profileUpdateError'))
    }
  }

  async function handlePasswordUpdate() {
    setPasswordError(null)
    const currentUser = auth.currentUser
    if (!currentUser) {
      setPasswordError(t('notLoggedIn'))
      return
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError(t('fillAllPasswordFields'))
      return
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{6,}$/
    if (!passwordRegex.test(newPassword)) {
      setPasswordError('Şifre en az 6 karakter olmalı, en az bir büyük harf ve bir rakam içermelidir.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('passwordMismatch'))
      return
    }

    if (!currentUser.email) {
      setPasswordError(t('noEmailForPassword'))
      return
    }

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      )
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, newPassword)

      setPasswordSaved(true)
      setShowPasswordForm(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setTimeout(() => setPasswordSaved(false), 2200)
    } catch (error) {
      console.error('Şifre değiştirilemedi:', error)
      setPasswordError(t('passwordUpdateFailed'))
    }
  }

  const resetDeleteAccountFlow = () => {
    setShowDeleteAccountModal(false)
    setDeleteAccountStep(1)
    setDeleteAccountStatus(null)
    setIsDeletingAccount(false)
  }

  const deleteUserFirestoreData = async (uid: string) => {
    const deleteCollectionDocs = async (
      collectionPath: string,
      fieldName?: string,
      fieldValue?: string,
      operator: '==' | 'array-contains' = '=='
    ) => {
      const ref = collection(db, collectionPath)
      const q = fieldName && fieldValue ? query(ref, where(fieldName, operator, fieldValue)) : ref
      const snap = await getDocs(q)
      await Promise.all(snap.docs.map((docSnap) => deleteDoc(doc(db, collectionPath, docSnap.id))))
    }

    const deleteUserSubcollectionDocs = async (parentPath: string, subcollection: string) => {
      const subRef = collection(db, parentPath, uid, subcollection)
      const snap = await getDocs(subRef)
      await Promise.all(
        snap.docs.map((docSnap) => deleteDoc(doc(db, parentPath, uid, subcollection, docSnap.id)))
      )
    }

    await deleteDoc(doc(db, 'users', uid)).catch(() => undefined)
    await deleteUserSubcollectionDocs('users', 'safeZones').catch(() => undefined)
    await deleteDoc(doc(db, 'active_sparks', uid)).catch(() => undefined)
    await deleteCollectionDocs('spark_requests', 'from', uid).catch(() => undefined)
    await deleteCollectionDocs('spark_requests', 'to', uid).catch(() => undefined)

    const chatSnap = await getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', uid)))
    await Promise.all(
      chatSnap.docs.map(async (chatDoc) => {
        const messagesRef = collection(db, 'chats', chatDoc.id, 'messages')
        const messagesSnap = await getDocs(messagesRef)
        await Promise.all(
          messagesSnap.docs.map((messageDoc) => deleteDoc(doc(db, 'chats', chatDoc.id, 'messages', messageDoc.id)))
        )
        await deleteDoc(doc(db, 'chats', chatDoc.id))
      })
    )

    await deleteCollectionDocs('encounters', 'users', uid, 'array-contains').catch(() => undefined)
    await deleteCollectionDocs('reports', 'reportedBy', uid).catch(() => undefined)
    await deleteCollectionDocs('reports', 'reportedUserId', uid).catch(() => undefined)
  }

  const handleDeleteAccount = async () => {
    const currentUser = auth.currentUser
    if (!currentUser) return

    setIsDeletingAccount(true)
    setDeleteAccountStatus('Hesap verileri siliniyor...')

    try {
      await deleteUserFirestoreData(currentUser.uid)

      try {
        await deleteFirebaseUser(currentUser)
      } catch (authError) {
        console.warn('Firebase auth hesabı silinemedi, Firestore verileri temizlendi:', authError)
      }

      await signOut(auth)
      resetDeleteAccountFlow()
    } catch (error) {
      console.error('Hesap silinirken hata oluştu:', error)
      setDeleteAccountStatus('Hesap silinemedi. Lütfen tekrar deneyin.')
      setIsDeletingAccount(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
        {t('profileLoading')}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-50 flex h-full flex-col bg-background relative">
      {/* Üst Header - Çıkış Butonu Kaldırıldı */}
      <div className="flex items-center gap-3 border-b border-white/10 px-6 pt-12 pb-3.5 bg-background/90 backdrop-blur-xl z-10 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('backLabel')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 text-muted-foreground transition active:scale-95 hover:bg-white/10 hover:text-foreground"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
        )}
        <div className="leading-tight flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">
            {isOwnProfile ? t('profileListTitle') : (name || t('profileHeaderTitle'))}
          </h1>
          {isOwnProfile && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('profileListSubtitle')}
            </p>
          )}
        </div>
      </div>

      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-6 pb-28 pt-6">
        {/* Şık Profil Banner & Fotoğraf Bölümü */}
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 text-center backdrop-blur-2xl shadow-xl">
          <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

          <div className="relative inline-block mx-auto">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-primary/50 bg-[#0a0612] shadow-[0_0_30px_rgba(var(--primary),0.3)]">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Profil fotoğrafı"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/20 via-purple-500/15 to-pink-500/10 text-primary">
                  <Sparkles className="h-8 w-8 animate-spin" style={{ animationDuration: '8s' }} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Pulbi</span>
                </div>
              )}
              {isOwnProfile && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (avatarPreview?.startsWith('blob:')) {
                        URL.revokeObjectURL(avatarPreview)
                      }
                      setAvatarFile(file)
                      setAvatarPreview(URL.createObjectURL(file))
                    }}
                  />
                  <button
                    type="button"
                    aria-label={t('changePhoto')}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition active:scale-95 hover:scale-105"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <h2 className="mt-3.5 text-lg font-extrabold text-foreground tracking-tight">{name || t('userDisplayNameFallback')}</h2>
          <p className="text-xs font-semibold text-primary/90">@{username || t('usernameDisplayFallback')}</p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-md">
              <Users2 className="h-3 w-3 text-primary" />
              {gender === 'erkek' ? 'Erkek' : gender === 'kadin' ? 'Kadın' : 'Belirtilmemiş'}
            </span>
          </div>
        </div>

        {accessNotice ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive backdrop-blur-xl">
            <p className="font-bold">{t('profileUnavailable')}</p>
            <p className="mt-1 text-xs leading-relaxed text-destructive/80">{accessNotice}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                icon={User}
                label={t('profileNameLabel')}
                value={name}
                onChange={setName}
                placeholder={t('profileNamePlaceholder')}
                readOnly={!isOwnProfile}
              />
              <Field
                icon={AtSign}
                label={t('profileUsernameLabel')}
                value={username}
                onChange={setUsername}
                placeholder={t('profileUsernamePlaceholder')}
                prefix="@"
                readOnly={!isOwnProfile}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                icon={Mail}
                label={t('profileEmailLabel')}
                value={email}
                onChange={() => {} }
                placeholder="ornek@mail.com"
                type="email"
                readOnly
              />
              <Field
                icon={Users2}
                label="Cinsiyet"
                value={gender === 'erkek' ? 'Erkek' : gender === 'kadin' ? 'Kadın' : 'Belirtilmemiş'}
                onChange={() => {}}
                readOnly
              />
            </div>

            <Field
              icon={User}
              label={t('profileBioLabel')}
              value={bio}
              onChange={setBio}
              placeholder={t('profileBioPlaceholder')}
              maxLength={120}
              multiline
              readOnly={!isOwnProfile}
            />

            {isOwnProfile && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all active:scale-[0.99] shadow-lg ${
                    saved
                      ? 'bg-amber-500 text-black shadow-amber-500/30'
                      : 'bg-primary text-primary-foreground shadow-primary/30 hover:opacity-95'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saved ? (
                    <>
                      <Check className="h-4.5 w-4.5" />
                      {t('saveProfileSaved')}
                    </>
                  ) : loading ? (
                    t('saveProfileSaving')
                  ) : (
                    t('saveProfileButton')
                  )}
                </button>
                {profileError && (
                  <p className="mt-2 text-xs font-medium text-destructive">{profileError}</p>
                )}
                {saved && !loading && (
                  <p className="mt-2 text-xs font-medium text-emerald-400">
                    {savedMessage}
                  </p>
                )}
              </div>
            )}

            {isOwnProfile ? (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between gap-3 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.05]">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive shadow-inner">
                      <UserX className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{t('blockedUsersTitle')}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {blockedUsers.length > 0 ? `${blockedUsers.length} kişi engellendi` : t('blockedUsersEmpty')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBlockedModal(true)}
                    className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/10 active:scale-95 shadow-sm"
                  >
                    Yönet
                  </button>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{t('changePasswordTitle')}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                        {t('changePasswordSubtitle')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm((prev) => !prev)
                        setPasswordError(null)
                      }}
                      className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/10 active:scale-95 shadow-sm"
                    >
                      {showPasswordForm ? t('cancel') : 'Şifremi Değiştir'}
                    </button>
                  </div>

                  {showPasswordForm && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3.5 animate-rise">
                      <Field
                        icon={ShieldCheck}
                        label={t('currentPasswordLabel')}
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        placeholder={t('currentPasswordPlaceholder')}
                        type="password"
                      />
                      <Field
                        icon={ShieldCheck}
                        label={t('newPasswordLabel')}
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder={t('newPasswordPlaceholder')}
                        type="password"
                      />
                      <Field
                        icon={ShieldCheck}
                        label={t('confirmPasswordLabel')}
                        value={confirmNewPassword}
                        onChange={setConfirmNewPassword}
                        placeholder={t('confirmPasswordPlaceholder')}
                        type="password"
                      />
                      {passwordError && (
                        <p className="text-xs font-medium text-destructive">{passwordError}</p>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          await handlePasswordUpdate()
                          if (passwordSaved) {
                            setShowPasswordForm(false)
                          }
                        }}
                        className="w-full rounded-2xl bg-primary/20 border border-primary/30 py-3.5 text-sm font-bold text-primary transition hover:bg-primary/30 active:scale-[0.99] shadow-inner"
                      >
                        {t('updatePasswordButton')}
                      </button>
                      {passwordSaved && (
                        <p className="text-xs font-medium text-emerald-400">
                          {t('passwordSavedSuccess')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] overflow-hidden backdrop-blur-xl transition-all duration-300">
                  <button
                    type="button"
                    onClick={() => setShowPoliciesAccordion((prev) => !prev)}
                    className="flex w-full items-center justify-between p-4 text-left transition hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-inner">
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold tracking-wider text-foreground">GİZLİLİK, SÖZLEŞMELER VE KURALLAR</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4.5 w-4.5 text-muted-foreground transition-transform duration-300 ${
                        showPoliciesAccordion ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      showPoliciesAccordion ? 'grid-rows-[1fr] opacity-100 pb-2 px-2' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden space-y-1">
                      {[
                        { key: 'privacy', label: t('privacyPolicyLabel') },
                        { key: 'terms', label: t('termsOfServiceLabel') },
                        { key: 'kvkk', label: t('kvkkLabel') },
                        { key: 'community', label: t('communityGuidelinesLabel') },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setActiveLegalDoc(item.key as LegalDocKey)
                            setShowLegalModal(true)
                          }}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium text-foreground transition hover:bg-white/5 active:scale-[0.99]"
                        >
                          <span className="text-xs font-semibold">{item.label}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteAccountStep(1)
                    setShowDeleteAccountModal(true)
                  }}
                  className="flex w-full items-center gap-3.5 rounded-[2rem] border border-destructive/30 bg-destructive/10 px-4 py-4 text-left transition hover:bg-destructive/20 active:scale-[0.99]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/20 border border-destructive/30 text-destructive shadow-inner">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-destructive">{t('deleteAccount')}</p>
                    <p className="mt-0.5 text-xs font-medium text-destructive/80">{t('deleteAccountWarningShort')}</p>
                  </div>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {showBlockedModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-6">
          <div className="w-full max-w-sm rounded-[2.5rem] border border-white/15 bg-[#0a0612]/95 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-rise max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/20 text-destructive">
                  <UserX className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-foreground">{t('blockedUsersTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBlockedModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {t('blockedUsersDesc') || 'Engellediğin kullanıcılar seninle tekrar etkileşime giremez ve yankılarda görünmez.'}
            </p>
            <div className="no-scrollbar flex-1 overflow-y-auto space-y-2">
              {blockedUsers.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {t('blockedUsersEmpty')}
                </div>
              ) : (
                blockedUsers.map((user) => (
                  <div key={user.encounterId} className="flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/20 text-destructive font-bold text-xs">
                        {user.fullName?.[0]?.toUpperCase() || 'K'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-foreground">{user.fullName}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">Engelli</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblockUser(user.encounterId)}
                      className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition"
                    >
                      {t('unblock')}
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="pt-4 mt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowBlockedModal(false)}
                className="w-full rounded-full border border-white/15 bg-white/5 py-3 text-xs font-semibold text-foreground hover:bg-white/10 transition"
              >
                {t('closeLabel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-6">
          <div className="w-full max-w-sm rounded-[2.5rem] border border-white/15 bg-[#0a0612]/95 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl animate-rise">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/20 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {deleteAccountStep === 1 ? t('deleteAccountConfirmStep1') : t('deleteAccountConfirmStep2')}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetDeleteAccountFlow}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {deleteAccountStep === 1 ? t('deleteAccountIrreversible') : t('deleteAccountIrreversible2')}
            </p>
            {deleteAccountStatus && (
              <p className="mt-3 text-sm font-semibold text-destructive">{deleteAccountStatus}</p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={resetDeleteAccountFlow}
                className="flex-1 rounded-full border border-white/15 bg-white/5 py-3.5 text-sm font-semibold text-foreground transition hover:bg-white/10 active:scale-[0.98]"
              >
                {t('cancel')}
              </button>
              {deleteAccountStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setDeleteAccountStep(2)}
                  className="flex-1 rounded-full bg-destructive text-destructive-foreground py-3.5 text-sm font-semibold shadow-lg shadow-destructive/30 transition hover:opacity-90 active:scale-[0.98]"
                >
                  {t('continue')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="flex-1 rounded-full bg-destructive text-destructive-foreground py-3.5 text-sm font-semibold shadow-lg shadow-destructive/30 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                >
                  {isDeletingAccount ? t('deleting') : t('delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeLegalDoc && (
        <LegalDocModal
          open={showLegalModal}
          title={legalDocuments[activeLegalDoc].title}
          content={legalDocuments[activeLegalDoc].content}
          onClose={() => {
            setShowLegalModal(false)
            setActiveLegalDoc(null)
          }}
        />
      )}
    </div>
  )
}