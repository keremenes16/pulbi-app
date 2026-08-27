'use client'

import { useEffect, useRef, useState } from 'react'
import { Coffee, Train, TreePine, Check, X, AlertTriangle, Search, Trash2, User, Sparkles, MapPin, CircleHelp, SlidersHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { db, auth } from '@/lib/firebase'
import { useTranslations } from '@/lib/i18n'
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, arrayUnion, arrayRemove, serverTimestamp, Timestamp, getDoc } from 'firebase/firestore'
import { isPointInsideSafeZone, type SafeZone } from '@/lib/capsules'

type Hint = {
  id: string
  time: string
  place: string
  message: string
  icon: LucideIcon
  encounter: number
  unlocked?: boolean
  users?: string[]
  status?: 'pending' | 'accepted' | 'rejected' | 'blocked'
  requestedBy?: string
  rejectCount?: number
  blockedBy?: string
  createdAt?: any
  otherUserName?: string
  otherUserId?: string
  otherUserPhotoURL?: string | null
  otherUserUsername?: string
  cachedCreativeMessage?: string
  deletedFor?: string[]
  distanceMeters?: number
  blockedByOtherUser?: boolean
}

type FilterType = 'all' | 'unlocked' | 'repeat' | 'first'

const creativeEchoTemplates: ((place: string) => string)[] = [
  (p) => `Sanki kader ağlarını ${p} bölgesinde örmüş. Etrafına bir bak, belki o tanıdık yüz tam yanında.`,
  (p) => `${p} civarında esrarengiz bir enerji var. Gözlerini dört aç, çünkü biri sana çok yakın.`,
  (p) => `Biriyle yolların ${p} noktasında çakıştı. Görünmez bağları hisset ve çevreni incele.`,
  (p) => `Sırlar bazen ${p} gibi sıradan yerlerde gizlenir. Etrafını kontrol et, o kişiyi bulabilecek misin?`,
  (p) => `Evrenin sana bir sürprizi var; ${p} yakınlarında bir yankı aldık. Dikkatlice etrafına bak.`,
  (p) => `Hey! ${p} civarında senin frekansında biri var! Başını kaldır ve etrafındaki kalabalığı incele.`,
  (p) => `Adrenalin yükseliyor! ${p} lokasyonunda biriyle aynı ana denk geldin. Tanışmaya hazır mısın?`,
  (p) => `Yakın takip! ${p} bölgesinde bir kullanıcı tespit edildi. Gözlerini çevreden ayırma!`,
  (p) => `Şans bu ya, ${p} civarındasın ve tam yanında biri var. Hadi, harekete geçme vakti!`,
  (p) => `Bir karşılaşma anı! ${p} civarında başını biraz sola çevir, belki de beklediğin kişi oradadır.`,
  (p) => `Burası ${p}... Belki de bugünün en güzel anısı burada, seninle başlamak üzeredir.`,
  (p) => `${p} sokağında tesadüfler güzeldir. Etrafına bak, belki biri seninle göz göze gelmeyi bekliyordur.`,
  (p) => `Sakin bir gün, ${p} atmosferi ve sen... Yakınlarda Pulbi kullanan biri var, selam vermeye ne dersin?`,
  (p) => `${p} civarındaki bu anı kaçırma. Etrafındaki insanlara biraz daha dikkatli bakmaya başla.`,
  (p) => `Gülümse! ${p} bölgesinde sana çok yakın bir yankı yakaladık. Etrafını biraz incele.`,
  (p) => `Konum bildirimi: ${p} civarındasın. Yakınlarda bir yerlerde birileri var, etrafına bak.`,
  (p) => `Sinyaller ${p} noktasını işaret ediyor. Etrafındaki insan trafiğini bir gözden geçir.`,
  (p) => `Şu an ${p} bölgesindesin. Yakınlarında biriyle aynı noktadasın, etrafını gözlemle.`,
  (p) => `${p} merkezinde bir karşılaşma! Bak bakalım, çevrende kimler var?`,
  (p) => `Harita üzerinde ${p} noktasındasın. Yakınında bir yankı var, biraz dikkatli ol!`,
  (p) => `${p} civarında biri var. Etrafını kontrol et!`,
  (p) => `Yakınlarda biri! ${p} bölgesine dikkat.`,
  (p) => `Bir yankı yakalandı: ${p}. Çevrene bak!`,
  (p) => `${p} civarında yeni bir yüz. Gözlerini ayırma.`,
  (p) => `Dikkat! ${p} konumunda karşılaşma ihtimali var.`,
  (p) => `${p} civarında bir oyun başlıyor. Etrafına bak, acaba o kişi kim?`,
  (p) => `Sanki ${p} seni birileriyle tanıştırmak istiyor. Etrafını bir süz, bak bakalım kimler var?`,
  (p) => `Mekan: ${p}. Görev: Etrafına bakmak ve o özel kişiyi keşfetmek!`,
  (p) => `${p} civarında yeni bir hikaye başlamak üzere. Başrol oyuncusu çevrende, iyi bak!`,
  (p) => `Tesadüflere inanır mısın? ${p} noktasında biri tam yanında. Şansını denemeye ne dersin?`
]

const generateCreativeEcho = (place = '') => {
  const p = place || 'gizli bir yerde'
  const idx = Math.floor(Math.random() * creativeEchoTemplates.length)
  return creativeEchoTemplates[idx](p)
}

interface HintsScreenProps {
  onOpenChat: (chatId: string) => void
  onOpenProfile?: (userId: string) => void
}

const getIconComponent = (type: string): LucideIcon => {
  switch (type) {
    case 'cafe': return Coffee
    case 'transport': return Train
    default: return TreePine
  }
}

function EncounterDots({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
            n <= count 
              ? 'bg-amber shadow-[0_0_6px_var(--color-amber)] scale-110' 
              : 'bg-muted/60 scale-90'
          }`}
        />
      ))}
    </div>
  )
}

export function HintsScreen({ onOpenChat, onOpenProfile }: HintsScreenProps) {
  const [hints, setHints] = useState<Hint[]>([])
  const [loading, setLoading] = useState(true)
  const [blockModalHint, setBlockModalHint] = useState<Hint | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [activeInfoModal, setActiveInfoModal] = useState<'today' | 'repeat' | null>(null)
  
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [expandedHintId, setExpandedHintId] = useState<string | null>(null)
  const [isInSafeZone, setIsInSafeZone] = useState(false)
  const [blockedByUsers, setBlockedByUsers] = useState<string[]>([])

  const [existingChatsByUserId, setExistingChatsByUserId] = useState<Record<string, { chatId: string; hidden: boolean }>>({})
  const t = useTranslations()
  const userFetchCacheRef = useRef<Map<string, Promise<{ name: string; username?: string; photoURL: string | null; blockedUsers: string[] }>>>(new Map())
  
  // Metinlerin sürekli değişmesini engellemek için cache tutuyoruz
  const creativeMessagesCache = useRef<Map<string, string>>(new Map())
  const safeZonesRef = useRef<SafeZone[]>([])

  useEffect(() => {
    let unsubscribeZones: (() => void) | undefined
    let watchId: number | undefined
    let currentPosition: { lat: number; lng: number } | null = null

    const updateSafeZoneVisibility = (zones: SafeZone[]) => {
      setIsInSafeZone(
        currentPosition
          ? isPointInsideSafeZone(currentPosition.lat, currentPosition.lng, zones)
          : false
      )
    }

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      unsubscribeZones?.()
      unsubscribeZones = undefined
      if (watchId !== undefined && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
        watchId = undefined
      }

      if (!currentUser) {
        safeZonesRef.current = []
        setIsInSafeZone(false)
        return
      }

      const zonesRef = collection(db, 'users', currentUser.uid, 'safeZones')
      unsubscribeZones = onSnapshot(zonesRef, (snapshot) => {
        const zones = snapshot.docs
          .map((zoneDoc) => zoneDoc.data())
          .filter(
            (zone): zone is SafeZone =>
              typeof zone.lat === 'number' &&
              typeof zone.lng === 'number' &&
              typeof zone.radius === 'number'
          )
        safeZonesRef.current = zones
        updateSafeZoneVisibility(zones)
      }, (error) => {
        console.error('Yankılar için güvenli bölgeler yüklenemedi:', error)
      })

      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            currentPosition = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
            setIsInSafeZone(
              isPointInsideSafeZone(
                currentPosition.lat,
                currentPosition.lng,
                safeZonesRef.current
              )
            )
          },
          (error) => {
            console.warn('Yankılar için konum alınamadı:', error.message)
          },
          { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
        )
      }
    })

    return () => {
      unsubscribeAuth()
      unsubscribeZones?.()
      if (watchId !== undefined && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [])

  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      unsubscribeUser?.()
      unsubscribeUser = undefined
      if (!currentUser) {
        setBlockedByUsers([])
        return
      }

      unsubscribeUser = onSnapshot(doc(db, 'users', currentUser.uid), (snapshot) => {
        const data = snapshot.data()
        setBlockedByUsers(Array.isArray(data?.blockedByUsers) ? data.blockedByUsers : [])
      }, (error) => {
        console.error('Engelleyen kullanıcılar yüklenemedi:', error)
      })
    })

    return () => {
      unsubscribeAuth()
      unsubscribeUser?.()
    }
  }, [])

  useEffect(() => {
    let unsubscribeParticipants: (() => void) | undefined
    let unsubscribeSnapshot: (() => void) | undefined

    const unsubscribeAll = () => {
      unsubscribeParticipants?.()
      unsubscribeSnapshot?.()
    }

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      unsubscribeAll()

      if (!currentUser) {
        setHints([])
        setLoading(false)
        setExistingChatsByUserId({})
        return
      }

      const participantsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser.uid)
      )

      let participantsDocs: any[] = []

      const rebuildChatsMap = () => {
        const merged: Record<string, { chatId: string; hidden: boolean }> = {}
        const seen = new Set<string>()
        for (const docSnap of participantsDocs) {
          if (seen.has(docSnap.id)) continue
          seen.add(docSnap.id)
          const chatData = docSnap.data()
          const participants = chatData.participants || []
          const otherUid = participants.find((uid: string) => uid !== currentUser.uid)
          const hiddenFor = chatData.hiddenFor || []
          const isHidden = Array.isArray(hiddenFor) && hiddenFor.includes(currentUser.uid)

          if (otherUid) {
            merged[otherUid] = {
              chatId: docSnap.id,
              hidden: isHidden
            }
          }
        }
        setExistingChatsByUserId(merged)
      }

      unsubscribeParticipants = onSnapshot(participantsQuery, (snap) => {
        if (!auth.currentUser) return
        participantsDocs = snap.docs
        rebuildChatsMap()
      })

      const q = query(
        collection(db, "encounters"), 
        where("users", "array-contains", currentUser.uid)
      )

      unsubscribeSnapshot = onSnapshot(q, async (snapshot) => {
        if (!auth.currentUser) return

        if (snapshot.empty) {
          setHints([])
          setLoading(false)
          return
        }

        const now = Date.now()

        const liveHintsPromises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data()
          
          const deletedFor = data.deletedFor || []
          const isRequestedByOther = data.requestedBy && data.requestedBy !== currentUser.uid

          if (deletedFor.includes(currentUser.uid) && !isRequestedByOther) {
            return null
          }

          const rawCount = data.count || 1
          const count = Math.min(rawCount, 3)
          const isUnlocked = count >= 3

          let createdAtMs = now
          const createdAtValue = data.lastEncounter || data.createdAt
          if (createdAtValue) {
            if (createdAtValue instanceof Timestamp) {
              createdAtMs = createdAtValue.toMillis()
            } else if (createdAtValue.seconds) {
              createdAtMs = createdAtValue.seconds * 1000
            }
          }

          const distanceMeters = data.distanceMeters || 100

          const otherUserId = data.users?.find((uid: string) => uid !== currentUser.uid)
          if (otherUserId && blockedByUsers.includes(otherUserId)) {
            return null
          }
          let otherUserName = t('anonymousUser')
          let otherUserUsername: string | undefined = undefined
          let otherUserPhotoURL: string | null = null
    
          if (otherUserId) {
            try {
              let userPromise = userFetchCacheRef.current.get(otherUserId)

              if (!userPromise) {
                userPromise = (async () => {
                  const userSnap = await getDoc(doc(db, "users", otherUserId))
                  if (!userSnap.exists()) {
                    return { name: "Gezgin", username: undefined, photoURL: null, blockedUsers: [] }
                  }

                  const userData = userSnap.data()
                  const name = userData.name || userData.username || userData.displayName || "Gezgin"
                  return {
                    name,
                    username: userData.username || name.replace(/\s+/g, '').toLowerCase(),
                    photoURL: userData.photoURL || null,
                    blockedUsers: Array.isArray(userData.blockedUsers) ? userData.blockedUsers : [],
                  }
                })()
                userFetchCacheRef.current.set(otherUserId, userPromise)
              }

              const userData = await userPromise
              otherUserName = userData.name
              otherUserUsername = userData.username
              otherUserPhotoURL = userData.photoURL
              if (userData.blockedUsers.includes(currentUser.uid)) {
                return null
              }
            } catch (err) {
              console.error("Kullanıcı adı çekilemedi:", err)
            }
          }

          // Sabit yaratıcı mesaj önbelleği kontrolü (Sürekli değişmesini engeller)
          let creativeMsg = creativeMessagesCache.current.get(docSnap.id)
          if (!creativeMsg) {
            creativeMsg = generateCreativeEcho(data.place || t('mysteriousLocation'))
            creativeMessagesCache.current.set(docSnap.id, creativeMsg)
          }

          return {
            id: docSnap.id,
            time: data.time || t('today'),
            place: data.place || t('mysteriousLocation'),
            message: isUnlocked ? t('unlockMessage') : t('youMetCount', { count }),
            icon: getIconComponent(data.type),
            encounter: count,
            unlocked: isUnlocked,
            users: data.users || [],
            status: data.status || 'pending',
            requestedBy: data.requestedBy || null,
            rejectCount: data.rejectCount || 0,
            blockedBy: data.blockedBy || null,
            createdAt: createdAtMs,
            otherUserName,
            otherUserId,
            otherUserPhotoURL,
            otherUserUsername,
            cachedCreativeMessage: creativeMsg,
            deletedFor,
            distanceMeters,
          }
        })

        let resolvedHints = (await Promise.all(liveHintsPromises)).filter(Boolean) as Hint[]
        resolvedHints = resolvedHints.filter((hint) =>
          hint.status !== 'blocked' || hint.blockedBy === auth.currentUser?.uid
        )

        const uniqueHintsMap = new Map<string, Hint>()
        resolvedHints.forEach((hint) => {
          const key = hint.otherUserId || hint.id
          if (!uniqueHintsMap.has(key)) {
            uniqueHintsMap.set(key, hint)
          } else {
            const existing = uniqueHintsMap.get(key)!
            if ((hint.createdAt || 0) > (existing.createdAt || 0)) {
              uniqueHintsMap.set(key, hint)
            }
          }
        })

        const finalHints = Array.from(uniqueHintsMap.values())

        if (!auth.currentUser) return
        setHints(finalHints)

        setExpandedHintId(prev => {
          if (finalHints.length > 0 && (!prev || !finalHints.some(h => h.id === prev))) {
            return finalHints[0].id
          }
          return prev
        })

        setLoading(false)
      }, (error) => {
        if (!auth.currentUser) return
        console.error("Yankılar yüklenirken hata:", error)
        setLoading(false)
      })
    })

    return () => {
      unsubscribeAuth()
      unsubscribeAll()
    }
  }, [t, blockedByUsers])

  const handleDeleteHint = async (hintId: string) => {
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const docRef = doc(db, "encounters", hintId)
      await updateDoc(docRef, {
        deletedFor: arrayUnion(currentUser.uid)
      })
      
      setHints(prev => {
        const updated = prev.filter(h => h.id !== hintId)
        if (expandedHintId === hintId && updated.length > 0) {
          setExpandedHintId(updated[0].id)
        }
        return updated
      })
    } catch (error) {
      console.error("Yankı gizlenirken/silinirken hata:", error)
    }
  }

  const handleSendRequest = async (hint: Hint) => {
    const currentUser = auth.currentUser
    const hasHiddenChat = Boolean(hint.otherUserId && existingChatsByUserId[hint.otherUserId]?.hidden)
    if (!currentUser || hint.status === 'accepted' || hint.status === 'blocked' || (!hasHiddenChat && !hint.unlocked)) return
 
    try {
      const docRef = doc(db, "encounters", hint.id)
      await updateDoc(docRef, {
        requestedBy: currentUser.uid,
        status: 'pending'
      })
    } catch (error) {
      console.error("İstek gönderilirken hata:", error)
    }
  }

  const handleAcceptRequest = async (hint: Hint) => {
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const docRef = doc(db, "encounters", hint.id)
      await updateDoc(docRef, { status: 'accepted' })

      const otherUserId = hint.users?.find((uid) => uid !== currentUser.uid)
      if (!otherUserId) return

      const chatId = [currentUser.uid, otherUserId].sort().join('_')
      const chatRef = doc(db, "chats", chatId)

      await setDoc(chatRef, {
        participants: [currentUser.uid, otherUserId],
        users: [currentUser.uid, otherUserId],
        createdAt: serverTimestamp(),
        lastMessage: t('encounterStartedMessage'),
        isEncounterChat: true,
        participantNames: {
          [currentUser.uid]: currentUser.displayName || currentUser.email?.split('@')[0] || 'Pulbi Kullanıcısı',
          [otherUserId]: hint.otherUserName || 'Gezgin',
        },
        unreadCounts: {
          [currentUser.uid]: 0,
          [otherUserId]: 0,
        },
      }, { merge: true })

      if (onOpenChat) onOpenChat(chatId)
    } catch (error) {
      console.error("İstek kabul edilirken hata:", error)
    }
  }
 
  const handleRejectRequest = async (hint: Hint) => {
    try {
      const docRef = doc(db, "encounters", hint.id)
      const newRejectCount = (hint.rejectCount || 0) + 1
 
      await updateDoc(docRef, {
        requestedBy: null,
        status: 'rejected',
        rejectCount: newRejectCount
      })

      if (newRejectCount >= 3) {
        setBlockModalHint(hint)
      }
    } catch (error) {
      console.error("İstek reddedilirken hata:", error)
    }
  }

  const handleConfirmBlock = async () => {
    if (!blockModalHint) return
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const docRef = doc(db, "encounters", blockModalHint.id)
      await updateDoc(docRef, {
        status: 'blocked',
        blockedBy: currentUser.uid,
        requestedBy: null
      })
      if (blockModalHint.otherUserId) {
        await setDoc(doc(db, 'users', currentUser.uid), {
          blockedUsers: arrayUnion(blockModalHint.otherUserId),
        }, { merge: true })
        await setDoc(doc(db, 'users', blockModalHint.otherUserId), {
          blockedByUsers: arrayUnion(currentUser.uid),
        }, { merge: true })
      }
      setBlockModalHint(null)
    } catch (error) {
      console.error("Kullanıcı engellenirken hata:", error)
    }
  }

  const handleUnblock = async (hint: Hint) => {
    const currentUser = auth.currentUser
    try {
      const docRef = doc(db, "encounters", hint.id)
      await updateDoc(docRef, {
        status: 'pending',
        blockedBy: null,
        rejectCount: 0,
        requestedBy: null
      })
      if (currentUser && hint.otherUserId) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          blockedUsers: arrayRemove(hint.otherUserId),
        })
        await updateDoc(doc(db, 'users', hint.otherUserId), {
          blockedByUsers: arrayRemove(currentUser.uid),
        })
      }
    } catch (error) {
      console.error("Engeli kaldırırken hata:", error)
    }
  }

  const filteredHints = (isInSafeZone ? [] : hints).filter((hint) => {
    const matchesSearch = hint.place.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (activeFilter === 'unlocked') {
      const existingChat = hint.otherUserId ? existingChatsByUserId[hint.otherUserId] : undefined
      const isChatDeleted = Boolean(existingChat?.hidden)
      const isAlreadyMatched = Boolean(existingChat?.chatId && !isChatDeleted)
      const effectiveUnlocked = isChatDeleted ? false : hint.unlocked
      return effectiveUnlocked || isAlreadyMatched
    }

    if (activeFilter === 'repeat') {
      const existingChat = hint.otherUserId ? existingChatsByUserId[hint.otherUserId] : undefined
      const isChatDeleted = Boolean(existingChat?.hidden)
      const effectiveEncounter = isChatDeleted ? 1 : hint.encounter
      return effectiveEncounter >= 2
    }

    if (activeFilter === 'first') {
      const existingChat = hint.otherUserId ? existingChatsByUserId[hint.otherUserId] : undefined
      const isChatDeleted = Boolean(existingChat?.hidden)
      const effectiveEncounter = isChatDeleted ? 1 : hint.encounter
      return effectiveEncounter === 1
    }

    return true
  })

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Header - Sabit Alan */}
      <div className="shrink-0 px-6 pb-2 pt-8 z-10 bg-background/80 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[24px] font-bold tracking-[-0.04em]">
                {t('hintsTitle')}
              </h1>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">
              {t('hintsSubtitle') || 'Yollarının kesiştiği anların gizemli izleri'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHowItWorks(true)}
            className="mt-0.5 flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/55 px-2.5 text-xs font-semibold text-muted-foreground backdrop-blur-xl transition hover:border-primary/30 hover:text-foreground"
          >
            <CircleHelp className="h-3.5 w-3.5" />
            <span>Nasıl çalışır?</span>
          </button>
        </div>

        {/* Search & Filter */}
        <div className="mt-3 flex gap-2 relative">
          <div className="group relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder') || 'Mekan veya konum ara...'}
              className="h-11 w-full rounded-[18px] border border-border/70 bg-card/45 pl-10 pr-3.5 text-xs outline-none backdrop-blur-xl transition-all placeholder:text-muted-foreground/55 focus:border-primary/50 focus:bg-card/70 focus:shadow-[0_0_20px_rgba(139,92,246,0.08)]"
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              aria-label="Filtrele"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border backdrop-blur-xl transition ${
                activeFilter !== 'all'
                  ? 'border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                  : 'border-border/70 bg-card/45 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {showFilterDropdown && (
              <div className="absolute right-0 top-13 z-40 w-48 rounded-[20px] border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-xl animate-fadeIn">
                <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40">
                  Yankıları Filtrele
                </div>
                
                <div className="space-y-0.5 mt-1">
                  {[
                    { id: 'all', label: 'Tüm Yankılar' },
                    { id: 'unlocked', label: 'Kilidi Açılanlar' },
                    { id: 'repeat', label: 'Tekrar Kesişmeler' },
                    { id: 'first', label: 'İlk Kesişmeler' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => {
                        setActiveFilter(filter.id as FilterType)
                        setShowFilterDropdown(false)
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition ${
                        activeFilter === filter.id
                          ? 'bg-primary/15 font-bold text-primary'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }`}
                    >
                      <span>{filter.label}</span>
                      {activeFilter === filter.id && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {!loading && (
          <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-[20px] border border-primary/20 bg-gradient-to-br from-primary/[0.12] via-card/55 to-card/35 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setActiveInfoModal('today')}
              className="px-2 py-2.5 text-center transition hover:bg-primary/5 active:scale-[0.98]"
            >
              <div className="flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-base font-bold tabular-nums">{hints.length}</span>
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                Bugünkü Yankılar
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveInfoModal('repeat')}
              className="border-l border-primary/10 px-2 py-2.5 text-center transition hover:bg-primary/5 active:scale-[0.98]"
            >
              <div className="flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-base font-bold tabular-nums">
                  {hints.filter((h) => h.encounter >= 2).length}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                Tekrar Kesişme
              </div>
            </button>
          </div>
        )}

        {activeFilter !== 'all' && (
          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs text-primary">
            <span className="font-medium text-[11px]">
              Filtre: {
                activeFilter === 'unlocked' ? 'Kilidi Açılanlar' :
                activeFilter === 'repeat' ? 'Tekrar Kesişmeler' : 'İlk Kesişmeler'
              }
            </span>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="flex items-center gap-1 text-[11px] font-bold hover:underline"
            >
              <X className="h-3 w-3" /> Temizle
            </button>
          </div>
        )}
      </div>

      {/* Kaydırılabilir Echo Feed Alanı */}
      <div className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-6 pt-2 pb-32">
        {loading ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
            <div className="h-9 w-9 animate-pulse rounded-2xl bg-primary/15 shadow-[0_0_25px_rgba(139,92,246,0.15)]" />
            <span className="text-xs text-muted-foreground">{t('echoesSearching')}</span>
          </div>
        ) : filteredHints.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-[22px] border border-dashed border-border/60 bg-card/20 px-6 text-center">
            <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold">
              {searchQuery || activeFilter !== 'all' ? 'Bu kritere uygun yankı bulunamadı' : 'Henüz bir yankın yok'}
            </p>
            <p className="mt-1 max-w-[220px] text-[11px] leading-4 text-muted-foreground">
              {searchQuery || activeFilter !== 'all' ? 'Farklı bir arama veya filtre deneyebilirsin.' : t('noEchoYet')}
            </p>
          </div>
        ) : (
          filteredHints.map((hint) => {
            const Icon = hint.icon
            const currentUser = auth.currentUser
            const existingChat = hint.otherUserId ? existingChatsByUserId[hint.otherUserId] : undefined
            const existingChatId = existingChat?.chatId
            const isChatDeleted = Boolean(existingChat?.hidden)
            const isAlreadyMatched = Boolean(existingChatId && !isChatDeleted)

            const shouldResetEncounterFlow = Boolean(existingChatId && isChatDeleted)
            const effectiveEncounter = shouldResetEncounterFlow ? 1 : hint.encounter
            const effectiveUnlocked = shouldResetEncounterFlow ? false : hint.unlocked
            const effectiveStatus = shouldResetEncounterFlow ? 'pending' : hint.status

            const isMyRequest = hint.requestedBy === currentUser?.uid
            const isTargetUser = Boolean(hint.requestedBy && hint.requestedBy !== currentUser?.uid)
            const isBlocked = hint.status === 'blocked'
            const iBlockedThem = isBlocked && hint.blockedBy === currentUser?.uid

            const displayMessage = isAlreadyMatched
              ? 'Bu kişiyle daha önce radar ekranında kesişmiştiniz.'
              : (hint.cachedCreativeMessage || generateCreativeEcho(hint.place))

            const displayName = hint.otherUserUsername || hint.otherUserName || 'Gezgin'
            
            const isSelected = expandedHintId === hint.id
            const isFeatured = isSelected || isAlreadyMatched || Boolean(effectiveUnlocked)

            const openChat = () => {
              if (existingChatId && onOpenChat) onOpenChat(existingChatId)
            }

            return (
              <article
                key={hint.id}
                onClick={() => setExpandedHintId(hint.id)}
                className={`group relative overflow-hidden rounded-[18px] border backdrop-blur-xl transition-all duration-300 cursor-pointer ${
                  isFeatured
                    ? 'border-primary/30 bg-gradient-to-br from-primary/[0.10] via-card/60 to-card/35 shadow-[0_6px_20px_rgba(139,92,246,0.06)]'
                    : 'border-border/65 bg-card/40 hover:border-primary/20 hover:bg-card/55'
                }`}
              >
                {isFeatured && (
                  <>
                    <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
                    <div className="pointer-events-none absolute bottom-0 left-1/3 h-20 w-32 rounded-full bg-fuchsia-500/[0.04] blur-2xl" />
                  </>
                )}

                {isFeatured ? (
                  <div className="relative p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          if (effectiveUnlocked && hint.otherUserId && onOpenProfile) {
                            onOpenProfile(hint.otherUserId)
                          }
                        }}
                        className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 transition active:scale-95 ${
                          effectiveUnlocked
                            ? 'border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(139,92,246,0.18)]'
                            : 'border-primary/40 bg-primary/10 text-primary'
                        }`}
                      >
                        {hint.otherUserPhotoURL ? (
                          <img
                            src={hint.otherUserPhotoURL}
                            alt={hint.otherUserName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}

                        {effectiveUnlocked && (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm">
                            <User className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="truncate text-xs font-bold tracking-[-0.02em]">
                              {hint.place}
                            </h2>

                            <div className="mt-0.5 flex max-w-full items-center gap-1 truncate text-[11px] text-muted-foreground">
                              <User className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">@{displayName}</span>
                              <span className="text-muted-foreground/50">•</span>
                              <span className="shrink-0">{hint.time}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteHint(hint.id)
                            }}
                            aria-label="Yankıyı sil"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>

                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                          {displayMessage}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-border/45 pt-2.5">
                      {isBlocked ? (
                        iBlockedThem ? (
                          <span className="block text-[11px] leading-relaxed text-muted-foreground">
                            Bu kişiyi engellediniz. Engeli kaldırmak için Ayarlar'a gidin.
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-red-500">
                            Bu kullanıcı tarafından engellendiniz
                          </span>
                        )
                      ) : isAlreadyMatched ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-1 items-center justify-center gap-1 text-[11px] font-bold text-primary">
                            <span>Eşleştirildiniz</span>
                            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-primary text-primary">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openChat()
                            }}
                            className="flex items-center justify-center gap-1 rounded-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_0_15px_rgba(168,85,247,0.2)] transition hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <Sparkles className="h-3 w-3" />
                            Sohbeti aç
                          </button>
                        </div>
                      ) : effectiveUnlocked ? (
                        effectiveStatus === 'accepted' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const otherUserId = hint.users?.find((uid) => uid !== currentUser?.uid)
                              if (otherUserId && currentUser) {
                                const chatId = existingChatId || [currentUser.uid, otherUserId].sort().join('_')
                                if (onOpenChat) onOpenChat(chatId)
                              }
                            }}
                            className="flex w-full items-center justify-center gap-1 rounded-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_0_15px_rgba(168,85,247,0.18)] transition hover:scale-[1.01] active:scale-[0.99]"
                          >
                            <Sparkles className="h-3 w-3" />
                            {t('goToChat')}
                          </button>
                        ) : effectiveStatus === 'rejected' && isMyRequest ? (
                          <span className="block text-center text-[11px] font-semibold text-red-500">
                            <X className="mr-1 inline h-3 w-3" />
                            {t('userRejected')}
                          </span>
                        ) : isTargetUser ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAcceptRequest(hint)
                              }}
                              className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-500 transition hover:bg-emerald-500/25"
                            >
                              <Check className="h-3 w-3" />
                              {t('acceptLabel')}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRejectRequest(hint)
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/10 text-red-500 transition hover:bg-red-500/20"
                              aria-label={t('rejectLabel')}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : isMyRequest ? (
                          <div className="rounded-full bg-primary/10 px-2.5 py-1.5 text-center text-[11px] font-semibold text-primary">
                            {t('requestSent')}
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSendRequest(hint)
                            }}
                            className="flex w-full items-center justify-center gap-1 rounded-full bg-gradient-to-r from-primary/20 to-fuchsia-500/15 px-3 py-1.5 text-[11px] font-bold text-primary transition hover:from-primary/30 hover:to-fuchsia-500/20"
                          >
                            <Sparkles className="h-3 w-3" />
                            {t('sendChatRequest')}
                          </button>
                        )
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <EncounterDots count={effectiveEncounter} />
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {effectiveEncounter >= 2
                                ? `${effectiveEncounter}. kez kesiştiniz`
                                : 'İlk kesişmeniz'}
                            </span>
                          </div>
                          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {t('encountersLeft', { count: Math.max(0, 3 - effectiveEncounter) })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center gap-3 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                      {hint.otherUserPhotoURL ? (
                        <img
                          src={hint.otherUserPhotoURL}
                          alt={hint.otherUserName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate text-xs font-bold tracking-[-0.015em]">
                            {hint.place}
                          </h2>
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            @{displayName}
                            <span className="mx-1 text-muted-foreground/45">•</span>
                            {hint.time}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteHint(hint.id)
                          }}
                          aria-label="Yankıyı sil"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        {isAlreadyMatched || effectiveUnlocked || effectiveStatus === 'accepted'
                          ? 'Radar ekranında kesiştiniz.'
                          : hint.cachedCreativeMessage}
                      </p>
                    </div>

                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                      <Icon className="h-3 w-3" />
                    </div>
                  </div>
                )}
              </article>
            )
          })
        )}
      </div>

      {/* Nasıl Çalışır Pop-up */}
      {showHowItWorks && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xs rounded-[24px] border border-border/75 bg-card/95 p-5 text-left shadow-2xl backdrop-blur-xl animate-rise">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2 font-bold text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Pulbi Yankılar Ekranı</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground">
              Günlük hayatınızda diğer Pulbi kullanıcılarıyla aynı mekanlarda veya konumlarda yollarınız kesiştiğinde, sistem bunu anonim olarak algılar ve kaydeder. Bir kullanıcıyla kesişme sayınız 3'e ulaştığında, o kişiye ait profil kilidi açılır. Kilit açıldıktan sonra karşı tarafa sohbet isteği gönderebilirsiniz. Gönderdiğiniz bu isteği karşı taraf kabul ettiği takdirde, doğrudan sohbet etmeye başlayabilirsiniz.
            </p>

            <button
              type="button"
              onClick={() => setShowHowItWorks(false)}
              className="mt-5 w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
            >
              Anladım
            </button>
          </div>
        </div>
      )}

      {/* Bugünkü Yankılar Modal */}
      {activeInfoModal === 'today' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xs rounded-[24px] border border-border/75 bg-card/95 p-5 text-left shadow-2xl backdrop-blur-xl animate-rise">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2 font-bold text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Bugünkü Yankılar</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground">
              Bugün içerisinde yollarınızın kesiştiği toplam farklı konum ve yankı sayısını gösterir. Gün içinde karşılaştığınız tüm anonim temasları buradan takip edebilirsiniz.
            </p>

            <button
              type="button"
              onClick={() => setActiveInfoModal(null)}
              className="mt-5 w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
            >
              Anladım
            </button>
          </div>
        </div>
      )}

      {/* Tekrar Kesişme Modal */}
      {activeInfoModal === 'repeat' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xs rounded-[24px] border border-border/75 bg-card/95 p-5 text-left shadow-2xl backdrop-blur-xl animate-rise">
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2 font-bold text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Tekrar Kesişme</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground">
              Daha önce yollarınızın kesiştiği kişilerle, yeniden aynı konumlarda veya mekanlarda birden fazla kez (1'den fazla) karşılaştığınız toplam etkileşim sayısını ifade eder.
            </p>

            <button
              type="button"
              onClick={() => setActiveInfoModal(null)}
              className="mt-5 w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
            >
              Anladım
            </button>
          </div>
        </div>
      )}

      {/* Block confirmation modal */}
      {blockModalHint && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xs rounded-[24px] border border-border/70 bg-card/95 p-5 text-center shadow-2xl backdrop-blur-xl animate-rise">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold">{t('blockUserTitle')}</h3>
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
              {t('blockUserDesc')}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setBlockModalHint(null)}
                className="flex-1 rounded-xl bg-muted py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/80"
              >
                {t('cancelLine') || 'İptal'}
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-xs font-semibold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600"
              >
                {t('blockLabel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}