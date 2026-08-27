'use client'

import { useEffect, useState } from 'react'
import { Clock3, MessageCircle, Radar, Settings, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

export type TabKey = 'radar' | 'hints' | 'chat' | 'capsules' | 'settings'

export function BottomNav({
  active,
  onChange,
  instantEnabled = true,
}: {
  active: TabKey
  onChange: (key: TabKey) => void
  instantEnabled?: boolean
}) {
  const [pendingHintsCount, setPendingHintsCount] = useState<number>(0)
  const [activeChatsCount, setActiveChatsCount] = useState<number>(0)

  useEffect(() => {
    let unsubscribeHints: (() => void) | undefined
    let unsubscribeChats: (() => void) | undefined

    const attachListeners = (currentUser: typeof auth.currentUser) => {
      unsubscribeHints?.()
      unsubscribeChats?.()
      unsubscribeHints = undefined
      unsubscribeChats = undefined

      setPendingHintsCount(0)
      setActiveChatsCount(0)

      if (!currentUser) return

      const hintsQuery = query(
        collection(db, 'spark_requests'),
        where('to', '==', currentUser.uid),
        where('status', '==', 'pending')
      )
      unsubscribeHints = onSnapshot(hintsQuery, (snapshot) => {
        if (!auth.currentUser) return
        setPendingHintsCount(snapshot.size)
      })

      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUser.uid)
      )
      unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
        if (!auth.currentUser) return
        setActiveChatsCount(snapshot.size)
      })
    }

    const authUnsub = onAuthStateChanged(auth, attachListeners)

    return () => {
      authUnsub()
      unsubscribeHints?.()
      unsubscribeChats?.()
    }
  }, [])

  const tabs: { key: TabKey; label: string; icon: LucideIcon; badge?: number }[] = [
    { key: 'radar', label: 'Radar', icon: Radar },
    { key: 'hints', label: 'Yankılar', icon: Sparkles, badge: pendingHintsCount },
    { key: 'chat', label: 'Sohbet', icon: MessageCircle, badge: activeChatsCount },
    { key: 'capsules', label: 'Kapsüller', icon: Clock3 },
    { key: 'settings', label: 'Ayarlar', icon: Settings },
  ]

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 px-6 pb-8 pt-4 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none">
      <nav className="pointer-events-auto mx-auto flex max-w-sm items-center justify-between rounded-[32px] border border-white/10 bg-background/65 px-3 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-3xl relative">
        
        {/* Üst kenarda ince lüks parlak ışık çizgisi (Specular highlight) */}
        <div className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                if ((tab.key === 'radar' || tab.key === 'hints') && !instantEnabled) return
                onChange(tab.key)
              }}
              disabled={(tab.key === 'radar' || tab.key === 'hints') && !instantEnabled}
              className={`relative flex flex-1 flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 group ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground/70 hover:text-foreground'
              } ${(tab.key === 'radar' || tab.key === 'hints') && !instantEnabled ? 'pointer-events-none opacity-30' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={(tab.key === 'radar' || tab.key === 'hints') && !instantEnabled ? 'true' : undefined}
            >
              {/* Aktif sekme arkasındaki çok zarif, yumuşak cam kapsül */}
              {isActive && (
                <div className="absolute inset-x-1 inset-y-0.5 bg-white/10 dark:bg-white/5 rounded-xl border border-white/10 shadow-sm backdrop-blur-md -z-10 animate-in fade-in zoom-in-95 duration-300" />
              )}

              <div className="relative flex items-center justify-center">
                <Icon
                  className={`h-5 w-5 transition-transform duration-300 ${
                    isActive ? 'scale-110 text-primary' : 'group-hover:scale-105'
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.6}
                />
                
                {/* Premium Bildirim Rozeti (Narin ve Şık) */}
                {Boolean(tab.badge && tab.badge > 0) && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-lg px-1 animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[9px] tracking-wide mt-1.5 transition-all duration-300 ${
                  isActive ? 'opacity-100 font-semibold text-primary' : 'opacity-50 font-normal'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}