'use client'

import React, {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  limit,
  query,
  serverTimestamp,
} from 'firebase/firestore'

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  History,
  LocateFixed,
  MapPin,
  Send,
  Trash2,
  X,
} from 'lucide-react'

import { Geolocation } from '@capacitor/geolocation'

import 'maplibre-gl/dist/maplibre-gl.css'

import { auth, db } from '@/lib/firebase'
import { useTranslations } from '@/lib/i18n'

import {
  buildCapsulePayload,
  calculateDistanceMeters,
  DEFAULT_CAPSULE_RADIUS_METERS,
  formatDistance,
  isCapsuleUnlocked,
  type CapsuleRecord,
} from '@/lib/capsules'
import type L from 'leaflet'

type Coordinates = {
  lat: number
  lng: number
}

type CapsulesScreenProps = {
  onBack?: () => void
}

export function CapsulesScreen({ onBack }: CapsulesScreenProps) {
  const t = useTranslations()

  const [capsules, setCapsules] = useState<CapsuleRecord[]>([])
  const [location, setLocation] = useState<Coordinates | null>(null)
  
  // Arka plandaki taze konumu anında tutmak için ref mekanizması
  const lastSavedLocationRef = useRef<Coordinates | null>(null)

  const [selectedCapsuleId, setSelectedCapsuleId] = useState<string | null>(null)
  const [activeClusterIndex, setActiveClusterIndex] = useState(0)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFetchingLocation, setIsFetchingLocation] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showHereBadge, setShowHereBadge] = useState(false)

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const userMarkerRef = useRef<L.Marker | null>(null)
  const badgeTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Firestore'dan kapsülleri çek
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const authUnsub = auth.onAuthStateChanged((currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser) {
        setCapsules([])
        return
      }

      const q = query(collection(db, 'capsules'), orderBy('createdAt', 'desc'), limit(200))
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const records = snapshot.docs.map((docData) => ({ ...(docData.data() as Omit<CapsuleRecord, 'id'>), id: docData.id } as CapsuleRecord))
          setCapsules(records)
        },
        (firestoreError) => {
          console.error('Capsules yüklenirken hata:', firestoreError)
        }
      )
    })

    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, [])

  // İlk konum tespiti
  useEffect(() => {
    if (typeof window === 'undefined') return
    let mounted = true
    void (async () => {
      const coords = await getCurrentCoordinates()
      if (mounted && coords) {
        setLocation(coords)
        lastSavedLocationRef.current = coords
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Konum takibi (WatchPosition) - Arka planda ref ve state'i sürekli günceller
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newCoords = { lat: position.coords.latitude, lng: position.coords.longitude }
        lastSavedLocationRef.current = newCoords
        setLocation(newCoords)
      },
      () => {
        console.warn(t('locationFailed'))
      },
      { enableHighAccuracy: true, maximumAge: 2000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Leaflet Gerçek Haritasını Başlat (Sadece Client Tarafında)
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return

    let isMounted = true

    import('leaflet').then((L) => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      if (!isMounted || !mapContainerRef.current) return

      const initialCenter: [number, number] = location ? [location.lat, location.lng] : [41.0082, 28.9784]

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView(initialCenter, 16)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map

      map.on('click', () => {
        setSelectedCapsuleId(null)
        setActiveClusterIndex(0)
      })
    })

    return () => {
      isMounted = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Konum değiştiğinde haritayı ortala
  useEffect(() => {
    const map = mapInstanceRef.current
    if (map && location && !selectedCapsuleId) {
      map.setView([location.lat, location.lng], map.getZoom())
    }
  }, [location])

  // "Buradasınız" balonunu tetikleme fonksiyonu
  const triggerHereBadge = () => {
    setShowHereBadge(true)
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current)
    badgeTimerRef.current = setTimeout(() => {
      setShowHereBadge(false)
    }, 5000)
  }

  // Kullanıcı ve Kapsül Marker'larını Güncelle
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || typeof window === 'undefined') return

    import('leaflet').then((L) => {
      if (location) {
        const badgeHtml = showHereBadge
          ? `<div style="position:absolute; bottom:38px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.9); backdrop-filter:blur(8px); color:#ffffff; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:600; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2);">Buradasınız</div>`
          : ''

        const userHtml = `
          <div style="position:relative; width:32px; height:32px; cursor:pointer; pointer-events:auto;">
            <div style="position:absolute; inset:-8px; border-radius:999px; background:rgba(56,189,248,0.25); animation:pulse 2s infinite;"></div>
            <div style="width:32px; height:32px; border-radius:999px; background:#0284c7; border:3px solid #ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;">
              <div style="width:10px; height:10px; border-radius:999px; background:#ffffff;"></div>
            </div>
            ${badgeHtml}
          </div>
        `
        const userIcon = L.divIcon({ html: userHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16] })

        if (!userMarkerRef.current) {
          const marker = L.marker([location.lat, location.lng], { icon: userIcon }).addTo(map)
          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e)
            triggerHereBadge()
          })
          userMarkerRef.current = marker
        } else {
          userMarkerRef.current.setIcon(userIcon)
          userMarkerRef.current.setLatLng([location.lat, location.lng])
        }
      }

      const currentZoom = map.getZoom()
      const precision = currentZoom < 10 ? 1 : currentZoom < 14 ? 3 : 5

      const groupedMap: Record<string, CapsuleRecord[]> = {}
      capsules.forEach((capsule) => {
        const key = `${capsule.latitude.toFixed(precision)}_${capsule.longitude.toFixed(precision)}`
        if (!groupedMap[key]) groupedMap[key] = []
        groupedMap[key].push(capsule)
      })

      const existingIds = new Set(Object.keys(markersRef.current))

      Object.entries(groupedMap).forEach(([, groupCapsules]) => {
        const primaryCapsule = groupCapsules[0]
        const id = primaryCapsule.id
        existingIds.delete(id)

        const distance = location ? calculateDistanceMeters(location.lat, location.lng, primaryCapsule.latitude, primaryCapsule.longitude) : Infinity
        const unlocked = groupCapsules.some((c) => isCapsuleUnlocked(distance, c.radius) || c.authorId === auth.currentUser?.uid)
        const isSelected = selectedCapsuleId === id || groupCapsules.some((c) => c.id === selectedCapsuleId)

        const markerColor = unlocked ? '#9333ea' : '#581c87'
        const countBadge = groupCapsules.length > 1 ? `<div style="position:absolute; top:-4px; right:-4px; background:#e11d48; color:#fff; font-size:10px; font-weight:bold; padding:1px 5px; border-radius:999px; border:1.5px solid #fff;">${groupCapsules.length}</div>` : ''

        const capsuleHtml = `
          <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center; transform:${isSelected ? 'scale(1.2)' : 'scale(1)'}; transition:transform 0.2s;">
            <div style="position:absolute; inset:-6px; border-radius:999px; background:${unlocked ? 'rgba(147,51,234,0.3)' : 'rgba(88,28,135,0.2)'}; animation:pulse 2s infinite;"></div>
            <div style="width:28px; height:28px; border-radius:999px; background:${markerColor}; border:2px solid #ffffff; box-shadow:0 6px 16px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;">
              <div style="width:8px; height:8px; border-radius:999px; background:#ffffff;"></div>
            </div>
            ${countBadge}
          </div>
        `

        const icon = L.divIcon({ html: capsuleHtml, className: '', iconSize: [36, 36], iconAnchor: [18, 18] })

        if (!markersRef.current[id]) {
          const marker = L.marker([primaryCapsule.latitude, primaryCapsule.longitude], { icon }).addTo(map)
          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e)
            setSelectedCapsuleId(id)
            setActiveClusterIndex(0)
          })
          markersRef.current[id] = marker
        } else {
          const marker = markersRef.current[id]
          marker.setIcon(icon)
          marker.setLatLng([primaryCapsule.latitude, primaryCapsule.longitude])
        }
      })

      existingIds.forEach((id) => {
        if (markersRef.current[id]) {
          markersRef.current[id].remove()
          delete markersRef.current[id]
        }
      })
    })
  }, [capsules, location, selectedCapsuleId, showHereBadge])

  const openModal = () => setIsCreateModalOpen(true)
  const closeModal = () => setIsCreateModalOpen(false)

  // Butona tıklandığında anında taze konumu yapıştırma ve Güvenlik Ağı (Fallback) mantığı
  const handleFetchCurrentLocation = async () => {
    setIsFetchingLocation(true)
    setError(null)

    // 1. Adım: Elimizde arkadan gelen taze bir konum varsa (ref içinde), GPS'i beklemeden milisaniyesinde yapıştıralım.
    if (lastSavedLocationRef.current) {
      setLocation(lastSavedLocationRef.current)
      setFeedback('Konum başarıyla güncellendi!')
      setTimeout(() => setFeedback(null), 2500)
      setIsFetchingLocation(false)
      return
    }

    // 2. Adım: Güvenlik Ağı (Fallback) - Eğer uygulama yeni açıldıysa ve watcher henüz sinyal düşüremediyse, kısa timeout ile hızlıca tazeleyelim.
    const coords = await getCurrentCoordinates()
    if (coords) {
      lastSavedLocationRef.current = coords
      setLocation(coords)
      setFeedback('Konum başarıyla güncellendi!')
      setTimeout(() => setFeedback(null), 2500)
    } else {
      setError('Konum alınamadı. Lütfen GPS izinlerini kontrol edin.')
    }
    setIsFetchingLocation(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!content.trim()) {
      setError(t('pleaseWriteMessage'))
      return
    }

    const currentUser = auth.currentUser
    if (!currentUser) {
      setError(t('mustSignIn'))
      return
    }

    if (!location) {
      setError(t('liveLocationMissing'))
      return
    }

    try {
      setSubmitting(true)
      const payload = buildCapsulePayload({
        authorId: currentUser.uid,
        authorName: isAnonymous ? t('anonymousUser') : currentUser.displayName || currentUser.email?.split('@')[0] || t('anonymousUser'),
        content: content.trim(),
        latitude: location.lat,
        longitude: location.lng,
        radius: DEFAULT_CAPSULE_RADIUS_METERS,
      })
      await addDoc(collection(db, 'capsules'), { ...payload, createdAt: serverTimestamp() })
      setContent('')
      setIsAnonymous(false)
      setFeedback(t('capsulePosted'))
      closeModal()
    } catch (submitError) {
      console.error('Kapsül gönderme hatası:', submitError)
      setError(t('capsuleError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCapsule = async (capsuleId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Bu kapsülü kalıcı olarak silmek istediğinizden emin misiniz?')) return

    try {
      setDeletingId(capsuleId)
      await deleteDoc(doc(db, 'capsules', capsuleId))
      if (selectedCapsuleId === capsuleId) {
        setSelectedCapsuleId(null)
      }
      setFeedback('Kapsül başarıyla silindi.')
      setTimeout(() => setFeedback(null), 2500)
    } catch (err) {
      console.error('Kapsül silinirken hata:', err)
      setError('Kapsül silinemedi.')
    } finally {
      setDeletingId(null)
    }
  }

  const currentClusterCapsules = useMemo(() => {
    if (!selectedCapsuleId) return []
    const selected = capsules.find((c) => c.id === selectedCapsuleId)
    if (!selected) return []

    const precision = 3
    return capsules.filter(
      (c) =>
        c.latitude.toFixed(precision) === selected.latitude.toFixed(precision) &&
        c.longitude.toFixed(precision) === selected.longitude.toFixed(precision)
    )
  }, [capsules, selectedCapsuleId])

  const activeCapsule = currentClusterCapsules[activeClusterIndex] || currentClusterCapsules[0] || null
  const distanceToActive = location && activeCapsule ? calculateDistanceMeters(location.lat, location.lng, activeCapsule.latitude, activeCapsule.longitude) : null

  const getAuthorDisplay = (authorId: string) => {
    return authorId === auth.currentUser?.uid ? 'Siz' : null
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-white text-slate-900">
      <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />

      {/* Üst Kısım */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-800 backdrop-blur border border-slate-200 shadow-lg transition hover:scale-105"
              aria-label={t('backToRadar')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={openModal}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xl shadow-fuchsia-500/30 border border-white/15 transition hover:scale-105"
          >
            <Send className="h-4 w-4" />
            {t('leaveMemory')}
          </button>
        </div>
      </div>

      {/* Sağ Taraftaki Aksiyon Butonları */}
      <div className="absolute right-4 top-20 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            if (location && mapInstanceRef.current) {
              mapInstanceRef.current.setView([location.lat, location.lng], 17, { animate: true })
              triggerHereBadge()
            }
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-800 backdrop-blur border border-slate-200 shadow-lg transition hover:scale-105"
          title="Konuma Odaklan"
        >
          <LocateFixed className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => setIsHistoryOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-800 backdrop-blur border border-slate-200 shadow-lg transition hover:scale-105"
          title={t('myCapsules') || 'Geçmişim'}
        >
          <History className="h-5 w-5 text-purple-600" />
        </button>
      </div>

      {/* Seçilen Kapsül ve Slider Bilgi Kartı */}
      {activeCapsule && (
        <div className="absolute left-1/2 bottom-28 z-30 -translate-x-1/2 w-[min(400px,calc(100%-32px))] pointer-events-auto">
          <div className="rounded-2xl bg-white/95 p-4 text-xs text-slate-900 backdrop-blur-md border border-slate-200 shadow-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-purple-700">
                  {getAuthorDisplay(activeCapsule.authorId) || activeCapsule.authorName}
                </span>
                {currentClusterCapsules.length > 1 && (
                  <span className="rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 text-[10px] font-bold">
                    {activeClusterIndex + 1} / {currentClusterCapsules.length}
                  </span>
                )}
              </div>
              <button onClick={() => { setSelectedCapsuleId(null); setActiveClusterIndex(0); }} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>
                {distanceToActive !== null
                  ? `Mesafe: ${formatDistance(distanceToActive)} • ${isCapsuleUnlocked(distanceToActive, activeCapsule.radius) || activeCapsule.authorId === auth.currentUser?.uid ? 'Açık' : `Kilitli (${DEFAULT_CAPSULE_RADIUS_METERS}m)`}`
                  : 'Mesafe hesaplanıyor...'}
              </span>

              {currentClusterCapsules.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveClusterIndex((prev) => (prev > 0 ? prev - 1 : currentClusterCapsules.length - 1))}
                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="Önceki Kapsül"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setActiveClusterIndex((prev) => (prev < currentClusterCapsules.length - 1 ? prev + 1 : 0))}
                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="Sonraki Kapsül"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {isCapsuleUnlocked(distanceToActive ?? 999, activeCapsule.radius) || activeCapsule.authorId === auth.currentUser?.uid ? (
              <p className="mt-2 text-sm text-slate-900 bg-slate-100 p-3 rounded-xl border border-slate-200">{activeCapsule.content}</p>
            ) : (
              <p className="mt-2 text-xs italic text-slate-500 bg-slate-100 p-3 rounded-xl border border-slate-200">Bu kapsülü okumak için çok uzaktasın. Yaklaşman gerekiyor.</p>
            )}
          </div>
        </div>
      )}

      {feedback && <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs shadow-lg backdrop-blur">{feedback}</div>}

      {/* Kapsül Bırakma Modalı */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={closeModal}>
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">{t('leaveCapsuleTitle')}</h2>
                <p className="text-xs text-slate-500">{t('leaveCapsuleSubtitle')}</p>
              </div>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder={t('capsulePlaceholder')}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-900 outline-none focus:border-purple-600 transition"
              />

              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 border border-slate-200 text-xs">
                <div className="flex items-center gap-2 text-slate-700 truncate">
                  <MapPin className="h-4 w-4 text-purple-600 shrink-0" />
                  <span className="truncate">
                    {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Konum bekleniyor...'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleFetchCurrentLocation}
                  disabled={isFetchingLocation}
                  className="shrink-0 ml-2 inline-flex items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-purple-700 transition disabled:opacity-50"
                >
                  <LocateFixed className="h-3.5 w-3.5" />
                  {isFetchingLocation ? 'Alınıyor...' : 'Konumumu Al'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="h-4 w-4 rounded border-slate-300 bg-slate-50 text-purple-600" />
                  {t('anonymousUser')}
                </label>
              </div>

              {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 border border-red-200">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-fuchsia-500/25 disabled:opacity-50"
                >
                  {submitting ? 'Gönderiliyor...' : t('leaveCapsuleTitle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Geçmişim Modalı */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-5 shadow-2xl text-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">{t('myCapsules') || 'Geçmiş Kapsüllerim'}</h3>
              <button onClick={() => setIsHistoryOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-3 py-1">
              {capsules.filter((c) => c.authorId === auth.currentUser?.uid).length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-6">Henüz kapsül bırakmamışsınız.</div>
              ) : (
                capsules
                  .filter((c) => c.authorId === auth.currentUser?.uid)
                  .map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCapsuleId(c.id)
                        setActiveClusterIndex(0)
                        setIsHistoryOpen(false)
                        if (mapInstanceRef.current) {
                          mapInstanceRef.current.setView([c.latitude, c.longitude], 18, { animate: true })
                        }
                      }}
                      className="group relative flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer hover:border-purple-600 transition"
                    >
                      <div className="space-y-1 pr-3 flex-1">
                        <div className="text-xs text-slate-900 line-clamp-2">{c.content}</div>
                        <div className="text-[10px] text-purple-600 font-medium">Haritada görmek için tıkla</div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteCapsule(c.id, e)}
                        disabled={deletingId === c.id}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition disabled:opacity-50"
                        title="Kapsülü Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

async function getCurrentCoordinates(): Promise<Coordinates | null> {
  try {
    const position = await Geolocation.getCurrentPosition()
    return { lat: position.coords.latitude, lng: position.coords.longitude }
  } catch {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return await new Promise((resolve) =>
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      )
    }
    return null
  }
}