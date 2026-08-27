'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { PulbiMark } from '@/components/pulbi/logo'
import { useTranslations } from '@/lib/i18n'
import {
  Bell,
  Bluetooth,
  ChevronRight,
  Ghost,
  LogOut,
  MapPinned,
  Plus,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Check,
  X,
  Trash2,
  MapPin,
  Crosshair,
  UserX,
  AlertTriangle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import { signOut, onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc, updateDoc, setDoc, collection, addDoc, onSnapshot, deleteDoc, arrayRemove, serverTimestamp, deleteField, getDocs } from 'firebase/firestore'

type SafeZone = {
  id: string
  name: string
  address: string
  active: boolean
  icon: 'home' | 'work' | 'custom'
  lat?: number | null
  lng?: number | null
  radius: number
}

type BlockedUser = {
  encounterId: string
  blockedUserId: string
  fullName?: string
  avatar?: string
}

type NotificationPrefs = {
  all: boolean
  radarEslenme: boolean     
  yankilarEslenme: boolean  
  radarKesisme: boolean     
  sohbetMesajlari: boolean  
  kapsulOkundu: boolean     
  yakinlardaKapsul: boolean 
}

// Haversine formülü ile iki koordinat arasındaki mesafeyi metre cinsinden hesaplar
function calculateDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Dünya'nın yarıçapı (metre)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Kullanıcının anlık konumu herhangi bir aktif güvenli bölgenin içinde mi kontrol eder
async function checkIfInSafeZone(uid: string, lat: number, lng: number): Promise<boolean> {
  try {
    const zonesRef = collection(db, 'users', uid, 'safeZones');
    const snapshot = await getDocs(zonesRef);
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.active !== false && typeof data.lat === 'number' && typeof data.lng === 'number') {
        const radius = typeof data.radius === 'number' ? data.radius : 100;
        const distance = calculateDistanceInMeters(lat, lng, data.lat, data.lng);
        if (distance <= radius) {
          return true; // Güvenli bölge içinde!
        }
      }
    }
  } catch (e) {
    console.error('Güvenli bölge kontrolü hatası:', e);
  }
  return false;
}

function Toggle({
  on,
  onChange,
  disabled = false,
}: {
  on: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${on ? 'bg-primary' : 'bg-muted/80'}`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function Row({
  icon: Icon,
  title,
  desc,
  accent,
  children,
  onClick,
}: {
  icon: LucideIcon
  title: string
  desc: string
  accent?: boolean
  children?: React.ReactNode
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3.5 px-4 py-3.5 ${onClick ? 'cursor-pointer hover:bg-card/80 transition' : ''}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
          accent ? 'bg-amber/15 text-amber' : 'bg-primary/15 text-primary'
        }`}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  )
}

export function SettingsScreen({
  onOpenProfile,
}: {
  onOpenProfile?: (userId?: string) => void
}) {
  const t = useTranslations()

  const [ghost, setGhost] = useState(false)
  const [bluetooth, setBluetooth] = useState(true)
  
  const [radarAccuracy, setRadarAccuracy] = useState('200m')
  const [echoAccuracy, setEchoAccuracy] = useState('500m')
  const [showAccuracyModal, setShowAccuracyModal] = useState(false)

  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    all: true,
    radarEslenme: true,
    yankilarEslenme: true,
    radarKesisme: true,
    sohbetMesajlari: true,
    kapsulOkundu: true,
    yakinlardaKapsul: true,
  })

  const [safeZones, setSafeZones] = useState<SafeZone[]>([])
  const [showAddZoneModal, setShowAddZoneModal] = useState(false)
  const [newZoneName, setNewZoneName] = useState('')
  const [newZoneAddress, setNewZoneAddress] = useState('')
  const [newZoneRadius, setNewZoneRadius] = useState<number>(100) 
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [showBlockedModal, setShowBlockedModal] = useState(false)

  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locationStep, setLocationStep] = useState<'idle' | 'loading' | 'success'>('idle')

  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  const triggerCustomAlert = (msg: string) => {
    setAlertMessage(msg)
    setShowAlertModal(true)
  }

  const [photoURL, setPhotoURL] = useState<string | null>(null)
  const [fullName, setFullName] = useState(t('defaultUserName'))
  const [logoutStatus, setLogoutStatus] = useState<string | null>(null)

  const unsubBlockedRef = useRef<(() => void) | null>(null)
  const unsubZonesRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function fetchUserData() {
      const uid = auth.currentUser?.uid
      if (!uid) return

      try {
        const userDocRef = doc(db, 'users', uid)
        const userDocSnap = await getDoc(userDocRef)

        if (isCancelled || !auth.currentUser?.uid || auth.currentUser.uid !== uid) return

        if (userDocSnap.exists()) {
          const data = userDocSnap.data()
          if (data.fullName) setFullName(data.fullName)
          if (typeof data.isGhostMode === 'boolean') {
            setGhost(data.isGhostMode)
          }
          if (data.radarAccuracy) setRadarAccuracy(data.radarAccuracy)
          if (data.echoAccuracy) setEchoAccuracy(data.echoAccuracy)
          else if (data.accuracy) setEchoAccuracy(data.accuracy)

          if (data.photoURL) setPhotoURL(data.photoURL)
          if (typeof data.locationEnabled === 'boolean') {
            setBluetooth(data.locationEnabled)
          }
          if (data.notificationPreferences) {
            const np:any = data.notificationPreferences || {}
            setNotificationPrefs({
              all: typeof np.all === 'boolean' ? np.all : true,
              radarEslenme: typeof np.radarEslenme === 'boolean' ? np.radarEslenme : (typeof np.radarMatch === 'boolean' ? np.radarMatch : true),
              yankilarEslenme: typeof np.yankilarEslenme === 'boolean' ? np.yankilarEslenme : (typeof np.yankilarMatch === 'boolean' ? np.yankilarMatch : true),
              radarKesisme: typeof np.radarKesisme === 'boolean' ? np.radarKesisme : (typeof np.radarEncounter === 'boolean' ? np.radarEncounter : true),
              sohbetMesajlari: typeof np.sohbetMesajlari === 'boolean' ? np.sohbetMesajlari : (typeof np.messages === 'boolean' ? np.messages : true),
              kapsulOkundu: typeof np.kapsulOkundu === 'boolean' ? np.kapsulOkundu : (typeof np.capsuleRead === 'boolean' ? np.capsuleRead : true),
              yakinlardaKapsul: typeof np.yakinlardaKapsul === 'boolean' ? np.yakinlardaKapsul : (typeof np.capsuleNearby === 'boolean' ? np.capsuleNearby : true),
            })
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Ayarlar için kullanıcı bilgisi çekilemedi:', error)
        }
      }
    }

    fetchUserData()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    let isMounted = true;

    const authUnsub = onAuthStateChanged(auth, (user: User | null) => {
      if (unsubBlockedRef.current) {
        try { unsubBlockedRef.current() } catch (e) {}
        unsubBlockedRef.current = null;
      }

      if (!user || !user.uid || !isMounted) {
        setBlockedUsers([]);
        return;
      }

      const uid = user.uid

      try {
        const userDocRef = doc(db, 'users', uid);
        unsubBlockedRef.current = onSnapshot(userDocRef, async (userSnap) => {
          if (!isMounted || !auth.currentUser?.uid || auth.currentUser.uid !== uid) return;

          try {
            if (!userSnap.exists()) return;
            const userData = userSnap.data();
            const blockedIds: string[] = userData.blockedUsers || [];

            const list: BlockedUser[] = [];

            for (const blockedId of blockedIds) {
              if (!isMounted || !auth.currentUser?.uid || auth.currentUser.uid !== uid) break;
              let otherName = t('anonymousUser');
              try {
                const otherUserDoc = await getDoc(doc(db, 'users', blockedId));
                if (!isMounted || !auth.currentUser?.uid || auth.currentUser.uid !== uid) break;
                if (otherUserDoc.exists()) {
                  const otherData = otherUserDoc.data();
                  otherName = otherData.fullName || otherData.name || t('anonymousUser');
                }
              } catch (e) {}

              list.push({
                encounterId: blockedId,
                blockedUserId: blockedId,
                fullName: otherName,
              });
            }

            if (isMounted) setBlockedUsers(list);
          } catch (err) {}
        }, (error) => {
          if (error.code === 'permission-denied') return;
        });
      } catch (e) {
        if (isMounted) setBlockedUsers([]);
      }
    });

    return () => {
      isMounted = false;
      if (unsubBlockedRef.current) {
        try { unsubBlockedRef.current() } catch (e) {}
        unsubBlockedRef.current = null;
      }
      authUnsub();
    };
  }, [t]);

  const handleUnblockUser = async (blockedUserId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        blockedUsers: arrayRemove(blockedUserId)
      });
      await updateDoc(doc(db, 'users', blockedUserId), {
        blockedByUsers: arrayRemove(currentUser.uid)
      });
    } catch (error) {
      console.error('Engel kaldırılırken hata oluştu:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const authUnsub = onAuthStateChanged(auth, (user: User | null) => {
      if (unsubZonesRef.current) {
        try { unsubZonesRef.current() } catch (e) {}
        unsubZonesRef.current = null;
      }

      if (!user || !user.uid || !isMounted) {
        setSafeZones([]);
        return;
      }

      const uid = user.uid

      try {
        const zonesRef = collection(db, 'users', uid, 'safeZones');
        unsubZonesRef.current = onSnapshot(zonesRef, (snapshot) => {
          if (!isMounted || !auth.currentUser?.uid || auth.currentUser.uid !== uid) return;

          const zones: SafeZone[] = snapshot.docs.map((docSnap) => {
            const data: any = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name || 'Güvenli Bölge',
              address: data.address || 'GPS Konumu',
              active: typeof data.active === 'boolean' ? data.active : true,
              icon: data.icon || 'custom',
              lat: typeof data.lat === 'number' ? data.lat : null,
              lng: typeof data.lng === 'number' ? data.lng : null,
              radius: typeof data.radius === 'number' ? data.radius : 100,
            };
          });
          if (isMounted) setSafeZones(zones);
        }, (error) => {
          if (error.code === 'permission-denied') return;
        });
      } catch (e) {
        if (isMounted) setSafeZones([]);
      }
    });

    return () => {
      isMounted = false;
      if (unsubZonesRef.current) {
        try { unsubZonesRef.current() } catch (e) {}
        unsubZonesRef.current = null;
      }
      authUnsub();
    };
  }, []);

  const handleGhostChange = async (newGhostState: boolean) => {
    setGhost(newGhostState)
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const userDocRef = doc(db, 'users', currentUser.uid)
      const sparkRef = doc(db, 'active_sparks', currentUser.uid)

      await updateDoc(userDocRef, {
        isGhostMode: newGhostState,
        instant: !newGhostState,
      })

      if (newGhostState) {
        await deleteDoc(sparkRef).catch(() => undefined)
        return
      }

      try {
        const userSnap = await getDoc(userDocRef)
        const userData = userSnap.exists() ? userSnap.data() : {}

        const lat = userData.lat ?? null;
        const lng = userData.lng ?? null;

        const inSafeZone = (lat !== null && lng !== null) ? await checkIfInSafeZone(currentUser.uid, lat, lng) : false;

        if (inSafeZone) {
          await deleteDoc(sparkRef).catch(() => undefined)
        } else {
          await setDoc(sparkRef, {
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Pulbi Kullanıcısı',
            photoURL: currentUser.photoURL || userData.photoURL || null,
            lat,
            lng,
            blockedUsers: userData.blockedUsers || [],
            isGhostMode: false,
            timestamp: serverTimestamp(),
          }, { merge: true })
        }
      } catch (error) {
        console.warn('Ghost mode kapatılırken aktif spark güncellenemedi:', error)
      }
    } catch (error) {
      console.error('Ghost Mode güncellenirken hata oluştu:', error)
    }
  }

  const handleUpdateNotificationPref = async (key: keyof NotificationPrefs, value: boolean) => {
    const currentUser = auth.currentUser
    if (!currentUser) return

    let updated = { ...notificationPrefs, [key]: value } as NotificationPrefs

    if (key === 'all') {
      updated = {
        all: value,
        radarEslenme: value,
        yankilarEslenme: value,
        radarKesisme: value,
        sohbetMesajlari: value,
        kapsulOkundu: value,
        yakinlardaKapsul: value,
      }
    }

    setNotificationPrefs(updated)

    try {
      const userDocRef = doc(db, 'users', currentUser.uid)

      const prefsToWrite: any = {
        all: updated.all,
        radarEslenme: updated.radarEslenme,
        yankilarEslenme: updated.yankilarEslenme,
        radarKesisme: updated.radarKesisme,
        sohbetMesajlari: updated.sohbetMesajlari,
        kapsulOkundu: updated.kapsulOkundu,
        yakinlardaKapsul: updated.yakinlardaKapsul,
        radarMatch: updated.radarEslenme,
        yankilarMatch: updated.yankilarEslenme,
        radarEncounter: updated.radarKesisme,
        messages: updated.sohbetMesajlari,
        capsuleRead: updated.kapsulOkundu,
        capsuleNearby: updated.yakinlardaKapsul,
      }

      const updateData: any = {
        notificationPreferences: prefsToWrite,
      }

      if (updated.all === false) {
        updateData.fcmToken = deleteField();
      }

      await updateDoc(userDocRef, updateData)
    } catch (error) {
      console.error('Bildirim tercihleri güncellenemedi:', error)
    }
  }

  const handleLocationToggle = (newValue: boolean) => {
    if (newValue) {
      setLocationStep('idle');
      setShowLocationModal(true);
    } else {
      executeLocationDisable();
    }
  };

  const executeLocationDisable = async () => {
    setBluetooth(false);
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const sparkRef = doc(db, 'active_sparks', currentUser.uid);
      await updateDoc(userDocRef, { locationEnabled: false });
      await deleteDoc(sparkRef).catch(() => {});
    } catch (error) {
      console.error('Konum ayarı güncellenemedi:', error);
    }
  };

  const confirmLocationPermission = () => {
    if (!navigator.geolocation) {
      triggerCustomAlert('Tarayıcınız konum desteklemiyor.');
      return;
    }

    setLocationStep('loading');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationStep('success');
        setBluetooth(true);
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, { locationEnabled: true, lat, lng });

            // KRİTİK DÜZELTME: Güvenli bölge kontrolünü bekleyip spark kaydını buna göre netleştiriyoruz
            const inSafeZone = await checkIfInSafeZone(currentUser.uid, lat, lng);
            const sparkRef = doc(db, 'active_sparks', currentUser.uid);

            if (inSafeZone || ghost) {
              await deleteDoc(sparkRef).catch(() => {});
            } else {
              const userSnap = await getDoc(userDocRef);
              const userData = userSnap.exists() ? userSnap.data() : {};
              await setDoc(sparkRef, {
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Pulbi Kullanıcısı',
                photoURL: currentUser.photoURL || userData.photoURL || null,
                lat,
                lng,
                blockedUsers: userData.blockedUsers || [],
                isGhostMode: false,
                timestamp: serverTimestamp(),
              }, { merge: true });
            }
          } catch (error) {
            console.error('Konum ayarı veritabanına kaydedilemedi:', error);
          }
        }

        setTimeout(() => {
          setShowLocationModal(false);
          setLocationStep('idle');
        }, 3000);
      },
      () => {
        setLocationStep('idle');
        setBluetooth(false);
        triggerCustomAlert('Konum izni reddedildi veya alınamadı.');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleToggleZone = async (zone: SafeZone) => {
    if (ghost) return
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const updatedStatus = zone.active === true ? false : true
      setSafeZones(prev =>
        prev.map((z) =>
          z.id === zone.id
            ? { ...z, active: updatedStatus }
            : z
        )
      )

      const zoneRef = doc(db, 'users', currentUser.uid, 'safeZones', zone.id)
      await updateDoc(zoneRef, {
        active: updatedStatus,
        updatedAt: serverTimestamp(),
      })

      // Bölge durumu değiştiğinde anlık konumu alıp aktiflik durumunu simüle ederek spark tablosunu güncelliyoruz
      if (navigator.geolocation && bluetooth) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          
          const zonesRef = collection(db, 'users', currentUser.uid, 'safeZones');
          const snapshot = await getDocs(zonesRef);
          let stillInSafeZone = false;

          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const isThisZoneActive = docSnap.id === zone.id ? updatedStatus : (data.active !== false);
            if (isThisZoneActive && typeof data.lat === 'number' && typeof data.lng === 'number') {
              const radius = typeof data.radius === 'number' ? data.radius : 100;
              const distance = calculateDistanceInMeters(lat, lng, data.lat, data.lng);
              if (distance <= radius) {
                stillInSafeZone = true;
                break;
              }
            }
          }

          const sparkRef = doc(db, 'active_sparks', currentUser.uid);
          
          if (stillInSafeZone) {
            await deleteDoc(sparkRef).catch(() => {});
          } else {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userDocRef);
            const userData = userSnap.exists() ? userSnap.data() : {};

            await setDoc(sparkRef, {
              userId: currentUser.uid,
              userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Pulbi Kullanıcısı',
              photoURL: currentUser.photoURL || userData.photoURL || null,
              lat,
              lng,
              blockedUsers: userData.blockedUsers || [],
              isGhostMode: false,
              timestamp: serverTimestamp(),
            }, { merge: true });
          }
        });
      }
    } catch (error) {
      console.error('Bölge durumu güncellenemedi:', error)
    }
  }

  const handleDeleteZone = async (zoneId: string) => {
    if (ghost) return
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'safeZones', zoneId))

      // Bölge silindikten sonra konum başka bir alanda mı diye kontrol edip güncelliyoruz
      if (navigator.geolocation && bluetooth) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const inSafeZone = await checkIfInSafeZone(currentUser.uid, lat, lng);
          const sparkRef = doc(db, 'active_sparks', currentUser.uid);

          if (!inSafeZone && !ghost) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userDocRef);
            const userData = userSnap.exists() ? userSnap.data() : {};

            await setDoc(sparkRef, {
              userId: currentUser.uid,
              userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Pulbi Kullanıcısı',
              photoURL: currentUser.photoURL || userData.photoURL || null,
              lat,
              lng,
              blockedUsers: userData.blockedUsers || [],
              isGhostMode: false,
              timestamp: serverTimestamp(),
            }, { merge: true });
          }
        });
      }
    } catch (error) {
      console.error('Güvenli bölge silinemedi:', error)
    }
  }

  const handleGetMyCurrentLocation = () => {
    if (!bluetooth) {
      triggerCustomAlert('Konum servisi kapalı. Lütfen önce "Bluetooth & Konum" ayarını açın.');
      return;
    }

    if (!navigator.geolocation) {
      triggerCustomAlert(t('browserNoGeolocation'))
      return
    }

    setIsGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setCurrentCoords({ lat, lng })
        setNewZoneAddress(`GPS Konumu: ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        setIsGettingLocation(false)
      },
      () => {
        setIsGettingLocation(false)
        triggerCustomAlert('Konum alınamadı.');
      },
      { enableHighAccuracy: true }
    )
  }

  const handleAddSafeZone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newZoneName.trim()) return

    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const zonesRef = collection(db, 'users', currentUser.uid, 'safeZones')
      await addDoc(zonesRef, {
        name: newZoneName.trim(),
        address: newZoneAddress.trim() || 'GPS Konumu',
        active: true,
        icon: 'custom',
        lat: currentCoords?.lat || null,
        lng: currentCoords?.lng || null,
        radius: newZoneRadius,
        createdAt: serverTimestamp(),
      })

      // Yeni güvenli bölge eklendiğinde kullanıcı oradaysa radardan hemen düşmesini sağla
      if (currentCoords) {
        const inSafeZoneNow = await checkIfInSafeZone(currentUser.uid, currentCoords.lat, currentCoords.lng);
        if (inSafeZoneNow) {
          const sparkRef = doc(db, 'active_sparks', currentUser.uid);
          await deleteDoc(sparkRef).catch(() => {});
        }
      }

      setNewZoneName('')
      setNewZoneAddress('')
      setNewZoneRadius(100)
      setCurrentCoords(null)
      setShowAddZoneModal(false)
    } catch (error) {
      console.error('Güvenli bölge eklenirken hata:', error)
    }
  }

  const handleRadarAccuracyChange = async (newVal: string) => {
    setRadarAccuracy(newVal)
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const userDocRef = doc(db, 'users', currentUser.uid)
      await updateDoc(userDocRef, { radarAccuracy: newVal })
    } catch (error) {
      console.error('Radar hassasiyeti güncellenirken hata:', error)
    }
  }

  const handleEchoAccuracyChange = async (newVal: string) => {
    setEchoAccuracy(newVal)
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const userDocRef = doc(db, 'users', currentUser.uid)
      await updateDoc(userDocRef, { echoAccuracy: newVal, accuracy: newVal })
    } catch (error) {
      console.error('Yankılar hassasiyeti güncellenirken hata:', error)
    }
  }

  async function handleLogout() {
    try {
      setLogoutStatus(t('logoutInProgress'))

      if (unsubBlockedRef.current) {
        try { unsubBlockedRef.current(); } catch (e) {}
        unsubBlockedRef.current = null;
      }
      if (unsubZonesRef.current) {
        try { unsubZonesRef.current(); } catch (e) {}
        unsubZonesRef.current = null;
      }

      setSafeZones([])
      setBlockedUsers([])

      const currentUser = auth.currentUser
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid)
        const sparkRef = doc(db, 'active_sparks', currentUser.uid)

        await Promise.all([
          updateDoc(userDocRef, {
            locationEnabled: false,
            lastSeen: serverTimestamp(),
          }).catch(() => {}),
          deleteDoc(sparkRef).catch(() => {}),
        ])
      }

      await signOut(auth)

      setLogoutStatus(t('logoutDone'))
      await new Promise((resolve) => setTimeout(resolve, 300))
    } catch (error) {
      console.error('Çıkış yapılırken hata oluştu:', error)
      setLogoutStatus(null)
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      {logoutStatus && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md transition-all">
          <div className="flex flex-col items-center space-y-3">
            {logoutStatus.includes('yapılıyor') ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="h-8 w-8 text-primary animate-bounce" />
            )}
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {logoutStatus}
            </p>
          </div>
        </div>
      )}
      <div className="px-6 pt-14 pb-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('settingsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settingsSubtitle')}
        </p>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-28 pt-4 [padding-bottom:calc(4.5rem+env(safe-area-inset-bottom))]">
        
       <div>
         <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
           {t('account')}
         </p>
         <div className="overflow-hidden rounded-3xl border border-border bg-card/60">
           <button
             type="button"
             onClick={() => onOpenProfile?.()}
             className="flex w-full items-center gap-3.5 p-3.5 text-left transition active:scale-[0.99]"
           >
             <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-primary/40 bg-slate-950/5">
               {photoURL ? (
                 <Image
                   src={photoURL}
                   alt="Profil fotoğrafı"
                   fill
                   sizes="56px"
                   className="object-cover"
                 />
               ) : (
                 <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                   <PulbiMark className="h-8 w-8" />
                 </div>
               )}
             </div>
             <div className="min-w-0 flex-1 leading-tight">
               <p className="text-sm font-semibold">{fullName}</p>
               <p className="mt-0.5 text-xs text-muted-foreground">
                 {t('profileSubtitle')}
               </p>
             </div>
             <ChevronRight className="h-4 w-4 text-muted-foreground" />
           </button>
           <div className="border-t border-border/60 px-4 py-3">
             <button
               type="button"
               onClick={handleLogout}
               disabled={Boolean(logoutStatus)}
               className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground transition active:scale-[0.99] disabled:opacity-50"
             >
               <LogOut className="h-4 w-4" />
               {t('logout')}
             </button>
           </div>
         </div>
       </div>

       <div>
         <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
           {t('privacyAndSecurity')}
         </p>
         
         <div
           className={`rounded-3xl border p-4 mb-4 transition-all duration-300 ${
             ghost
               ? 'border-primary/50 bg-primary/[0.08]'
               : 'border-border bg-card/60'
           }`}
         >
           <div className="flex items-center gap-3.5">
             <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
               <Ghost className="h-4.5 w-4.5" />
             </div>
             <div className="min-w-0 flex-1 leading-tight">
               <p className="text-sm font-semibold">{t('ghostModeTitle')}</p>
               <p className="mt-0.5 text-xs text-muted-foreground">
                 {t('ghostModeDesc')}
               </p>
             </div>
             <Toggle on={ghost} onChange={handleGhostChange} />
           </div>
           {ghost && (
             <p className="mt-3 rounded-2xl bg-background/50 px-3 py-2 text-[11px] text-muted-foreground animate-rise">
               {t('ghostModeActive')} — {t('instantStatusDesc')} otomatik olarak devre dışı bırakıldı.
             </p>
           )}
         </div>

         <div className={`transition-all duration-300 ${ghost ? 'opacity-40 pointer-events-none filter grayscale-[30%]' : ''}`}>
           <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
             <ShieldCheck className="h-3.5 w-3.5 text-amber" />
             {t('safeZonesTitle')} {ghost && `(${t('ghostModeActive')})`}
           </p>
           <p className="mb-4 px-1 text-[11px] text-muted-foreground">
             {t('safeZonesDesc')}
           </p>

           <div className="space-y-4">
             <div className="rounded-3xl border border-border bg-card/60 overflow-hidden">
               <button
                 type="button"
                 disabled={ghost}
                 onClick={() => setShowAddZoneModal(true)}
                 className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-card"
               >
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground">
                   <Plus className="h-4.5 w-4.5" />
                 </div>
                 <span className="flex-1 text-sm font-medium text-muted-foreground">
                   {t('addSafeZone')}
                 </span>
                 <ChevronRight className="h-4 w-4 text-muted-foreground" />
               </button>
             </div>

             <div>
               <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-foreground/80">
                 {t('safeZonesListTitle')} ({safeZones.length})
               </p>

               <div className="divide-y divide-border rounded-3xl border border-border bg-card/60 overflow-hidden">
                 {safeZones.length === 0 ? (
                   <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                     {t('safeZonesEmpty')}
                   </div>
                 ) : (
                   safeZones.map((zone) => {
                     const isZoneActive = ghost ? false : zone.active !== false
                     const isInactive = !isZoneActive

                     return (
                       <div
                         key={zone.id}
                         className={`flex items-center gap-3.5 px-4 py-3.5 transition-opacity ${isInactive ? 'opacity-55 grayscale-[20%]' : ''}`}
                       >
                         <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber/15 text-amber">
                           <MapPin className="h-4.5 w-4.5" />
                         </div>
                         <div className="min-w-0 flex-1 leading-tight">
                           <div className="flex items-center gap-2">
                             <p className="text-sm font-semibold">{zone.name}</p>
                             <span className="text-[10px] bg-amber/10 text-amber px-1.5 py-0.5 rounded-full font-medium">
                               {zone.radius}m
                             </span>
                           </div>
                           <p className="mt-0.5 truncate text-xs text-muted-foreground">{zone.address}</p>
                         </div>

                         <div className="flex items-center gap-2.5 shrink-0 pl-2">
                           <button
                             type="button"
                             disabled={ghost}
                             onClick={() => handleDeleteZone(zone.id)}
                             className="group flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
                             title={t('removeZone')}
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                           <div className="h-4 w-[1px] bg-border/80" />
                           <Toggle on={isZoneActive} onChange={() => handleToggleZone(zone)} disabled={ghost} />
                         </div>
                       </div>
                     )
                   })
                 )}
               </div>
             </div>
           </div>
         </div>
       </div>

       <div>
         <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
           {t('connectionStatusTitle')}
         </p>
         <div className="divide-y divide-border rounded-3xl border border-border bg-card/60 overflow-hidden">
           
           <Row
             icon={Bell}
             title={t('notifications')}
             desc={t('notificationsDesc')}
             onClick={() => setShowNotificationModal(true)}
           >
             <ChevronRight className="h-4 w-4 text-muted-foreground" />
           </Row>

           <Row
             icon={MapPinned}
             title={t('locationAccuracy')}
             desc={`Radar: ${radarAccuracy} | Yankılar: ${echoAccuracy}`}
             onClick={() => setShowAccuracyModal(true)}
           >
             <ChevronRight className="h-4 w-4 text-muted-foreground" />
           </Row>
           <Row
             icon={UserX}
             title={t('blockedUsersTitle')}
             desc={t('blockedUsers', { count: blockedUsers.length })}
             onClick={() => setShowBlockedModal(true)}
           >
             <ChevronRight className="h-4 w-4 text-muted-foreground" />
           </Row>
           <Row
             icon={bluetooth ? Bluetooth : MapPin}
             title={t('locationStatusTitle')}
             desc={t('locationStatusDesc')}
           >
             <Toggle on={bluetooth} onChange={handleLocationToggle} />
           </Row>
         </div>
       </div>

      </div>

      {showNotificationModal && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fade">
          <div className="relative flex h-[85%] w-full flex-col rounded-t-[32px] border-t border-border bg-card px-6 pt-4 pb-8 animate-rise overflow-hidden shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            
            <div className="flex items-center justify-between pb-4 border-b border-border/50">
              <div>
                <h2 className="text-base font-semibold text-foreground">{t('notificationPreferencesTitle')}</h2>
                <p className="text-xs text-muted-foreground">{t('notificationPreferencesSubtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNotificationModal(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto py-4">
              <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('allNotifications')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('allNotificationsSubtitle')}</p>
                </div>
                <Toggle on={notificationPrefs.all} onChange={(val) => handleUpdateNotificationPref('all', val)} />
              </div>

              <div className="h-[1px] bg-border/40 my-2" />

              <PrefRowCard
                title={t('radarRequestTitle')}
                desc={t('radarRequestDesc')}
                checked={notificationPrefs.radarEslenme && notificationPrefs.all}
                disabled={!notificationPrefs.all}
                onChange={(val) => handleUpdateNotificationPref('radarEslenme', val)}
              />

              <PrefRowCard
                title={t('hintsRequestTitle')}
                desc={t('hintsRequestDesc')}
                checked={notificationPrefs.yankilarEslenme && notificationPrefs.all}
                disabled={!notificationPrefs.all}
                onChange={(val) => handleUpdateNotificationPref('yankilarEslenme', val)}
              />

              <PrefRowCard
                title={t('radarEncounterTitle')}
                desc={t('radarEncounterDesc')}
                checked={notificationPrefs.radarKesisme && notificationPrefs.all}
                disabled={!notificationPrefs.all}
                onChange={(val) => handleUpdateNotificationPref('radarKesisme', val)}
              />

              <PrefRowCard
                title={t('chatMessagesTitle')}
                desc={t('chatMessagesDesc')}
                checked={notificationPrefs.sohbetMesajlari && notificationPrefs.all}
                disabled={!notificationPrefs.all}
                onChange={(val) => handleUpdateNotificationPref('sohbetMesajlari', val)}
              />

              <PrefRowCard
                title={t('capsuleReadTitle')}
                desc={t('capsuleReadDesc')}
                checked={notificationPrefs.kapsulOkundu && notificationPrefs.all}
                disabled={!notificationPrefs.all}
                onChange={(val) => handleUpdateNotificationPref('kapsulOkundu', val)}
              />

              <PrefRowCard
                title={t('capsuleNearbyTitle')}
                desc={t('capsuleNearbyDesc')}
                checked={notificationPrefs.yakinlardaKapsul && notificationPrefs.all}
                disabled={!notificationPrefs.all}
                onChange={(val) => handleUpdateNotificationPref('yakinlardaKapsul', val)}
              />
            </div>
          </div>
        </div>
      )}

      {showLocationModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade">
          <div className="w-full max-w-xs rounded-3xl bg-card border border-border p-6 shadow-2xl text-center animate-rise">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <MapPin className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{t('locationPermissionRequired')}</h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {t('locationPermissionDescription')}
            </p>

            {locationStep === 'loading' && (
              <div className="mt-4 space-y-2 animate-fade">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary animate-pulse w-full rounded-full transition-all duration-500" style={{ animationDuration: '1.2s' }} />
                </div>
                <p className="text-[11px] font-medium text-primary">Konum alınıyor, lütfen bekleyin...</p>
              </div>
            )}

            {locationStep === 'success' && (
              <div className="mt-4 space-y-2 animate-fade">
                <div className="flex items-center justify-center gap-1.5 text-emerald-500 font-semibold text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Konum Alındı</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Birkaç saniye içinde kapanıyor...</p>
              </div>
            )}

            {locationStep === 'idle' && (
              <div className="mt-5 flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationModal(false);
                    setBluetooth(false);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-muted text-muted-foreground font-medium hover:bg-muted/80 transition text-xs"
                >
                  {t('dismissPermission')}
                </button>
                <button
                  type="button"
                  onClick={confirmLocationPermission}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition text-xs shadow-lg shadow-primary/20"
                >
                  {t('allowPermission')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showBlockedModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl animate-rise max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-destructive" />
                <h3 className="text-base font-semibold text-foreground">{t('blockedUsersTitle')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBlockedModal(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto space-y-2 divide-y divide-border/50">
              {blockedUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {t('blockedUsersEmpty')}
                </div>
              ) : (
                blockedUsers.map((user) => (
                  <div key={user.encounterId} className="flex items-center justify-between pt-3 first:pt-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive font-bold text-xs">
                        {user.fullName?.[0]?.toUpperCase() || 'K'}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{user.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">Engelli</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblockUser(user.encounterId)}
                      className="rounded-xl border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition"
                    >
                      {t('unblock')}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 mt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowBlockedModal(false)}
                className="w-full rounded-xl bg-muted py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition"
              >
                {t('closeLabel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddZoneModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-3xl bg-card border border-border p-6 shadow-2xl animate-rise">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">{t('addSafeZone')}</h3>
              <button
                type="button"
                onClick={() => setShowAddZoneModal(false)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddSafeZone} className="space-y-3">
              <div>
                <div className="flex justify-between items-center text-[11px] font-medium text-muted-foreground">
                  <label>{t('zoneNameLabel')}</label>
                  <span>{newZoneName.length}/10</span>
                </div>
                <input
                  type="text"
                  maxLength={10}
                  placeholder={t('zoneNamePlaceholder')}
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">{t('zoneLocationLabel')}</label>
                <button
                  type="button"
                  onClick={handleGetMyCurrentLocation}
                  disabled={isGettingLocation}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition disabled:opacity-50"
                >
                  {isGettingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crosshair className="h-4 w-4" />
                  )}
                  {currentCoords ? t('locationAcquired') : t('makeCurrentLocationSafe')}
                </button>
              </div>

              <div>
                <div className="flex justify-between items-center text-[11px] font-medium text-muted-foreground">
                  <label>{t('addressOrDescription')}</label>
                  <span>{newZoneAddress.length}/30</span>
                </div>
                <input
                  type="text"
                  maxLength={30}
                  placeholder={t('zoneAddressPlaceholder') || 'Örn: Merkez Mah. No:12'}
                  value={newZoneAddress}
                  onChange={(e) => setNewZoneAddress(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Gizlilik Yarıçapı (Metre)</label>
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {[50, 100, 150, 200].map((meters) => (
                    <button
                      key={meters}
                      type="button"
                      onClick={() => setNewZoneRadius(meters)}
                      className={`py-2 rounded-xl text-xs font-semibold transition ${
                        newZoneRadius === meters
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/50 text-foreground hover:bg-muted border border-border/50'
                      }`}
                    >
                      {meters}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddZoneModal(false)}
                  className="flex-1 rounded-xl bg-muted py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition shadow-lg"
                >
                  {t('addSafeZone')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccuracyModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[32px] bg-card border border-border p-6 shadow-2xl animate-rise flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <MapPinned className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Tarama Mesafeleri</h3>
                  <p className="text-[11px] text-muted-foreground">Ekranlara göre özel mesafe sınırları</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAccuracyModal(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto space-y-6 pr-1">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Radar Ekranı</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Maks. 200m</span>
                </div>
                <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
                  Yüz yüze ve yakın mesafe animasyonlu radar taraması için geçerli üst sınır.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {['50m', '100m', '150m', '200m'].map((item) => (
                    <button
                      key={`radar-${item}`}
                      type="button"
                      onClick={() => handleRadarAccuracyChange(item)}
                      className={`flex items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-semibold transition ${
                        radarAccuracy === item
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                          : 'bg-muted/50 text-foreground hover:bg-muted border border-border/50'
                      }`}
                    >
                      <span>{item}</span>
                      {radarAccuracy === item && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[1px] bg-border/60" />

              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-500">Yankılar Ekranı</span>
                  <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-medium">Geniş Alan</span>
                </div>
                <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
                  Çevredeki aktif kişileri arka planda taramak ve geniş alan yakalamak için seçilen mesafe.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {['250m', '300m', '350m', '400m', '450m', '500m'].map((item) => (
                    <button
                      key={`echo-${item}`}
                      type="button"
                      onClick={() => handleEchoAccuracyChange(item)}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs font-semibold transition ${
                        echoAccuracy === item
                          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                          : 'bg-muted/50 text-foreground hover:bg-muted border border-border/50'
                      }`}
                    >
                      <span>{item}</span>
                      {echoAccuracy === item && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-border/50">
              <button
                type="button"
                onClick={() => setShowAccuracyModal(false)}
                className="w-full rounded-2xl bg-muted py-3 text-xs font-semibold text-foreground hover:bg-muted/80 transition"
              >
                Tamamla ve Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {showAlertModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade">
          <div className="w-full max-w-xs rounded-3xl bg-card border border-border p-6 shadow-2xl animate-rise text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Dikkat</h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              {alertMessage}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowAlertModal(false)}
                className="w-full rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground hover:opacity-90 transition shadow-lg shadow-primary/20"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function PrefRowCard({ title, desc, checked, disabled, onChange }: {
  title: string
  desc: string
  checked: boolean
  disabled: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <div className={`flex items-center justify-between rounded-2xl border border-border/60 bg-card/50 p-3.5 transition ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <Toggle on={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}