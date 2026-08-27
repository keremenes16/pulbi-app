'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Ban,
  Eraser,
  Flag,
  MoreVertical,
  Send,
  Sparkles,
  Trash2,
  Zap,
  Loader2,
} from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import { useTranslations } from '@/lib/i18n'
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  getDoc,
  increment,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'

type Thread = {
  id: string
  name: string
  hint: string
  status: 'locked' | 'active'
  via?: string
  preview?: string
  accent: 'primary' | 'amber'
  unreadCount?: number
  participants?: string[]
  hiddenFor?: string[]
  isEncounterChat?: boolean
  location?: string
  avatarURL?: string | null
  participantId?: string
}

type Message = { id?: string; me: boolean; text: string; time: string; read?: boolean; createdAt?: any }

const reportReasonKeys = [
  'reportReason1',
  'reportReason2',
  'reportReason3',
  'reportReason4',
]

function Sheet({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  labelledBy?: string
}) {
  const t = useTranslations()
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t('closeLabel')}
        onClick={onClose}
        className="absolute inset-0 animate-fade bg-background/80 backdrop-blur-md"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative animate-rise rounded-t-[2.5rem] border-t border-white/15 bg-[#0a0612]/95 px-5 pb-8 pt-4 shadow-[0_-20px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
        {children}
      </div>
    </div>
  )
}

function ActionRow({
  icon,
  label,
  description,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.99] border border-transparent ${
        danger 
          ? 'hover:bg-destructive/10 hover:border-destructive/20 active:bg-destructive/20' 
          : 'hover:bg-white/[0.04] hover:border-white/10 active:bg-white/[0.08]'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-inner ${
          danger ? 'bg-destructive/20 text-destructive border border-destructive/30' : 'bg-white/5 text-foreground border border-white/10'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span
          className={`block text-sm font-semibold ${danger ? 'text-destructive' : 'text-foreground'}`}
        >
          {label}
        </span>
        {description && (
          <span className="mt-1 block text-xs text-muted-foreground/80">
            {description}
          </span>
        )}
      </span>
    </button>
  )
}

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  const t = useTranslations()
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center px-6">
      <button
        type="button"
        aria-label={t('closeLabel')}
        onClick={onCancel}
        className="absolute inset-0 animate-fade bg-background/80 backdrop-blur-md"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full animate-rise rounded-[2.5rem] border border-white/15 bg-[#0a0612]/95 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
      >
        <h3 className="text-lg font-bold text-balance text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
          {body}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-white/15 bg-white/5 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-full py-3.5 text-sm font-semibold transition-all active:scale-[0.98] shadow-lg ${
              danger
                ? 'bg-destructive text-destructive-foreground shadow-destructive/30 hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground shadow-primary/30 hover:bg-primary/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReportSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const t = useTranslations()
  return (
    <Sheet open={open} onClose={onClose} labelledBy="report-title">
      <div className="px-1 pb-2">
        <h3 id="report-title" className="text-lg font-bold text-foreground">
          {t('reportPersonTitle')}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('reportSecretDesc')}
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {reportReasonKeys.map((reasonKey) => (
          <button
            key={reasonKey}
            type="button"
            onClick={() => onSubmit(reasonKey)}
            className="flex w-full items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left text-sm font-medium text-foreground transition-all hover:border-destructive/40 hover:bg-white/[0.06] active:scale-[0.99]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <Flag className="h-4 w-4" />
            </div>
            {t(reasonKey)}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function Toast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-50 flex justify-center px-6">
      <div className="animate-rise rounded-full border border-white/20 bg-[#0a0612]/95 px-5 py-3 text-xs font-semibold text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {message}
      </div>
    </div>
  )
}

function ChatList({
  threads,
  loadingThreads,
  onOpen,
  onManage,
  onOpenProfile,
}: {
  threads: Thread[]
  loadingThreads: boolean
  onOpen: (thread: Thread) => void
  onManage: (thread: Thread) => void
  onOpenProfile?: (userId: string) => void
}) {
  const t = useTranslations()
  return (
    <div className="flex h-full flex-col bg-background relative overflow-hidden">
      <div className="px-6 pt-12 pb-3 bg-gradient-to-b from-background via-background/95 to-transparent z-10 shrink-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t('chatsTitle')}</h1>
        <p className="mt-1 text-xs text-muted-foreground/90">
          {t('chatsSubtitle')}
        </p>
      </div>

      <div className="no-scrollbar flex-1 space-y-3.5 overflow-y-auto px-5 pb-28 pt-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary/90">
            {t('activeChatsTitle')}
          </h2>
          <span className="text-[10px] text-muted-foreground font-medium bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
            {threads.length} Aktif
          </span>
        </div>

        {loadingThreads ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : threads.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.03] border border-white/10 text-muted-foreground shadow-inner">
              <Sparkles className="h-7 w-7 text-primary/70 animate-pulse" />
            </div>
            <p className="mt-4 text-sm font-bold text-foreground">{t('noActiveChats')}</p>
            <p className="mt-1.5 text-xs text-muted-foreground/80 text-pretty max-w-[260px]">
              {t('noActiveChatsHint')}
            </p>
          </div>
        ) : (
          threads.map((thread) => (
            <div
              key={thread.id}
              className="group relative flex w-full items-center gap-3.5 rounded-[2rem] border border-white/10 bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-transparent p-4 transition-all duration-300 hover:border-primary/40 hover:bg-white/[0.06] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(thread)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(thread)
                  }
                }}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 text-left"
              >
                <div
                  className={`relative flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 transition-transform duration-300 group-hover:scale-105 ${
                    thread.via === 'Spark'
                      ? 'border-violet-400/40 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.3)]'
                      : thread.via === 'Yankı'
                      ? 'border-amber-400/40 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                      : thread.via === 'Radar'
                      ? 'border-blue-400/40 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                      : 'border-white/15 bg-white/5'
                  }`}
                >
                  {thread.avatarURL ? (
                    <img src={thread.avatarURL} alt={thread.name} className="h-full w-full object-cover" />
                  ) : (
                    <Zap className="h-5 w-5 text-primary" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    {thread.participantId && onOpenProfile ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenProfile(thread.participantId!)
                        }}
                        className="truncate text-left text-sm font-bold text-foreground transition-colors hover:text-primary"
                      >
                        {thread.name}
                      </button>
                    ) : (
                      <span className="truncate text-sm font-bold text-foreground">
                        {thread.name}
                      </span>
                    )}
                    {thread.unreadCount ? (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-extrabold text-primary-foreground shadow-[0_0_10px_currentColor] animate-pulse">
                        {thread.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {thread.preview || t('conversationActive')}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {thread.isEncounterChat && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400 shadow-sm">
                          <Sparkles className="h-3 w-3" /> Yankı
                        </span>
                      )}
                      {!thread.isEncounterChat && thread.via && (
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold shadow-sm ${
                          thread.via === 'Radar' 
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' 
                            : thread.via === 'Spark'
                            ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
                            : 'bg-primary/15 border-primary/30 text-primary'
                        }`}>
                          {thread.via}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
 
              <button
                type="button"
                onClick={() => onManage(thread)}
                aria-label="Sohbet seçenekleri"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground active:scale-90"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function ActiveChat({
  thread,
  messages,
  loadingMessages,
  onSend,
  onBack,
  onMenu,
  onBlock,
  isBlockedByMe = false,
  isBlockedByOther = false,
  onUnblock,
  onOpenProfile,
}: {
  thread: Thread
  messages: Message[]
  loadingMessages: boolean
  onSend: (text: string) => void
  onBack: () => void
  onMenu: () => void
  onBlock?: () => void
  isBlockedByMe?: boolean
  isBlockedByOther?: boolean
  onUnblock?: () => void
  onOpenProfile?: (userId: string) => void
}) {
  const t = useTranslations()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send() {
    if (!draft.trim()) return
    onSend(draft.trim())
    setDraft('')
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-background overflow-hidden z-30">
      {/* Üst Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 pt-12 pb-3.5 bg-background/90 backdrop-blur-xl z-10 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 transition active:scale-95"
          aria-label={t('backLabel')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30 text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]">
          <Zap className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          {thread.participantId && onOpenProfile ? (
            <button
              type="button"
              onClick={() => onOpenProfile(thread.participantId!)}
              className="truncate text-left text-sm font-bold text-foreground transition hover:text-primary"
            >
              {thread.name}
            </button>
          ) : (
            <p className="truncate text-sm font-bold text-foreground">{thread.name}</p>
          )}
          <p className="truncate text-[11px] text-muted-foreground mt-0.5">
            {thread.hint}
          </p>
        </div>
        {onBlock && (
          <button
            type="button"
            onClick={onBlock}
            aria-label={t('blockLabel')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20 text-destructive transition active:scale-95"
          >
            <Ban className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onMenu}
          aria-label="Sohbet seçenekleri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 transition active:scale-95"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className={`no-scrollbar flex-1 space-y-3.5 overflow-y-auto px-5 py-5 pb-28 ${isBlockedByOther ? 'blur-[2px] select-none pointer-events-none' : ''}`}>
        <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-md">
          {t('chatApproved')}
        </div>

        {loadingMessages ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={m.id || i}
              className={`flex ${m.me ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] overflow-hidden rounded-[1.5rem] px-4 py-3 text-sm leading-relaxed shadow-md ${
                  m.me
                    ? 'rounded-br-sm bg-primary text-primary-foreground shadow-primary/20'
                    : 'rounded-bl-sm border border-white/10 bg-white/[0.05] text-foreground backdrop-blur-md'
                }`}
              >
                <div className="break-words whitespace-pre-wrap">{m.text}</div>
                <div
                  className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-medium ${
                    m.me ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  }`}
                >
                  <span>{m.time}</span>
                  {m.me && (
                    <span className={`ml-0.5 tracking-tighter ${m.read ? 'text-sky-400 font-bold' : ''}`}>
                      ✓✓
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {isBlockedByOther && (
        <div className="absolute inset-x-0 bottom-0 top-20 bg-background/70 backdrop-blur-md flex items-center justify-center p-6 z-20">
          <div className="rounded-[2rem] bg-[#0a0612]/95 border border-white/15 p-6 text-center shadow-2xl max-w-xs backdrop-blur-xl">
            <p className="text-sm font-bold text-foreground">{t('blockedByUser')}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('blockedByUser')}
            </p>
          </div>
        </div>
      )}

      {/* Mesaj Yazma Alanı */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 px-4 py-3 bg-[#0a0612]/90 backdrop-blur-2xl z-20">
        {isBlockedByOther ? (
          <div className="text-center py-2.5 text-xs text-muted-foreground font-medium">
            Bu kullanıcıya mesaj gönderemezsiniz.
          </div>
        ) : isBlockedByMe ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Bu kişiyi engellediniz.
            </span>
            {onUnblock && (
              <button
                type="button"
                onClick={onUnblock}
                className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-md transition active:scale-95"
              >
                Engeli Kaldır
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={t('pleaseWriteMessage')}
              className="w-full rounded-full border border-white/15 bg-white/[0.04] px-5 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/60 focus:bg-white/[0.07] shadow-inner"
            />
            <button
              type="button"
              onClick={send}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-95"
              aria-label={t('sendLabel')}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

type PendingAction =
  | { kind: 'clear'; thread: Thread }
  | { kind: 'delete'; thread: Thread }
  | { kind: 'block'; thread: Thread }
  | null

export function ChatScreen({ 
  chatId, 
  onChatOpenChange,
  onOpenProfile,
}: { 
  chatId?: string | null; 
  onChatOpenChange?: (isOpen: boolean) => void
  onOpenProfile?: (userId: string) => void
}) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [menuThread, setMenuThread] = useState<Thread | null>(null)
  const [confirm, setConfirm] = useState<PendingAction>(null)
  const [reportThread, setReportThread] = useState<Thread | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const userFetchCacheRef = useRef<Map<string, Promise<{ name: string; photoURL: string | null }>>>(new Map())

  useEffect(() => {
    setOpenId(chatId ?? null)
  }, [chatId])

  useEffect(() => {
    if (openId && threads.length > 0) {
      const exactMatch = threads.some(th => th.id === openId)
      if (!exactMatch) {
        const matchedByUser = threads.find(th => th.participantId === openId)
        if (matchedByUser) {
          setOpenId(matchedByUser.id)
        }
      }
    }
  }, [openId, threads])

  useEffect(() => {
    onChatOpenChange?.(!!openId)
  }, [openId, onChatOpenChange])

  const openThread = threads.find((th) => th.id === openId) ?? null

  function flashToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const authUnsub = auth.onAuthStateChanged((currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser) {
        setBlockedUsers([])
        return
      }

      unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (snapshot) => {
        setBlockedUsers(snapshot.exists() ? (snapshot.data().blockedUsers || []) : [])
      })
    })

    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const authUnsub = auth.onAuthStateChanged((currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser) {
        setThreads([])
        setLoadingThreads(false)
        return
      }

      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUser.uid),
        orderBy('createdAt', 'desc')
      )

      unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const threadPromises = snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data()
            const participants = data.participants || []
            const hiddenFor = data.hiddenFor || []

            if (hiddenFor.includes(currentUser.uid)) {
              return null
            }
            
            const otherUserId = participants.find((id: string) => id !== currentUser.uid)
  
            let rawName = ''
            let avatarURL: string | null = null

            // Önce karşı kullanıcının profil dokümanını çekip gerçek kullanıcı adını alıyoruz
            if (otherUserId) {
              try {
                let userPromise = userFetchCacheRef.current.get(otherUserId)

                if (!userPromise) {
                  userPromise = (async () => {
                    const userDoc = await getDoc(doc(db, 'users', otherUserId))
                    if (!userDoc.exists()) {
                      return { name: '', photoURL: null }
                    }
                    const userData = userDoc.data()
                    
                    // İSİM ÖNCELİK SIRASI: username -> displayName -> name -> email prefix
                    const resolvedName = 
                      userData.username || 
                      userData.displayName || 
                      userData.name || 
                      userData.email?.split('@')[0] || 
                      ''

                    return {
                      name: resolvedName,
                      photoURL: userData.photoURL || null,
                    }
                  })()
                  userFetchCacheRef.current.set(otherUserId, userPromise)
                }

                const userData = await userPromise
                rawName = userData.name
                avatarURL = userData.photoURL
              } catch (e) {
                console.error('Kullanıcı adı çekilemedi:', e)
              }
            }

            if (!rawName && otherUserId && data.participantNames && data.participantNames[otherUserId]) {
              rawName = data.participantNames[otherUserId]
            }

            if (!rawName || rawName === currentUser.displayName || rawName === 'Sen') {
              rawName = data.location ? `Kesişme: ${data.location}` : 'Sohbet Üyesi'
            }

            const unreadCounts = data.unreadCounts || {}
            const unreadCount = Number(unreadCounts[currentUser.uid] || data.unreadCount || 0)

            let detectedVia = data.via || 'Spark'
            if (data.isEncounterChat) {
              detectedVia = 'Yankı'
            } else if (data.type === 'radar' || data.source === 'radar') {
              detectedVia = 'Radar'
            }

            return {
              id: docSnap.id,
              name: rawName,
              hint: data.hint || 'Karşılıklı onaylandı',
              status: 'active' as const,
              via: detectedVia,
              preview: data.lastMessage || 'Sohbet başladı...',
              accent: data.accent || 'amber',
              unreadCount,
              participants,
              hiddenFor,
              isEncounterChat: !!data.isEncounterChat,
              location: data.location,
              avatarURL,
              participantId: otherUserId,
            }
          })

          const fetchedThreads = await Promise.all(threadPromises)
          const activeThreads = fetchedThreads.filter(Boolean) as Thread[]

          setThreads(activeThreads)
          setLoadingThreads(false)
        },
        (error) => {
          console.error('İNDEX HATASI YAKALANDI: ', error.message, error)
          setLoadingThreads(false)
        }
      )
    })

    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (!openId) {
      setMessages([])
      return
    }

    const currentUser = auth.currentUser
    if (!currentUser) return

    let cancelled = false
    let unsubscribeMessages: (() => void) | undefined

    setLoadingMessages(true)

    const startMessagesListener = async () => {
      try {
        const chatSnap = await getDoc(doc(db, 'chats', openId))
        if (cancelled || !chatSnap.exists()) {
          setMessages([])
          setLoadingMessages(false)
          return
        }

        const chatData = chatSnap.data()
        const clearedAt = chatData[`cleared_${currentUser.uid}`]

        const msgQuery = query(
          collection(db, 'chats', openId, 'messages'),
          orderBy('createdAt', 'asc'),
          limit(20)
        )

        unsubscribeMessages = onSnapshot(msgQuery, async (snapshot) => {
          if (cancelled) return

          const unreadDocsToUpdate: string[] = []

          const msgs = snapshot.docs
            .map((docSnap) => {
              const data = docSnap.data()
              const isMe = data.senderId === currentUser.uid

              if (clearedAt && data.createdAt && data.createdAt.toMillis() <= clearedAt.toMillis()) {
                return null
              }

              if (!isMe && data.read !== true) {
                unreadDocsToUpdate.push(docSnap.id)
              }

              return {
                id: docSnap.id,
                me: isMe,
                text: data.text || '',
                time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: data.read,
                createdAt: data.createdAt,
              }
            })
            .filter(Boolean)

          setMessages(msgs as any)
          setLoadingMessages(false)

          if (unreadDocsToUpdate.length > 0) {
            try {
              const batch = writeBatch(db)
              unreadDocsToUpdate.forEach((msgId) => {
                const mDocRef = doc(db, 'chats', openId, 'messages', msgId)
                batch.update(mDocRef, { read: true })
              })
              await batch.commit()

              await updateDoc(doc(db, 'chats', openId), {
                [`unreadCounts.${currentUser.uid}`]: 0,
              })
            } catch (err) {
              console.error('Mesajlar okundu işaretlenirken hata:', err)
            }
          }
        })
      } catch (err) {
        if (!cancelled) {
          console.error('Sohbet yüklenemedi:', err)
          setLoadingMessages(false)
        }
      }
    }

    void startMessagesListener()

    return () => {
      cancelled = true
      unsubscribeMessages?.()
    }
  }, [openId])

  async function handleSend(text: string) {
    if (!openId) return
    const currentUser = auth.currentUser
    if (!currentUser) return

    const currentThread = threads.find(th => th.id === openId)
    const participants = currentThread?.participants || []
    const otherUserId = participants.find((id) => id !== currentUser.uid)

    if (otherUserId) {
      try {
        const userDocRef = doc(db, 'users', currentUser.uid)
        const userDocSnap = await getDoc(userDocRef)
        
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data()
          const blockedUsersList = userData.blockedUsers || []

          if (blockedUsersList.includes(otherUserId)) {
            flashToast('Bu kişiyi engellediğiniz için mesaj gönderemezsiniz.')
            return
          }
        }

        const otherUserDocRef = doc(db, 'users', otherUserId)
        const otherUserDocSnap = await getDoc(otherUserDocRef)

        if (otherUserDocSnap.exists()) {
          const otherUserData = otherUserDocSnap.data()
          const otherBlockedList = otherUserData.blockedUsers || []

          if (otherBlockedList.includes(currentUser.uid)) {
            flashToast('Bu kullanıcı tarafından engellendiğiniz için mesaj gönderemezsiniz.')
            return
          }
        }
      } catch (err) {
        console.error('Engel durumu kontrol edilemedi:', err)
      }
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    try {
      await addDoc(collection(db, 'chats', openId, 'messages'), {
        senderId: currentUser.uid,
        text,
        time: timeStr,
        read: false,
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'chats', openId), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        hiddenFor: [],
        [`unreadCounts.${currentUser.uid}`]: 0,
        ...(otherUserId ? { [`unreadCounts.${otherUserId}`]: increment(1) } : {}),
      })
    } catch (error) {
      console.error('Mesaj gönderilemedi:', error)
      flashToast('Mesaj gönderilemedi.')
    }
  }

  async function handleClear(thread: Thread) {
    try {
      const msgRef = collection(db, 'chats', thread.id, 'messages')
      const snapshot = await getDocs(msgRef)
      const deletions = snapshot.docs.map((d) => deleteDoc(doc(db, 'chats', thread.id, 'messages', d.id)))
      await Promise.all(deletions)

      await updateDoc(doc(db, 'chats', thread.id), {
        lastMessage: 'Sohbet temizlendi',
      })

      flashToast('Sohbet geçmişi temizlendi')
    } catch (error) {
      console.error('Sohbet temizlenirken hata:', error)
      flashToast('İşlem başarısız oldu.')
    }
  }

  async function handleReport(thread: Thread, reason: string) {
    const currentUser = auth.currentUser
    if (!currentUser) return

    setReportThread(null)

    try {
      const participants = thread.participants || []
      const targetUserId = participants.find((id) => id !== currentUser.uid) || thread.participantId || thread.id

      await addDoc(collection(db, 'reports'), {
        reporterId: currentUser.uid,
        targetId: targetUserId,
        reason,
        status: 'pending',
        timestamp: serverTimestamp(),
      })

      flashToast(`Bildirin alındı · ${reason}`)
    } catch (error) {
      console.error('Rapor kaydedilemedi:', error)
      flashToast('Rapor kaydedilemedi.')
    }
  }

  async function handleDelete(thread: Thread) {
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      const chatRef = doc(db, 'chats', thread.id)
      const chatSnap = await getDoc(chatRef)
      const chatData = chatSnap.exists() ? chatSnap.data() : null
      const participants = chatData?.participants || thread.participants || []
      const otherUserId = participants.find((id: string) => id !== currentUser.uid)

      await updateDoc(chatRef, {
        hiddenFor: arrayUnion(currentUser.uid),
        [`cleared_${currentUser.uid}`]: serverTimestamp(),
      })

      if (otherUserId) {
        const sortedIds = [currentUser.uid, otherUserId].sort()
        const encounterRef = doc(db, 'encounters', `${sortedIds[0]}_${sortedIds[1]}`)
        await deleteDoc(encounterRef).catch(() => undefined)
      }

      if (openId === thread.id) setOpenId(null)
      flashToast('Sohbet listeden kaldırıldı')
    } catch (error) {
      console.error('Sohbet gizlenirken hata:', error)
      flashToast('Sohbet gizlenemedi.')
    }
  }

  async function handleBlock(thread: Thread) {
    const currentUser = auth.currentUser
    if (!currentUser) return

    const participants = thread.participants || []
    const otherUserId = participants.find((id) => id !== currentUser.uid)
    if (!otherUserId) return

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        blockedUsers: arrayUnion(otherUserId)
      })

      await handleDelete(thread)
      
      flashToast('Kişi engellendi ve sohbet kaldırıldı')
    } catch (error) {
      console.error('Kişi engellenirken hata:', error)
      flashToast('İşlem başarısız oldu.')
    }
  }

  async function handleUnblock() {
    const currentUser = auth.currentUser
    if (!currentUser || !openThread) return

    const participants = openThread.participants || []
    const otherUserId = participants.find((id) => id !== currentUser.uid)
    if (!otherUserId) return

    try {
      const userDocRef = doc(db, 'users', currentUser.uid)
      await updateDoc(userDocRef, {
        blockedUsers: arrayRemove(otherUserId),
      })
      flashToast('Engel kaldırıldı.')
    } catch (error) {
      console.error('Engel kaldırılamadı:', error)
      flashToast('İşlem başarısız oldu.')
    }
  }

  const currentUserId = auth.currentUser?.uid
  const participants = openThread?.participants || []
  const otherUserId = participants.find((id) => id !== currentUserId)
  
  const isBlockedByMe = blockedUsers?.includes(otherUserId || '') || false

  return (
    <div className="absolute inset-0 overflow-hidden flex flex-col bg-background">
      {openThread ? (
        <ActiveChat
          thread={openThread}
          messages={messages}
          loadingMessages={loadingMessages}
          onSend={handleSend}
          onBack={() => setOpenId(null)}
          onMenu={() => setMenuThread(openThread)}
          onBlock={() => {
            setMenuThread(null)
            setConfirm({ kind: 'block', thread: openThread })
          }}
          onOpenProfile={onOpenProfile}
          isBlockedByMe={isBlockedByMe}
          isBlockedByOther={false}
          onUnblock={handleUnblock}
        />
      ) : (
        <ChatList
          threads={threads}
          loadingThreads={loadingThreads}
          onOpen={(th) => setOpenId(th.id)}
          onManage={(th) => setMenuThread(th)}
          onOpenProfile={onOpenProfile}
        />
      )}

      <Sheet
        open={!!menuThread}
        onClose={() => setMenuThread(null)}
        labelledBy="chat-menu-title"
      >
        {menuThread && (
          <>
            <div className="px-1 pb-3">
              <h3 id="chat-menu-title" className="text-lg font-bold text-foreground">
                {menuThread.name}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sohbet ve güvenlik seçenekleri
              </p>
            </div>
            <div className="space-y-1">
              <ActionRow
                icon={<Eraser className="h-4 w-4" />}
                label="Sohbeti temizle"
                description="Mesaj geçmişini sil, sohbeti tut"
                onClick={() => {
                  const th = menuThread
                  setMenuThread(null)
                  setConfirm({ kind: 'clear', thread: th })
                }}
              />
              <ActionRow
                icon={<Flag className="h-4 w-4" />}
                label="Şikayet et"
                description="Uygunsuz davranışı bildir"
                onClick={() => {
                  const th = menuThread
                  setMenuThread(null)
                  setReportThread(th)
                }}
              />
              <ActionRow
                icon={<Trash2 className="h-4 w-4" />}
                label="Sohbeti sil"
                description="Listeden tamamen kaldır"
                danger
                onClick={() => {
                  const th = menuThread
                  setMenuThread(null)
                  setConfirm({ kind: 'delete', thread: th })
                }}
              />
            </div>
          </>
        )}
      </Sheet>

      <ReportSheet
        open={!!reportThread}
        onClose={() => setReportThread(null)}
        onSubmit={(reason) =>
          reportThread && handleReport(reportThread, reason)
        }
      />

      <ConfirmDialog
        open={confirm?.kind === 'clear'}
        title="Sohbet geçmişi temizlensin mi?"
        body="Bu sohbetteki tüm mesajlar kalıcı olarak silinir."
        confirmLabel="Temizle"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'clear') handleClear(confirm.thread)
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title="Sohbet silinsin mi?"
        body="Bu sohbet arayüzünden kaldırılır, ancak karşı taraf sohbeti görmeye devam edebilir."
        confirmLabel="Sil"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'delete') handleDelete(confirm.thread)
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'block'}
        title="Kişi engellensin mi?"
        body="Bu kişiyle iletişimin anında kesilir ve sohbet kaldırılır."
        confirmLabel="Engelle"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'block') handleBlock(confirm.thread)
          setConfirm(null)
        }}
      />

      {toast && <Toast message={toast} />}
    </div>
  )
}