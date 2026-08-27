'use client'

import { useState, useEffect, useRef } from 'react'
import { BottomNav, type TabKey } from '@/components/pulbi/bottom-nav'
import { AuthScreen } from '@/components/pulbi/screens/auth-screen'
import { CapsulesScreen } from '@/components/pulbi/screens/capsules-screen'
import { ChatScreen } from '@/components/pulbi/screens/chat-screen'
import { HintsScreen } from '@/components/pulbi/screens/hints-screen'
import { ProfileScreen } from '@/components/pulbi/screens/profile-screen'
import { RadarScreen } from '@/components/pulbi/screens/radar-screen'
import { SettingsScreen } from '@/components/pulbi/screens/settings-screen'
import { SplashScreen } from '@/components/pulbi/screens/splash-screen'
import { LocationPermissionModal } from '@/components/ui/location-permission-modal'
import { auth, db } from '@/lib/firebase'
import { calculateDistanceMeters, isPointInsideSafeZone, type SafeZone } from '@/lib/capsules'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
  increment,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { geohashForLocation } from 'geofire-common'
import { Geolocation } from '@capacitor/geolocation'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
const SPARK_REQUEST_TIMEOUT_MS = 30 * 1000

// Runtime-friendly storage wrapper:
const StorageImpl = {
  async get(options: { key: string }) {
    const { key } = options
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor && (window as any).Capacitor.Plugins && (window as any).Capacitor.Plugins.Storage) {
        return await (window as any).Capacitor.Plugins.Storage.get({ key })
      }
    } catch (e) {}

    if (typeof window !== 'undefined' && window.localStorage) {
      return { value: window.localStorage.getItem(key) }
    }

    return { value: null }
  },
  async set(options: { key: string; value: string }) {
    const { key, value } = options
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor && (window as any).Capacitor.Plugins && (window as any).Capacitor.Plugins.Storage) {
        return await (window as any).Capacitor.Plugins.Storage.set({ key, value })
      }
    } catch (e) {}

    if (typeof window !== 'undefined' && window.localStorage) {
      try { window.localStorage.setItem(key, value) } catch (e) {}
    }
  }
}

const Storage = StorageImpl

type Phase = 'splash' | 'auth' | 'app'

async function getRealPlaceName(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'PulbiApp/1.0',
        },
      }
    )

    const data = await response.json()

    if (data && data.address) {
      const road =
        data.address.road ||
        data.address.pedestrian ||
        data.address.suburb ||
        ''

      const suburb =
        data.address.neighbourhood ||
        data.address.district ||
        ''

      if (road && suburb) {
        return `${suburb} - ${road}`
      } else if (road) {
        return road
      } else if (data.display_name) {
        return data.display_name.split(',')[0]
      }
    }

    return 'Merkezi Konum'
  } catch (error) {
    console.error('Mekan adı çözümlenirken hata:', error)
    return 'Yakın Çevre Kesişmesi'
  }
}

export function PulbiApp({
  initialPhase = 'splash',
}: {
  initialPhase?: Phase
}) {
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [splashStep, setSplashStep] = useState(0)
  const [tab, setTab] = useState<TabKey>('radar')
  const [showProfile, setShowProfile] = useState(false)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [instantEnabled, setInstantEnabled] = useState(true)
  
  // Başlangıç durumunu doğrudan localStorage senkron kontrolüyle başlatıyoruz
  const [locationPermissionState, setLocationPermissionState] = useState<
    'pending' | 'granted' | 'denied'
  >(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('locationPermissionAccepted') === 'true') {
      return 'granted'
    }
    return 'pending'
  })

  // GLOBAL SPARK STATE'LERİ
  const [incomingSpark, setIncomingSpark] = useState<{
    id: string
    fromUserId: string
    fromUserName: string
    rejectCount: number
    timestamp: number
  } | null>(null)
  const [incomingSparkProgress, setIncomingSparkProgress] = useState(100)
  const [sparkBlockPrompt, setSparkBlockPrompt] = useState<{
    requestId: string
    userId: string
    userName: string
  } | null>(null)
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])
  const blockedUsersRef = useRef<string[]>([])

  useEffect(() => {
    blockedUsersRef.current = blockedUsers
  }, [blockedUsers])

  const lastSavedLocationRef = useRef<{
    lat: number
    lng: number
    time: number
  } | null>(null)
  const lastFirestoreWriteRef = useRef<{
    lat: number
    lng: number
    time: number
  } | null>(null)

  const goToTab = (newTab: TabKey) => {
    if (
      (newTab === 'radar' || newTab === 'hints') &&
      !instantEnabled
    ) {
      return
    }

    if (newTab === 'chat' && tab !== 'chat') {
      setActiveChatId(null)
    }

    setShowProfile(false)
    setProfileUserId(null)
    setTab(newTab)
  }

  const openChat = (chatId: string) => {
    setActiveChatId(chatId)
    setTab('chat')
  }

  const openUserProfile = (userId?: any) => {
    let id: string | null = null

    if (typeof userId === 'string') {
      id = userId
    } else if (
      userId &&
      typeof userId === 'object' &&
      typeof userId.id === 'string'
    ) {
      id = userId.id
    }

    setProfileUserId(id)
    setShowProfile(true)
  }

  const closeProfile = () => {
    setShowProfile(false)
    setProfileUserId(null)
  }

  const syncLiveLocationToFirestore = async (lat: number, lng: number, isHeartbeat = false) => {
    const currentUser = auth.currentUser
    if (!currentUser) return

    const now = Date.now()
    const lastWrite = lastFirestoreWriteRef.current

    // Eğer bu sadece periyodik bir sinyal (heartbeat) ise ve son 2 dakika içinde
    // zaten yazma yapıldıysa, sadece timestamp'i güncelle ve çık (veritabanını yormaz).
    if (isHeartbeat && lastWrite && (now - lastWrite.time < 120000)) {
      try {
        await updateDoc(doc(db, 'active_sparks', currentUser.uid), {
          timestamp: serverTimestamp(),
        })
      } catch (e) {}
      return
    }

    try {
      const userSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(() => null)
      const userData = userSnap?.exists() ? userSnap.data() : {}
      const blockedUsersList = Array.isArray(userData?.blockedUsers) ? userData.blockedUsers : []
      const safeZonesSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'safeZones'))
      const safeZones = safeZonesSnapshot.docs
        .map((zoneDoc) => zoneDoc.data())
        .filter(
          (zone): zone is SafeZone =>
            typeof zone.lat === 'number' &&
            typeof zone.lng === 'number' &&
            typeof zone.radius === 'number'
        )

      if (isPointInsideSafeZone(lat, lng, safeZones)) {
        await deleteDoc(doc(db, 'active_sparks', currentUser.uid)).catch(() => undefined)
        lastFirestoreWriteRef.current = { lat, lng, time: now }
        return
      }

      if (userData?.isGhostMode) {
        await deleteDoc(doc(db, 'active_sparks', currentUser.uid)).catch(() => undefined)
        lastFirestoreWriteRef.current = { lat, lng, time: now }
        return
      }

      if (!isHeartbeat) {
        await setDoc(
          doc(db, 'users', currentUser.uid),
          {
            lat,
            lng,
            currentLocation: {
              lat,
              lng,
              updatedAt: serverTimestamp(),
            },
          },
          { merge: true }
        )
      }

      await setDoc(
        doc(db, 'active_sparks', currentUser.uid),
        {
          userId: currentUser.uid,
          userName:
            currentUser.displayName ||
            currentUser.email?.split('@')[0] ||
            'Pulbi Kullanıcısı',
          photoURL: currentUser.photoURL || userData?.photoURL || null,
          lat,
          lng,
          hash: geohashForLocation([lat, lng]),
          blockedUsers: blockedUsersList,
          isGhostMode: false,
          timestamp: serverTimestamp(),
        },
        { merge: true }
      )

      lastSavedLocationRef.current = { lat, lng, time: now }
      lastFirestoreWriteRef.current = { lat, lng, time: now }
    } catch (error) {
      console.error('Canlı konum senkronizasyonu başarısız oldu:', error)
    }
  }

  // Konum alınmadan ve kaydedilmeden asla geçilmeyecek yapı
  const saveInitialLocationWithCoords = async (lat: number, lng: number) => {
    const currentUser = auth.currentUser
    if (!currentUser) return

    const now = Date.now()

    const userSnap = await getDoc(doc(db, 'users', currentUser.uid)).catch(
      () => null
    )
    const userData = userSnap?.exists() ? userSnap.data() : {}

    if (userData?.blockedUsers) {
      setBlockedUsers(userData.blockedUsers)
    }

    await syncLiveLocationToFirestore(lat, lng)

    lastSavedLocationRef.current = {
      lat,
      lng,
      time: now,
    }
  }

  const handleLocationPermissionGrant = async () => {
    try {
      // Önce izin isteyelim
      await Geolocation.requestPermissions().catch(() => null)

      // Kesinlikle GPS'ten koordinat gelmesini bekliyoruz, gelmezse catch bloğuna düşer ve modal kapanmaz
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      })

      const lat = pos.coords.latitude
      const lng = pos.coords.longitude

      if (lat && lng) {
        await saveInitialLocationWithCoords(lat, lng)
        setLocationPermissionState('granted')
        try {
          await Storage.set({ key: 'locationPermissionAccepted', value: 'true' })
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('locationPermissionAccepted', 'true')
          }
        } catch (e) {}
      } else {
        throw new Error('Geçerli koordinat alınamadı')
      }
    } catch (error) {
      console.error('Konum alınamadı:', error)
      alert('Konum alınamadı! Uygulamanın çalışması için konum izni ve GPS bağlantısı zorunludur. Lütfen cihazınızın konum servislerini açıp tekrar deneyin.')
      // Modalı kapatmıyoruz, pending olarak bırakıyoruz ki kullanıcı tekrar denesin.
    }
  }

  const handleLocationPermissionReject = () => {
    alert('Pulbi, konum tabanlı bir deneyim sunduğu için konum izni olmadan kullanılamaz.')
    setLocationPermissionState('denied')
  }

  // Mount anında depolama kontrolü
  useEffect(() => {
    let mounted = true
    const loadPersisted = async () => {
      try {
        const res = await Storage.get({ key: 'locationPermissionAccepted' })
        if (!mounted) return
        if (res && res.value === 'true') {
          setLocationPermissionState('granted')

          try {
            const currentUser = auth.currentUser
            if (currentUser) {
              const userSnap = await getDoc(doc(db, 'users', currentUser.uid))
              if (userSnap.exists() && userSnap.data()?.lat) {
                return
              }
            }

            const perm = await Geolocation.checkPermissions().catch(() => null)
            const hasPerm = perm?.location === 'granted' || perm?.coarseLocation === 'granted'
            if (hasPerm) {
              const pos = await Geolocation.getCurrentPosition({ timeout: 10000 }).catch(() => null)
              if (pos?.coords) {
                await saveInitialLocationWithCoords(pos.coords.latitude, pos.coords.longitude)
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    void loadPersisted()
    return () => { mounted = false }
  }, [])

  // =========================================================
  // GLOBAL SPARK İSTEKLERİNİ DİNLE
  // =========================================================
  useEffect(() => {
    if (phase !== 'app') return

    let unsubscribe: (() => void) | undefined
    let mounted = true

    const setupListener = (currentUser: typeof auth.currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!mounted) return
      setIncomingSpark(null)

      if (!currentUser) return

      const q = query(
        collection(db, 'spark_requests'),
        where('to', '==', currentUser.uid),
        where('status', '==', 'pending')
      )

      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!auth.currentUser || !mounted) return
        if (snapshot.empty) {
          setIncomingSpark(null)
          return
        }

        let foundValid = false
        const blockedSet = new Set(blockedUsersRef.current)

        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          if (!auth.currentUser || !mounted) return
          if (blockedSet.has(data.from)) return

          const requestTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now()
          const now = Date.now()
          const thirtySeconds = SPARK_REQUEST_TIMEOUT_MS

          if (now - requestTime < thirtySeconds) {
            setIncomingSpark({
              id: docSnap.id,
              fromUserId: data.from,
              fromUserName: data.fromUserName || 'Bir kullanıcı',
              rejectCount: typeof data.rejectCount === 'number' ? data.rejectCount : 0,
              timestamp: requestTime,
            })
            foundValid = true
          } else {
            void deleteDoc(doc(db, 'spark_requests', docSnap.id)).catch((error) => {
              console.warn('Süresi dolan gelen Spark isteği silinemedi:', error)
            })
          }
        })

        if (!foundValid) {
          setIncomingSpark(null)
        }
      }, () => {})
    }

    const authUnsub = onAuthStateChanged(auth, setupListener)
    return () => {
      mounted = false
      authUnsub()
      unsubscribe?.()
    }
  }, [phase])

  useEffect(() => {
    if (!incomingSpark) {
      setIncomingSparkProgress(100)
      return
    }

    const updateProgress = () => {
      const remaining = Math.max(
        0,
        100 - ((Date.now() - incomingSpark.timestamp) / SPARK_REQUEST_TIMEOUT_MS) * 100
      )
      setIncomingSparkProgress(remaining)

      if (remaining <= 0) {
        void deleteDoc(doc(db, 'spark_requests', incomingSpark.id)).catch((error) => {
          console.warn('Süresi dolan gelen Spark isteği silinemedi:', error)
        })
        setIncomingSpark(null)
      }
    }

    updateProgress()
    const interval = setInterval(updateProgress, 100)
    return () => clearInterval(interval)
  }, [incomingSpark])

  const handleAcceptSpark = async () => {
    if (!incomingSpark) return
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const chatId = [currentUser.uid, incomingSpark.fromUserId].sort().join('_')
      const currentUserName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Pulbi Kullanıcısı'

      await setDoc(
        doc(db, 'chats', chatId),
        {
          participants: [currentUser.uid, incomingSpark.fromUserId],
          participantNames: {
            [currentUser.uid]: currentUserName,
            [incomingSpark.fromUserId]: incomingSpark.fromUserName,
          },
          createdAt: serverTimestamp(),
          lastMessage: 'Göz göze geldiniz ve sohbet başladı!',
          lastMessageTime: serverTimestamp(),
          hiddenFor: [],
        },
        { merge: true }
      )

      await updateDoc(doc(db, 'spark_requests', incomingSpark.id), {
        status: 'accepted',
        chatRoomId: chatId,
      })

      setIncomingSpark(null)
      openChat(chatId)
    } catch (error) {
      console.error('Spark kabul edilirken hata:', error)
    }
  }

  const handleRejectSpark = async () => {
    if (!incomingSpark) return
    const rejectedSpark = incomingSpark
    try {
      const nextRejectCount = rejectedSpark.rejectCount + 1
      await updateDoc(doc(db, 'spark_requests', rejectedSpark.id), {
        status: 'rejected',
        rejectCount: increment(1),
      })
      setIncomingSpark(null)
    } catch (error) {
      console.error('Spark reddedilirken hata:', error)
    }
  }

  const handleBlockAndRejectSpark = async () => {
    const target = sparkBlockPrompt ?? (incomingSpark && {
      requestId: incomingSpark.id,
      userId: incomingSpark.fromUserId,
      userName: incomingSpark.fromUserName,
    })
    if (!target) return
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        { blockedUsers: arrayUnion(target.userId) },
        { merge: true }
      )
      await updateDoc(doc(db, 'spark_requests', target.requestId), {
        status: 'blocked',
        blockedBy: currentUser.uid,
      })
      setBlockedUsers((previous) =>
        previous.includes(target.userId)
          ? previous
          : [...previous, target.userId]
      )
      setIncomingSpark(null)
      setSparkBlockPrompt(null)
    } catch (error) {
      console.error('Spark engellenirken hata:', error)
    }
  }

  // =========================================================
  // INSTANT DURUMUNU DİNLE
  // =========================================================
  useEffect(() => {
    if (phase !== 'app') return

    let unsubscribe: (() => void) | undefined

    const handleAuth = (currentUser: typeof auth.currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser) {
        setBlockedUsers([])
        setInstantEnabled(true)
        return
      }

      const userDocRef = doc(db, 'users', currentUser.uid)

      unsubscribe = onSnapshot(userDocRef, (snapshot) => {
        if (!auth.currentUser) return
        try {
          const data = snapshot.data()
          if (!data) return

          if (data.blockedUsers) {
            setBlockedUsers(data.blockedUsers)
          }

          setInstantEnabled(
            typeof data.instant === 'boolean'
              ? data.instant
              : true
          )
        } catch (e) {}
      }, () => {})
    }

    const authUnsub = onAuthStateChanged(auth, handleAuth)
    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, [phase])

  useEffect(() => {
    if (
      !instantEnabled &&
      (tab === 'radar' || tab === 'hints')
    ) {
      setTab('capsules')
    }
  }, [instantEnabled, tab])

  // =========================================================
  // GÜNCELLENDİ: 100 METRE HAREKET BAZLI KONTROL & OTOMATİK GÖRÜNÜR OLMA
  // =========================================================
  useEffect(() => {
    if (phase !== 'app') return
    if (locationPermissionState !== 'granted') return

    let nativeWatcherId: string | null = null
    let browserWatchId: number | null = null

    const handleNewCoordinates = async (lat: number, lng: number) => {
      const currentUser = auth.currentUser
      if (!currentUser) return

      await syncLiveLocationToFirestore(lat, lng)

      try {
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)
        const userData = userSnap.exists() ? userSnap.data() : {}

      } catch (e) {
        console.error('Safe zone kontrol hatası:', e)
      }
    }

    if (Capacitor.isNativePlatform()) {
      ;(async () => {
        try {
          nativeWatcherId = await BackgroundGeolocation.addWatcher(
            {
              backgroundMessage: 'Pulbi konumu arka planda güncelleniyor...',
              backgroundTitle: 'Pulbi',
              requestPermissions: true,
              stale: false,
              distanceFilter: 100,
            },
            async (location: any, error: any) => {
              if (error || !location) return
              await handleNewCoordinates(location.latitude, location.longitude)
            }
          )
        } catch (e) {
          console.warn('Arka plan konum takibi başlatılamadı:', e)
        }
      })()
    } else if ('geolocation' in navigator) {
      browserWatchId = navigator.geolocation.watchPosition(
        async (pos) => {
          await handleNewCoordinates(pos.coords.latitude, pos.coords.longitude)
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
      )
    }

    return () => {
      if (browserWatchId !== null) {
        navigator.geolocation.clearWatch(browserWatchId)
      }
      if (nativeWatcherId) {
        BackgroundGeolocation.removeWatcher({ id: nativeWatcherId }).catch(() => undefined)
      }
    }
  }, [phase, locationPermissionState])

  // =========================================================
  // PERİYODİK HAFİF SİNYAL (HEARTBEAT) DÖNGÜSÜ
  // =========================================================
  useEffect(() => {
    if (phase !== 'app' || locationPermissionState !== 'granted') return

    const interval = setInterval(() => {
      if (lastSavedLocationRef.current) {
        const { lat, lng } = lastSavedLocationRef.current
        void syncLiveLocationToFirestore(lat, lng, true) // true = heartbeat sinyali
      }
    }, 120000) // Her 2 dakikada bir

    return () => clearInterval(interval)
  }, [phase, locationPermissionState])

  // =========================================================
  // YASAL ONAYLARI KAYDET
  // =========================================================
  useEffect(() => {
    if (phase !== 'app') return
    if (locationPermissionState !== 'granted') return

    try {
      const currentUser = auth.currentUser
      if (!currentUser) return

      const termsAgreed =
        typeof window !== 'undefined'
          ? localStorage.getItem('termsAgreed')
          : null

      const kvkkAgreed =
        typeof window !== 'undefined'
          ? localStorage.getItem('kvkkAgreed')
          : null

      if (termsAgreed !== 'true' && kvkkAgreed !== 'true') {
        return
      }

      const persistConsent = async () => {
        try {
          const userRef = doc(db, 'users', currentUser.uid)
          const consentPayload: Record<string, unknown> = {}

          if (termsAgreed === 'true') {
            consentPayload.terms = {
              agreed: true,
              at: serverTimestamp(),
              locale: (typeof window !== 'undefined' && localStorage.getItem('locale')) || 'tr',
            }
          }

          if (kvkkAgreed === 'true') {
            consentPayload.kvkk = {
              agreed: true,
              at: serverTimestamp(),
              locale: (typeof window !== 'undefined' && localStorage.getItem('locale')) || 'tr',
            }
          }

          await setDoc(userRef, { consents: consentPayload }, { merge: true })

          try { localStorage.removeItem('termsAgreed') } catch {}
          try { localStorage.removeItem('kvkkAgreed') } catch {}
        } catch (e) {}
      }

      void persistConsent()
    } catch (e) {}
  }, [phase, locationPermissionState])

  // =========================================================
  // YANKILAR (Harekete Duyarlı)
  // =========================================================
  useEffect(() => {
    if (phase !== 'app') return
    if (locationPermissionState !== 'granted') return

    let isChecking = false

    const checkEncounters = async () => {
      if (isChecking) return
      isChecking = true

      const currentUser = auth.currentUser
      if (!currentUser) {
        isChecking = false
        return
      }

      try {
        const pos = await Geolocation.getCurrentPosition().catch(() => null)
        if (!pos?.coords) {
          isChecking = false
          return
        }

        const myLat = pos.coords.latitude
        const myLng = pos.coords.longitude

        const myUserRef = doc(db, 'users', currentUser.uid)
        const myUserSnap = await getDoc(myUserRef)
        const myUserData = myUserSnap.exists() ? myUserSnap.data() : {}
        const myBlockedList = Array.isArray(myUserData.blockedUsers) ? myUserData.blockedUsers : []

        const usersSnap = await getDocs(collection(db, 'users'))
        const activeSparksSnap = await getDocs(collection(db, 'active_sparks'))
        const activeSparkByUserId = new Map<string, { lat: number; lng: number; timestamp?: any; isGhostMode?: boolean }>()

        activeSparksSnap.docs.forEach((sparkDoc) => {
          const sparkData = sparkDoc.data()
          if (
            sparkData?.isGhostMode ||
            typeof sparkData?.lat !== 'number' ||
            typeof sparkData?.lng !== 'number'
          ) {
            return
          }

          activeSparkByUserId.set(sparkDoc.id, {
            lat: sparkData.lat,
            lng: sparkData.lng,
            timestamp: sparkData.timestamp,
            isGhostMode: !!sparkData.isGhostMode,
          })
        })

        for (const userDoc of usersSnap.docs) {
          if (userDoc.id === currentUser.uid) continue

          const userData = userDoc.data()
          const otherBlockedList = Array.isArray(userData.blockedUsers) ? userData.blockedUsers : []

          if (myBlockedList.includes(userDoc.id)) continue
          if (otherBlockedList.includes(currentUser.uid)) continue

          const sparkPosition = activeSparkByUserId.get(userDoc.id)
          const otherLocation = sparkPosition
            ? { lat: sparkPosition.lat, lng: sparkPosition.lng, updatedAt: sparkPosition.timestamp }
            : userData.currentLocation

          if (!otherLocation || typeof otherLocation.lat !== 'number' || typeof otherLocation.lng !== 'number') {
            continue
          }

          const updatedAt = otherLocation.updatedAt || sparkPosition?.timestamp
          if (updatedAt?.toMillis) {
            const locationAge = Date.now() - updatedAt.toMillis()
            if (locationAge > 10 * 60 * 1000) continue
          }

          const distance = calculateDistanceMeters(myLat, myLng, otherLocation.lat, otherLocation.lng)
          if (distance > 200) continue

          const sortedIds = [currentUser.uid, userDoc.id].sort()
          const encounterId = `${sortedIds[0]}_${sortedIds[1]}`
          const encounterRef = doc(db, 'encounters', encounterId)

          const encounterSnap = await getDoc(encounterRef)
          let currentCount = 1

          if (encounterSnap.exists()) {
            const encounterData = encounterSnap.data()
            currentCount = Number(encounterData.count || 1)
            const lastEncounter = encounterData.lastEncounter

            if (lastEncounter?.toMillis) {
              const lastTime = lastEncounter.toMillis()
              const minutesSinceLastEncounter = (Date.now() - lastTime) / 60000

              if (minutesSinceLastEncounter < 10) continue
              currentCount += 1
            }
          }

          const realPlaceName = await getRealPlaceName(myLat, myLng)
          let placeType = 'nature'
          const lowerName = realPlaceName.toLowerCase()

          if (lowerName.includes('kafe') || lowerName.includes('kahve') || lowerName.includes('cafe')) {
            placeType = 'cafe'
          } else if (lowerName.includes('istasyon') || lowerName.includes('köprü') || lowerName.includes('durak')) {
            placeType = 'transport'
          }

          await setDoc(
            encounterRef,
            {
              users: [currentUser.uid, userDoc.id],
              count: currentCount,
              place: realPlaceName,
              type: placeType,
              lastEncounter: serverTimestamp(),
            },
            { merge: true }
          )
        }
      } catch (error) {
        console.error('Yankı tarama hatası:', error)
      } finally {
        isChecking = false
      }
    }

    void checkEncounters()
    const interval = setInterval(() => { void checkEncounters() }, 120000)

    return () => { clearInterval(interval) }
  }, [phase, locationPermissionState])

  const shouldShowLocationPermission =
    phase === 'app' && locationPermissionState !== 'granted'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-0 sm:p-6">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-background sm:h-[860px] sm:max-h-[92vh] sm:w-[400px] sm:rounded-[3rem] sm:border sm:border-border sm:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">

        <div className="pointer-events-none absolute left-1/2 top-2 z-30 hidden h-6 w-32 -translate-x-1/2 rounded-full bg-background sm:block" />

        <div
          className={`relative flex flex-1 flex-col overflow-hidden transition-all duration-200 ${
            shouldShowLocationPermission ? 'blur-[2px] saturate-50' : ''
          }`}
        >

          {phase === 'auth' && (
            <AuthScreen
              onDone={() => setPhase('app')}
            />
          )}

          {phase === 'app' && (
            <>
              <div className="flex-1 overflow-hidden">

                {tab === 'radar' && (
                  <RadarScreen
                    onNavigate={(newTab) =>
                      goToTab(newTab)
                    }
                    onOpenProfile={
                      openUserProfile
                    }
                  />
                )}

                {tab === 'hints' && (
                  <HintsScreen
                    onOpenChat={openChat}
                    onOpenProfile={
                      openUserProfile
                    }
                  />
                )}

                {tab === 'capsules' && (
                  <CapsulesScreen
                    onBack={() =>
                      goToTab('radar')
                    }
                  />
                )}

                {tab === 'chat' && (
                  <ChatScreen
                    chatId={activeChatId}
                    onChatOpenChange={
                      setIsChatOpen
                    }
                    onOpenProfile={
                      openUserProfile
                    }
                  />
                )}

                {tab === 'settings' &&
                  !showProfile && (
                    <SettingsScreen
                      onOpenProfile={
                        openUserProfile
                      }
                    />
                  )}

                {showProfile && (
                  <ProfileScreen
                    key={
                      profileUserId ?? 'own'
                    }
                    userId={
                      profileUserId ??
                      undefined
                    }
                    onBack={closeProfile}
                  />
                )}

              </div>

              {!(
                tab === 'chat' &&
                isChatOpen
              ) && (
                <BottomNav
                  active={tab}
                  onChange={goToTab}
                  instantEnabled={
                    instantEnabled
                  }
                />
              )}
            </>
          )}
        </div>

        {/* ================= GÖZ GÖZE GELDİNİZ MODALI (GLOBAL) ================= */}
        {incomingSpark && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-card border border-border p-6 shadow-2xl text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary animate-pulse text-2xl">
                ⚡
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Göz Göze Geldiniz!
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-semibold text-foreground">{incomingSpark.fromUserName}</span>
                  {' ile yakınlardasınız.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleRejectSpark}
                  className="w-full rounded-xl bg-muted py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Reddet
                </button>
                <button
                  onClick={handleAcceptSpark}
                  className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
                >
                Kabul Et
                </button>
              </div>
              {incomingSpark.rejectCount >= 3 && (
                <button
                onClick={handleBlockAndRejectSpark}
                className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                Bu kişiyi engellemek ister misin?
                </button>
              )}
              <div className="space-y-1.5 pt-1 text-left">
                <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                  <span>İstek süresi</span>
                  <span>{Math.ceil((incomingSparkProgress / 100) * 30)} sn</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-violet-400 to-amber-300 transition-[width] duration-100 ease-linear"
                    style={{ width: `${incomingSparkProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {sparkBlockPrompt && !incomingSpark && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-xs rounded-3xl bg-card border border-border p-6 shadow-2xl text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-2xl">
                🚫
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Bu kişiyi engellemek ister misin?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-semibold text-foreground">{sparkBlockPrompt.userName}</span> sana 3 kez Spark gönderdi ve reddettin.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setSparkBlockPrompt(null)}
                  className="w-full rounded-xl bg-muted py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Hayır
                </button>
                <button
                  onClick={handleBlockAndRejectSpark}
                  className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                  Evet, Engelle
                </button>
              </div>
            </div>
          </div>
        )}

        <LocationPermissionModal
          isOpen={shouldShowLocationPermission}
          onGrant={() => void handleLocationPermissionGrant()}
          onClose={handleLocationPermissionReject}
        />
      </div>
    </main>
  )
}