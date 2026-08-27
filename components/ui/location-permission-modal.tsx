'use client'

import React, { useState } from 'react'
import { MapPin, CheckCircle2, ChevronDown } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { auth, db } from '@/lib/firebase'
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import { geohashForLocation } from 'geofire-common'

type LocationPermissionModalProps = {
  isOpen: boolean
  onGrant: () => void
  onClose: () => void
}

export function LocationPermissionModal({ isOpen, onGrant, onClose }: LocationPermissionModalProps) {
  const [hasScrolledBottom, setHasScrolledBottom] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen) return null

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const bottomReached = target.scrollHeight - target.scrollTop <= target.clientHeight + 20
    if (bottomReached) {
      setHasScrolledBottom(true)
    }
  }

  const stopEventPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation()
  }

  const handleGrantClick = async (event: React.SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!hasScrolledBottom || isProcessing) return

    setIsProcessing(true)
    try {
      // 1. Platforma göre izin kontrolü (Web ve Mobil uyumlu)
      if (Capacitor.isNativePlatform()) {
        const permissionStatus = await Geolocation.checkPermissions()
        if (permissionStatus.location !== 'granted') {
          const requestResult = await Geolocation.requestPermissions()
          if (requestResult.location !== 'granted') {
            alert("Uygulamanın çalışabilmesi için konum izni gereklidir.")
            setIsProcessing(false)
            return
          }
        }
      }

      // 2. Konumu taze olarak al (Web için navigator, Mobil için Capacitor)
      const position = await new Promise<any>((resolve, reject) => {
        if (Capacitor.isNativePlatform()) {
          Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 })
            .then(resolve)
            .catch(reject)
        } else {
          if (!navigator.geolocation) {
            reject(new Error("Tarayıcınız konum desteklemiyor."))
          } else {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: Infinity
})
          }
        }
      })

      const currentUser = auth.currentUser
      if (currentUser && position) {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude

        // Firestore users tablosuna anlık konumu işle
        await setDoc(doc(db, "users", currentUser.uid), {
          lat: latitude,
          lng: longitude,
          lastSeen: serverTimestamp()
        }, { merge: true })

        // Eğer active_sparks tablosunda da kaydı varsa orayı da güncelle
        const sparkRef = doc(db, "active_sparks", currentUser.uid)
        const sparkSnap = await getDoc(sparkRef)
        if (sparkSnap.exists()) {
          const hash = geohashForLocation([latitude, longitude])
          await setDoc(sparkRef, {
            lat: latitude,
            lng: longitude,
            hash,
            timestamp: serverTimestamp()
          }, { merge: true })
        }
      }

      // 3. İşlemler bittikten sonra üst bileşene bildir ve modalı kapat
      onGrant()
    } catch (error) {
      console.error("Konum alınamadı:", error)
      alert("Lütfen cihazınızın veya tarayıcınızın konum (GPS) servislerini açın ve tekrar deneyin.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onMouseDown={stopEventPropagation}
      onMouseMove={stopEventPropagation}
      onMouseUp={stopEventPropagation}
      onWheel={stopEventPropagation}
      onTouchStart={stopEventPropagation}
      onTouchMove={stopEventPropagation}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-slate-950 border border-white/15 p-6 shadow-2xl text-white flex flex-col max-h-[85vh]"
        onMouseDown={stopEventPropagation}
        onMouseUp={stopEventPropagation}
        onWheel={stopEventPropagation}
        onTouchStart={stopEventPropagation}
        onTouchMove={stopEventPropagation}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-fuchsia-500/25 border border-fuchsia-500/40 text-fuchsia-400 shrink-0">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Konumunu Aç</h2>
            <p className="text-xs text-slate-400">Pulbi deneyimini tam anlamıyla yaşa.</p>
          </div>
        </div>

        <div className="relative my-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div
            onScroll={handleScroll}
            onWheel={(event) => {
              event.stopPropagation()
            }}
            onTouchMove={(event) => {
              event.stopPropagation()
            }}
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
            className="relative max-h-[260px] flex-1 overflow-y-auto overscroll-contain rounded-2xl p-4 text-xs text-slate-300 space-y-3 leading-relaxed pr-2 custom-scrollbar"
          >
            <p className="font-medium text-white">
              Pulbi, çevrendeki kullanıcıları ve gerçek hayatta kesiştiğin kişileri bulabilmek için konumunu kullanır.
            </p>

            <p>Konum bilgisi;</p>

            <ul className="space-y-1.5 pl-2 text-slate-200">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                📡 Radar özelliğini çalıştırmak,
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                ✨ Spark oluşturmak,
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                🔊 Yankılar bölümünde karşılaşmaları tespit etmek,
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                👥 Yakınındaki Pulbi kullanıcılarını göstermek
              </li>
            </ul>

            <p className="pt-2 text-slate-400">
              Ghost Mode ile görünürlüğünü istediğin zaman kapatabilirsin.
            </p>

            <p className="pb-2 text-[11px] text-slate-500">
              Konum verilerin hakkında daha fazla bilgi için Gizlilik Politikası ve KVKK Aydınlatma Metni'ni inceleyebilirsin.
            </p>
          </div>
        </div>

        {!hasScrolledBottom && (
          <div className="flex items-center justify-center gap-1 text-[11px] text-fuchsia-400 animate-bounce py-1">
            <span>Devam etmek için metni aşağı kaydırın</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onClose()
            }}
            className="flex-1 rounded-full border border-white/15 bg-white/5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
          >
            Reddet
          </button>

          <button
            type="button"
            disabled={!hasScrolledBottom || isProcessing}
            onClick={handleGrantClick}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold text-white shadow-lg transition ${
              hasScrolledBottom && !isProcessing
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-fuchsia-500/30 hover:scale-[1.02]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            {isProcessing ? 'Konum Alınıyor...' : 'İzin Ver'}
          </button>
        </div>
      </div>
    </div>
  )
}