'use client'

import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  Sparkles, 
  MessageCircle, 
  Loader2, 
  Radar, 
  X, 
  User,
  Ban,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import { PulbiWordmark } from '@/components/pulbi/logo';
import { 
  auth, 
  db 
} from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  getDocs, 
  serverTimestamp, 
  arrayRemove,
  arrayUnion,
  increment 
} from 'firebase/firestore';

import { geohashForLocation } from 'geofire-common';
import { Geolocation } from '@capacitor/geolocation';
import type { TabKey } from '@/components/pulbi/bottom-nav';
import { LocationPermissionModal } from '@/components/ui/location-permission-modal';
import { isPointInsideSafeZone, type SafeZone } from '@/lib/capsules'

const SPARK_REQUEST_TIMEOUT_MS = 30 * 1000
const REJECTED_STATUS_DISPLAY_MS = 5500

const parseDistanceToMeters = (accuracyStr: string, defaultVal: number): number => {
  if (!accuracyStr) return defaultVal;
  const numericVal = parseInt(accuracyStr.replace('m', ''), 10);
  return isNaN(numericVal) ? defaultVal : numericVal;
};

const calculateDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

export function RadarScreen({
  onNavigate,
  onOpenProfile,
}: {
  onNavigate: (tab: TabKey) => void
  onOpenProfile?: (userId: string) => void
}) {
  const [sparking, setSparking] = useState(false)
  const [isScanningAnim, setIsScanningAnim] = useState(false)
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [liveNearbyCount, setLiveNearbyCount] = useState<number>(0)
  const [matchedRoom, setMatchedRoom] = useState<string | null>(null)
  
  const [incomingSpark, setIncomingSpark] = useState<{ id: string; fromUserId: string; fromUserName: string; rejectCount: number; timestamp: number } | null>(null)
  const [incomingProgress, setIncomingProgress] = useState<number>(100)

  const [blockPrompt, setBlockPrompt] = useState<{ requestId: string; userId: string; userName: string } | null>(null)
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])
  const [existingMatches, setExistingMatches] = useState<Record<string, { type: 'chat' | 'deleted' | 'spark' | 'pending' | 'accepted' | 'rejected'; chatId?: string; date?: string; docId?: string; timestamp?: number }>>({})
  const [radarMaxDistance, setRadarMaxDistance] = useState<number>(200)
  const [isGhostMode, setIsGhostMode] = useState<boolean>(false)
  const [safeZones, setSafeZones] = useState<SafeZone[]>([])
  
  const [isLocationReady, setIsLocationReady] = useState<boolean>(true)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false)

  const userProfileRef = useRef<Record<string, any>>({})
  const blockedUsersRef = useRef<string[]>([])
  const radarMaxDistanceRef = useRef(200)
  const currentPositionRef = useRef<{ lat: number; lng: number } | null>(null)
  const safeZonesRef = useRef<SafeZone[]>([])

  useEffect(() => {
    safeZonesRef.current = safeZones;
  }, [safeZones]);

  const handleSparkClick = () => {
    setIsScanningAnim(true)
    setTimeout(() => {
      setIsScanningAnim(false)
      setSparking(true)
    }, 1000)
  }

  const getCurrentPositionStrict = async () => {
    try {
      const permissionStatus = await Geolocation.checkPermissions();
      if (permissionStatus.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          setIsLocationModalOpen(true);
          throw new Error("Konum izni reddedildi.");
        }
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000 
      });
      const nextPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      currentPositionRef.current = nextPosition;
      setIsLocationReady(true);
      setIsLocationModalOpen(false);
      return nextPosition;
    } catch (err) {
      const permCheck = await Geolocation.checkPermissions().catch(() => ({ location: 'prompt' }));
      if (permCheck.location !== 'granted') {
        setIsLocationReady(false);
        setIsLocationModalOpen(true);
      }
      throw err;
    }
  }

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
      unsubscribe?.()
      if (!currentUser) {
        setSafeZones([])
        return
      }
      const zonesRef = collection(db, "users", currentUser.uid, "safeZones")
      unsubscribe = onSnapshot(zonesRef, (snapshot) => {
        const zones: SafeZone[] = []
        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          if (
            typeof data.lat === 'number' &&
            typeof data.lng === 'number' &&
            typeof data.radius === 'number'
          ) {
            zones.push({ ...data, lat: data.lat, lng: data.lng, radius: data.radius })
          }
        })
        setSafeZones(zones)
      }, (error) => {
        console.warn("Safe zones okunamadı:", error)
      })
    })
    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let currentUserId: string | null = null

    const authUnsub = onAuthStateChanged(auth, async (currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser) {
        currentUserId = null
        setBlockedUsers([])
        setRadarMaxDistance(200)
        setIsGhostMode(false)
        return
      }

      currentUserId = currentUser.uid
      const userDocRef = doc(db, 'users', currentUser.uid)
      
      unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
        if (!auth.currentUser) return
        if (docSnap.exists()) {
          const data = docSnap.data()
          const blocked = Array.isArray(data.blockedUsers) ? data.blockedUsers : []
          const parsed = parseDistanceToMeters(data.radarAccuracy, 200)
          const ghost = !!data.isGhostMode
          const locationEnabled = data.locationEnabled !== false

          userProfileRef.current = data
          blockedUsersRef.current = blocked
          radarMaxDistanceRef.current = parsed
          setBlockedUsers(blocked)
          setRadarMaxDistance(parsed)
          setIsGhostMode(ghost)

          const sparkRef = doc(db, "active_sparks", currentUser.uid)

          let inSafeZone = false;
          try {
            const pos = await getCurrentPositionStrict();
            inSafeZone = isPointInsideSafeZone(pos.lat, pos.lng, safeZonesRef.current)
          } catch (e) {}

          if (ghost || !locationEnabled || inSafeZone) {
            await deleteDoc(sparkRef).catch(() => {})
          } else {
            try {
              const pos = currentPositionRef.current || await getCurrentPositionStrict()
              const hash = geohashForLocation([pos.lat, pos.lng])

              await setDoc(sparkRef, {
                userId: currentUser.uid,
                userName: userProfileRef.current.userName || userProfileRef.current.username || userProfileRef.current.name || data.userName || data.username || data.name || currentUser.displayName || currentUser.email?.split('@')[0] || "Pulbi Kullanıcısı",
                photoURL: currentUser.photoURL || data.photoURL || null,
                lat: pos.lat,
                lng: pos.lng,
                hash,
                blockedUsers: blocked,
                isGhostMode: false,
                timestamp: serverTimestamp()
              }, { merge: true })
            } catch (err) {
              console.warn("GPS konumu alınamadı:", err)
            }
          }
        }
      })
    })

    const handleBeforeUnload = () => {
      if (currentUserId) {
        const sparkRef = doc(db, "active_sparks", currentUserId)
        deleteDoc(sparkRef).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      authUnsub()
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined
      if (!currentUser) return

      const q = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!auth.currentUser) return
        const chatMatches: Record<string, any> = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const participants = data.participants || [];
          const otherUserId = participants.find((id: string) => id !== currentUser.uid);
          if (!otherUserId) return;

          const hiddenFor = data.hiddenFor || [];
          const isDeletedByMe = hiddenFor.includes(currentUser.uid);
          const isDeletedByBoth = participants.every((pId: string) => hiddenFor.includes(pId));

          if (isDeletedByBoth) {
            chatMatches[otherUserId] = { type: 'spark' };
          } else if (isDeletedByMe) {
            chatMatches[otherUserId] = { type: 'deleted', chatId: docSnap.id };
          } else {
            chatMatches[otherUserId] = { type: 'chat', chatId: docSnap.id };
          }
        });

        setExistingMatches(prev => ({ ...prev, ...chatMatches }));
      });
    })

    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, []);

  useEffect(() => {
    if (!sparking) {
      setNearbyUsers([])
      setLiveNearbyCount(0)
      return
    }

    let unsubscribe: (() => void) | undefined

    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser) {
        setNearbyUsers([])
        setLiveNearbyCount(0)
        return
      }

      unsubscribe = onSnapshot(
        collection(db, "active_sparks"),
        async (snapshot) => {
          const activeUser = auth.currentUser
          if (!activeUser) return

          const myPos = currentPositionRef.current
          if (!myPos) return

          const blocked = blockedUsersRef.current
          const maxDistance = radarMaxDistanceRef.current
          const currentSafeZones = safeZonesRef.current
          const users: any[] = []

          let amIInSafeZone = isPointInsideSafeZone(myPos.lat, myPos.lng, currentSafeZones)

          if (amIInSafeZone) {
            const sparkRef = doc(db, "active_sparks", activeUser.uid);
            await deleteDoc(sparkRef).catch(() => {});
            setNearbyUsers([]);
            setLiveNearbyCount(0);
            return;
          }

          snapshot.docs.forEach((docSnap) => {
            if (docSnap.id === activeUser.uid) return

            const data = docSnap.data()
            const isBlockedByMe = blocked.includes(docSnap.id)
            const hasBlockedMe = data.blockedUsers?.includes(activeUser.uid)

            const sparkTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;
            const isStale = sparkTime > 0 && (Date.now() - sparkTime > 2 * 60 * 1000);

            if (data.lat && data.lng && !data.isGhostMode && !isBlockedByMe && !hasBlockedMe && !isStale) {
              const distanceMeters = calculateDistanceInMeters(myPos.lat, myPos.lng, data.lat, data.lng)
              let isTargetInMySafeZone = isPointInsideSafeZone(data.lat, data.lng, currentSafeZones)

              if (!isTargetInMySafeZone && distanceMeters <= maxDistance) {
                users.push({
                  id: docSnap.id,
                  userName: data.userName || data.username || data.name || "Pulbi Kullanıcısı",
                  photoURL: data.photoURL || null,
                  distance: distanceMeters,
                  blockedUsers: data.blockedUsers || [],
                  ...data,
                })
              }
            }
          })

          users.sort((a, b) => a.distance - b.distance)
          setNearbyUsers(users)
          setLiveNearbyCount(users.length)
        },
        (error) => {
          console.warn("Radar aktif kullanıcıları dinlenirken hata:", error)
        }
      )
    })

    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, [sparking])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser) return

      const q = query(collection(db, "spark_requests"), where("from", "==", currentUser.uid));
      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!auth.currentUser) return
        
        const newMatches: Record<string, any> = {};
        const now = Date.now();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const targetUserId = data.to;
          if (!targetUserId) return;

          const requestTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : now;
          const isExpired = now - requestTime >= SPARK_REQUEST_TIMEOUT_MS;

          if (isExpired && data.status === "pending") {
            deleteDoc(doc(db, "spark_requests", docSnap.id)).catch(() => {});
            newMatches[targetUserId] = { type: 'spark' };
            return;
          }

          if (data.status === "rejected") {
            newMatches[targetUserId] = { type: 'rejected', docId: docSnap.id, timestamp: now };
          } else if (data.status === "pending") {
            newMatches[targetUserId] = { type: 'pending', docId: docSnap.id, timestamp: requestTime };
          } else if (data.status === "accepted") {
            newMatches[targetUserId] = { type: 'chat', chatId: data.chatRoomId, docId: docSnap.id };
          }
        });

        setExistingMatches(newMatches);
        if (Object.values(newMatches).every((match) => match.type !== 'pending')) {
          setSelectedUser(null);
        }
      });
    })

    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser) {
        setIncomingSpark(null)
        return
      }

      const q = query(collection(db, "spark_requests"), where("to", "==", currentUser.uid), where("status", "==", "pending"));
      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!auth.currentUser) return
        if (snapshot.empty) {
          setIncomingSpark(null);
          return;
        }
        let foundValid = false;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (blockedUsersRef.current.includes(data.from)) return;
          
          const requestTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now();
          const elapsed = Date.now() - requestTime;

          if (elapsed < 30 * 1000) {
            setIncomingSpark({
              id: docSnap.id,
              fromUserId: data.from,
              fromUserName: data.fromUserName || "Bir kullanıcı",
              rejectCount: data.rejectCount || 0,
              timestamp: requestTime
            });
            foundValid = true;
          } else {
            deleteDoc(doc(db, "spark_requests", docSnap.id)).catch(() => {});
          }
        });
        if (!foundValid) setIncomingSpark(null);
      });
    })

    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, []);

  useEffect(() => {
    if (!incomingSpark) {
      setIncomingProgress(100);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - incomingSpark.timestamp;
      const remainingPercent = Math.max(0, 100 - (elapsed / SPARK_REQUEST_TIMEOUT_MS) * 100);
      setIncomingProgress(remainingPercent);

      if (remainingPercent <= 0) {
        deleteDoc(doc(db, "spark_requests", incomingSpark.id)).catch(() => {});
        setIncomingSpark(null);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [incomingSpark]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expiredUserIds = Object.entries(existingMatches)
        .filter(([, match]) =>
          match.type === 'pending' &&
          typeof match.timestamp === 'number' &&
          now - match.timestamp >= SPARK_REQUEST_TIMEOUT_MS
        )
        .map(([userId]) => userId);

      if (expiredUserIds.length === 0) return;

      setExistingMatches(prev => {
        const next = { ...prev };
        expiredUserIds.forEach(userId => {
          next[userId] = { type: 'spark' };
        });
        return next;
      });
      setSelectedUser(prev => expiredUserIds.includes(prev ?? '') ? null : prev);

      expiredUserIds.forEach(userId => {
        const request = existingMatches[userId];
        if (request?.docId) {
          void deleteDoc(doc(db, "spark_requests", request.docId)).catch((error) => {
            console.warn("Süresi dolan Spark isteği silinemedi:", error);
          });
        }
      });
    }, 250);

    return () => clearInterval(interval);
  }, [existingMatches]);

  useEffect(() => {
    const interval = setInterval(() => {
      const expiredRejectedUserIds = Object.entries(existingMatches)
        .filter(([, match]) =>
          match.type === 'rejected' &&
          typeof match.timestamp === 'number' &&
          Date.now() - match.timestamp >= REJECTED_STATUS_DISPLAY_MS
        )
        .map(([userId]) => userId);

      if (expiredRejectedUserIds.length === 0) return;

      setExistingMatches(prev => {
        const next = { ...prev };
        expiredRejectedUserIds.forEach(userId => {
          next[userId] = { type: 'spark' };
        });
        return next;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [existingMatches]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const authUnsub = onAuthStateChanged(auth, (currentUser) => {
      unsubscribe?.()
      unsubscribe = undefined

      if (!currentUser) {
        setSparking(false)
        setIncomingSpark(null)
        setMatchedRoom(null)
        return
      }

      const q = query(collection(db, "spark_requests"), where("from", "==", currentUser.uid), where("status", "==", "accepted"));
      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!auth.currentUser) return
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.chatRoomId) {
            setSparking(false);
            setIncomingSpark(null);
            setMatchedRoom(data.chatRoomId);
          }
        });
      });
    })

    return () => {
      authUnsub()
      unsubscribe?.()
    }
  }, []);

  const sendSparkRequest = async (targetUser: any) => {
    const currentUser = auth.currentUser
    if (!currentUser || blockedUsers.includes(targetUser.id)) return;
    
    setExistingMatches(prev => {
      const copy = { ...prev };
      delete copy[targetUser.id];
      return copy;
    });

    const oldQuery = query(collection(db, "spark_requests"), where("from", "==", currentUser.uid), where("to", "==", targetUser.id));
    const oldSnap = await getDocs(oldQuery);
    let previousRejectCount = 0;
    
    const deletePromises = oldSnap.docs.map(async (d) => {
      const dData = d.data();
      if (dData.rejectCount !== undefined) {
        previousRejectCount = dData.rejectCount;
      }
      await deleteDoc(doc(db, "spark_requests", d.id)).catch(() => {});
    });
    await Promise.all(deletePromises);

    const requestRef = await addDoc(collection(db, "spark_requests"), {
      from: currentUser.uid,
      fromUserName: userProfileRef.current.userName || userProfileRef.current.username || userProfileRef.current.name || currentUser.displayName || currentUser.email?.split('@')[0] || "Pulbi Kullanıcısı",
      to: targetUser.id,
      status: "pending",
      rejectCount: previousRejectCount,
      timestamp: serverTimestamp()
    })

    setSelectedUser(targetUser.id)
    setExistingMatches(prev => ({
      ...prev,
      [targetUser.id]: { type: 'pending', docId: requestRef.id, timestamp: Date.now() }
    }))
  }

  const handleConfirmOutgoingBlock = async () => {
    if (!blockPrompt) return
    const currentUser = auth.currentUser
    if (!currentUser) return

    try {
      await setDoc(
        doc(db, "users", currentUser.uid),
        { blockedUsers: arrayUnion(blockPrompt.userId) },
        { merge: true }
      )
      await setDoc(
        doc(db, "users", blockPrompt.userId),
        { blockedByUsers: arrayUnion(currentUser.uid) },
        { merge: true }
      )
      await setDoc(
        doc(db, "spark_requests", blockPrompt.requestId),
        { status: "blocked", blockedBy: currentUser.uid },
        { merge: true }
      )
      setBlockedUsers(prev => prev.includes(blockPrompt.userId) ? prev : [...prev, blockPrompt.userId])
      setExistingMatches(prev => {
        const next = { ...prev }
        delete next[blockPrompt.userId]
        return next
      })
      setSelectedUser(prev => prev === blockPrompt.userId ? null : prev)
      setBlockPrompt(null)
    } catch (error) {
      console.error("Kullanıcı engellenirken hata:", error)
    }
  }

  const handleAcceptSpark = async () => {
    if (!incomingSpark) return
    const currentUser = auth.currentUser
    if (!currentUser) return
    try {
      const currentUserName = userProfileRef.current.userName || userProfileRef.current.username || userProfileRef.current.name || currentUser.displayName || currentUser.email?.split('@')[0] || "Pulbi Kullanıcısı";
      
      const chatRoomRef = await addDoc(collection(db, "chats"), {
        participants: [incomingSpark.fromUserId, currentUser.uid],
        participantNames: {
          [currentUser.uid]: currentUserName,
          [incomingSpark.fromUserId]: incomingSpark.fromUserName
        },
        createdAt: serverTimestamp(),
        lastMessage: "Kesişme gerçekleşti, sohbet başladı!",
        hiddenFor: [],
        unreadCounts: {
          [incomingSpark.fromUserId]: 0,
          [currentUser.uid]: 0,
        }
      });

      const q = query(collection(db, "spark_requests"), where("from", "==", incomingSpark.fromUserId), where("to", "==", currentUser.uid));
      const snap = await getDocs(q);
      
      const updatePromises = snap.docs.map((d) => 
        setDoc(doc(db, "spark_requests", d.id), { 
          status: "accepted", 
          chatRoomId: chatRoomRef.id 
        }, { merge: true })
      );
      await Promise.all(updatePromises);

      setIncomingSpark(null);
      setSparking(false);
      setMatchedRoom(chatRoomRef.id);
    } catch (err) {
      console.warn("Kabul etme hatası:", err);
    }
  }

  const handleRejectSpark = async () => {
    if (!incomingSpark) return
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const q = query(collection(db, "spark_requests"), where("from", "==", incomingSpark.fromUserId), where("to", "==", currentUser.uid));
      const snap = await getDocs(q);
      
      snap.forEach(async (d) => {
        await setDoc(doc(db, "spark_requests", d.id), { status: "rejected", rejectCount: increment(1) }, { merge: true });
      });

      if (snap.empty) {
        await addDoc(collection(db, "spark_requests"), {
          from: incomingSpark.fromUserId,
          fromUserName: incomingSpark.fromUserName,
          to: currentUser.uid,
          status: "rejected",
          rejectCount: 1,
          timestamp: serverTimestamp()
        });
      }

      setIncomingSpark(null);
    } catch (err) {
      console.warn("Reddetme hatası:", err);
    }
  }

  const handleBlockAndReject = async () => {
    if (!incomingSpark) return;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, {
        blockedUsers: arrayUnion(incomingSpark.fromUserId)
      }, { merge: true });

      const q = query(collection(db, "spark_requests"), where("from", "==", incomingSpark.fromUserId), where("to", "==", currentUser.uid));
      const snap = await getDocs(q);
      snap.forEach(async (d) => {
        await deleteDoc(doc(db, "spark_requests", d.id)).catch(() => {});
      });

      setIncomingSpark(null);
    } catch (err) {
      console.warn("Engelleme hatası:", err);
    }
  }

  const dots = [
    { size: 'h-2.5 w-2.5', ring: 'h-[62%] w-[62%]', color: 'bg-primary', anim: 'animate-orbit', delay: '0s' },
    { size: 'h-2 w-2', ring: 'h-[62%] w-[62%]', color: 'bg-amber', anim: 'animate-orbit', delay: '-6s' },
    { size: 'h-1.5 w-1.5', ring: 'h-[84%] w-[84%]', color: 'bg-primary/70', anim: 'animate-orbit-rev', delay: '-3s' },
    { size: 'h-2 w-2', ring: 'h-[84%] w-[84%]', color: 'bg-amber/80', anim: 'animate-orbit-rev', delay: '-14s' },
  ]

  const filteredNearbyUsers = nearbyUsers.filter(user => {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;
    return !user.blockedUsers?.includes(currentUser.uid) && !blockedUsers.includes(user.id);
  })

  const isHarassment = incomingSpark && incomingSpark.rejectCount >= 3;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background">
      <LocationPermissionModal 
        isOpen={isLocationModalOpen}
        onGrant={() => {
          setIsLocationModalOpen(false);
          window.location.reload();
        }}
        onClose={() => {
          setIsLocationModalOpen(false);
        }}
      />

      {incomingSpark && !matchedRoom && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-[300px] overflow-hidden rounded-[28px] border border-white/10 bg-card/90 p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className={`mx-auto mb-4 mt-2 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ${isHarassment ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-primary/20 text-primary border border-primary/30'}`}>
              {isHarassment ? <AlertTriangle className="h-6 w-6 animate-bounce" /> : <Zap className="h-6 w-6 animate-bounce" />}
            </div>
            
            {isHarassment ? (
              <>
                <h3 className="text-base font-bold text-foreground">Rahatsız mı Ediliyorsun?</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">{incomingSpark.fromUserName}</span> sana defalarca istek attı ve reddettin. Bu kullanıcıyı engellemek ister misin?
                </p>
                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    onClick={handleBlockAndReject}
                    className="w-full rounded-2xl bg-red-500 py-3 text-xs font-bold text-white shadow-lg shadow-red-500/25 transition active:scale-95 hover:bg-red-600 flex items-center justify-center gap-2"
                  >
                    <Ban className="h-4 w-4" /> Engelle ve Reddet
                  </button>
                  <button
                    onClick={handleRejectSpark}
                    className="w-full rounded-2xl bg-secondary/80 py-2.5 text-xs font-semibold text-muted-foreground transition active:scale-95 hover:text-foreground"
                  >
                    Sadece Reddet
                  </button>
                  <button
                    onClick={handleAcceptSpark}
                    className="w-full rounded-2xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-95"
                  >
                    Kabul Et
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-foreground">Göz Göze Geldiniz!</h3>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">{incomingSpark.fromUserName}</span> sana bir Spark gönderdi.
                </p>
                <div className="mt-5 flex gap-2.5">
                  <button
                    onClick={handleRejectSpark}
                    className="w-1/2 rounded-2xl bg-secondary/80 py-3 text-xs font-semibold text-muted-foreground transition active:scale-95 hover:text-red-400"
                  >
                    Reddet ✕
                  </button>
                  <button
                    onClick={handleAcceptSpark}
                    className="w-1/2 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-95"
                  >
                    Kabul Et ✓
                  </button>
                </div>
              </>
            )}
            <div className="mt-5 space-y-1.5 text-left">
              <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                <span>İstek süresi</span>
                <span>{Math.ceil((incomingProgress / 100) * 30)} sn</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-violet-400 to-amber-300 transition-[width] duration-100 ease-linear"
                  style={{ width: `${incomingProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {blockPrompt && !incomingSpark && !matchedRoom && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-[300px] rounded-[28px] border border-white/10 bg-card/90 p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Ban className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">Bu kişiyi engellemek ister misin?</h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">{blockPrompt.userName}</span> gönderdiğin Spark isteklerini iki kez reddetti.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setBlockPrompt(null)}
                className="w-1/2 rounded-2xl bg-secondary/80 py-3 text-xs font-semibold text-muted-foreground transition active:scale-95"
              >
                Hayır
              </button>
              <button
                onClick={handleConfirmOutgoingBlock}
                className="w-1/2 rounded-2xl bg-red-500 py-3 text-xs font-bold text-white shadow-lg shadow-red-500/25 transition active:scale-95"
              >
                Evet, Engelle
              </button>
            </div>
          </div>
        </div>
      )}

      {matchedRoom && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-[300px] rounded-[28px] border border-white/10 bg-card/90 p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-primary border border-primary/30 shadow-lg">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-foreground">Yollarınız Kesişti!</h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Karşılıklı onay sağlandı, özel sohbet odanız hazır.
            </p>
            <button
              onClick={async () => {
                const currentUser = auth.currentUser;
                if (currentUser && matchedRoom) {
                  const q = query(collection(db, "spark_requests"), where("chatRoomId", "==", matchedRoom));
                  const snap = await getDocs(q);
                  const completionPromises = snap.docs.map((d: any) => 
                    setDoc(doc(db, "spark_requests", d.id), { status: "completed" }, { merge: true })
                  );
                  await Promise.all(completionPromises);
                }
                setMatchedRoom(null);
                onNavigate('chat');
              }}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-95"
            >
              <MessageCircle className="h-4 w-4" /> Sohbeti Aç
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[100px]" />
      
      <div className="relative z-10 flex items-center justify-between px-6 pt-14">
        <PulbiWordmark className="text-xl" />
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-card/60 px-3.5 py-1.5 text-xs backdrop-blur-xl shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/80" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-medium text-muted-foreground">
            {liveNearbyCount > 0 ? `${liveNearbyCount} kişi yakında` : "Bölgede kimse yok"}
          </span>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        {!sparking ? (
          <div className="relative flex h-80 w-80 items-center justify-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute h-full w-full rounded-full border border-primary/20 animate-radar"
                style={{ animationDelay: `${i * 1.05}s` }}
              />
            ))}
            <span className="absolute h-[70%] w-[70%] rounded-full border border-white/10" />
            <span className="absolute h-[45%] w-[45%] rounded-full border border-white/5" />
            {dots.map((d, i) => (
              <div key={i} className={`absolute ${d.ring} ${d.anim}`} style={{ animationDelay: d.delay }}>
                <span className={`absolute left-1/2 top-0 -translate-x-1/2 rounded-full ${d.size} ${d.color} shadow-[0_0_12px_currentColor]`} />
              </div>
            ))}
            <button
              type="button"
              onClick={handleSparkClick}
              disabled={isScanningAnim}
              className="group relative flex h-40 w-40 flex-col items-center justify-center rounded-full text-center transition-all duration-500 active:scale-95 border border-white/30 backdrop-blur-3xl overflow-hidden bg-gradient-to-tr from-[#6366f1] via-[#8b5cf6] to-[#ec4899] text-white shadow-[0_0_50px_rgba(139,92,246,0.5)] hover:shadow-[0_0_80px_rgba(139,92,246,0.8)]"
            >
              <span className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/30 pointer-events-none" />
              {isScanningAnim ? (
                <div className="relative z-10 flex flex-col items-center animate-pulse">
                  <Loader2 className="h-8 w-8 animate-spin text-white mb-1.5" />
                  <span className="text-xs font-extrabold tracking-wider">Taranıyor...</span>
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center">
                  <div className="mb-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-inner transition-transform duration-300 group-hover:scale-110">
                    <Zap className="h-6 w-6 text-white animate-pulse drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                  </div>
                  <span className="text-lg font-black tracking-wider">Pulbi</span>
                  <span className="text-[9px] font-semibold tracking-widest uppercase opacity-90 mt-0.5">Anlık Kesişme</span>
                </div>
              )}
            </button>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col pt-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                <Radar className="h-4 w-4 text-primary animate-spin" /> Etraftakiler ({radarMaxDistance}m Çevrede)
              </h3>
              <button 
                onClick={() => setSparking(false)} 
                className="flex items-center gap-1 text-xs text-red-400 font-semibold hover:opacity-80 transition"
              >
                <X className="h-3.5 w-3.5" /> Kapat
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
              {filteredNearbyUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <span className="relative flex h-3 w-3 mb-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                  </span>
                  <p className="text-xs text-muted-foreground font-medium">Bölgede {radarMaxDistance} metre yakınında kimse yok...</p>
                </div>
              ) : (
                filteredNearbyUsers.map((user) => {
                  const matchInfo = existingMatches[user.id];
                  const isAlreadyMatched = matchInfo?.type === 'chat';
                  const isDeletedMatch = matchInfo?.type === 'deleted';
                  const isSparkReset = matchInfo?.type === 'spark';
                  const isRejectedMatch = matchInfo?.type === 'rejected';
                  const isPending = matchInfo?.type === 'pending';
                  const isVeryClose = user.distance <= 5;

                  return (
                    <div 
                      key={user.id} 
                      className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 backdrop-blur-xl transition-all ${
                        isVeryClose 
                          ? 'border-primary/40 bg-primary/[0.08] shadow-lg shadow-primary/5' 
                          : 'border-white/10 bg-card/60 shadow-md'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3 flex-1">
                        <button
                          type="button"
                          onClick={() => onOpenProfile?.(user.id)}
                          className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-secondary/80 shadow-inner"
                        >
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.userName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenProfile?.(user.id)}
                          className="min-w-0 text-left flex-1"
                        >
                          <span className="block truncate text-sm font-bold text-foreground">
                            {user.userName}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <MapPin className={`h-3 w-3 shrink-0 ${isVeryClose ? 'text-primary animate-bounce' : 'text-muted-foreground'}`} />
                            <span className={`text-[11px] font-medium truncate ${isVeryClose ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                              {user.distance <= 1 ? '1m uzakta' : `${user.distance}m uzakta`}
                            </span>
                          </div>
                          {isDeletedMatch && (
                            <span className="block text-[10px] text-primary/80 font-medium mt-0.5">
                              Bu kişiyle daha önce eşleştiniz
                            </span>
                          )}
                        </button>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isRejectedMatch ? (
                          <div className="rounded-xl bg-red-500/20 border border-red-500/30 px-3 py-2 text-xs font-bold text-red-400 whitespace-nowrap">
                            Reddedildi
                          </div>
                        ) : isDeletedMatch ? (
                          <button
                            onClick={async () => {
                              const currentUser = auth.currentUser;
                              if (!currentUser || !matchInfo?.chatId) return;
                              
                              const chatRef = doc(db, "chats", matchInfo.chatId);
                              await setDoc(chatRef, {
                                hiddenFor: arrayRemove(currentUser.uid),
                                lastMessage: "Yeni bir başlangıç yapıldı...",
                                updatedAt: serverTimestamp()
                              }, { merge: true });

                              setMatchedRoom(null);
                              onNavigate('chat');
                            }}
                            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 transition active:scale-95 whitespace-nowrap"
                          >
                            Devam Et
                          </button>
                        ) : isSparkReset ? (
                          <button 
                            onClick={() => sendSparkRequest(user)}
                            disabled={isPending}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                              isPending 
                                ? 'bg-secondary text-muted-foreground border border-white/5' 
                                : 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:opacity-95 active:scale-95'
                            }`}
                          >
                            {isPending ? 'Bekliyor' : 'Spark At'}
                          </button>
                        ) : isAlreadyMatched ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-muted-foreground">Eşleştiniz</span>
                            {matchInfo?.chatId && (
                              <button
                                onClick={async () => {
                                  const currentUser = auth.currentUser;
                                  if (currentUser && matchInfo?.chatId) {
                                    const chatRef = doc(db, "chats", matchInfo.chatId);
                                    await setDoc(chatRef, {
                                      hiddenFor: arrayRemove(currentUser.uid)
                                    }, { merge: true });
                                  }
                                  setMatchedRoom(null);
                                  onNavigate('chat');
                                }}
                                className="rounded-xl bg-primary/20 px-3 py-1.5 text-xs font-bold text-primary transition active:scale-95 hover:bg-primary/30 whitespace-nowrap border border-primary/30"
                              >
                                Sohbet
                              </button>
                            )}
                          </div>
                        ) : (
                          <button 
                            onClick={() => sendSparkRequest(user)}
                            disabled={isPending}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                              isPending 
                                ? 'bg-secondary text-muted-foreground border border-white/5' 
                                : 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:opacity-95 active:scale-95'
                            }`}
                          >
                            {isPending ? 'Bekliyor' : 'Spark At'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 px-6 pb-6 text-center">
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground/80 font-medium">
          {sparking
            ? `Sadece ${radarMaxDistance} metre içindeki kişiler listelenir. Yakındaki kişileri keşfet!`
            : `Butona bas, çevrendeki ${radarMaxDistance} metre içindeki biriyle yollarınız kesişsin.`}
        </p>
      </div>
    </div>
  )
}