import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();

// 1. SOHBET MESAJI BİLDİRİMİ
export const onNewMessage = functions.firestore
  .document("chats/{chatId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    const senderId = messageData.senderId;
    const text = messageData.text || "Yeni bir mesaj gönderdi.";
    const chatId = context.params.chatId;

    const chatDoc = await admin.firestore()
      .collection("chats")
      .doc(chatId)
      .get();
    if (!chatDoc.exists) return null;

    const chatData = chatDoc.data();
    const participants: string[] = chatData?.participants || [];

    const receiverId = participants.find((id) => id !== senderId);
    if (!receiverId) return null;

    const participantNames = chatData?.participantNames || {};
    const senderName = participantNames[senderId] || "Biri";

    const userDoc = await admin.firestore()
      .collection("users")
      .doc(receiverId)
      .get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    const prefs = userData?.notificationPreferences;

    // Ayarlardan bildirimler kapalıysa veya global 'all' veya sohbet bildirimleri kapalıysa gönderme
    if (prefs) {
      if (prefs.all === false) return null;
      if (prefs.sohbetMesajlari === false || prefs.messages === false) return null;
    }
    if (userData?.settings?.messageNotifications === false) {
      return null;
    }

    const fcmToken = userData?.fcmToken;
    if (!fcmToken) return null;

    const payload = {
      notification: {
        title: `${senderName} sana bir mesaj gönderdi`,
        body: text,
      },
      token: fcmToken,
    };

    try {
      await admin.messaging().send(payload);
    } catch (error) {
      console.error("Mesaj bildirim hatası:", error);
    }

    return null;
  });

// 2. YAKINLARDA KAPSÜL OLUŞTU BİLDİRİMİ
export const onNewCapsule = functions.firestore
  .document("capsules/{capsuleId}")
  .onCreate(async (snap) => {
    const capsuleData = snap.data();
    const authorId = capsuleData.authorId;
    const authorName = capsuleData.authorName || "İsimsiz";

    const usersSnapshot = await admin.firestore()
      .collection("users")
      .get();
    const notifications: Promise<unknown>[] = [];

    usersSnapshot.forEach((userDoc) => {
      const userId = userDoc.id;
      if (userId !== authorId) {
        const userData = userDoc.data();
        const prefs = userData?.notificationPreferences;

        if (prefs) {
          if (prefs.all === false) return;
          if (prefs.yakinlardaKapsul === false || prefs.capsuleNearby === false) {
            return;
          }
        }

        const fcmToken = userData?.fcmToken;

        if (fcmToken) {
          const payload = {
            notification: {
              title: "Yeni Bir Zaman Kapsülü Bırakıldı! ⏳",
              body: `${authorName} etrafında yeni bir kapsül bıraktı.`,
            },
            token: fcmToken,
          };

          notifications.push(
            admin.messaging().send(payload).catch((err) => {
              console.error("Kapsül bildirim hatası:", err);
            })
          );
        }
      }
    });

    await Promise.all(notifications);
    return null;
  });

// 3. RADAR EŞLEŞME İSTEĞİ BİLDİRİMİ
export const onNewRadarMatchRequest = functions.firestore
  .document("radarRequests/{requestId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const receiverId = data?.receiverId;
    const senderName = data?.senderName || "Biri";

    if (!receiverId) return null;

    const userDoc = await admin.firestore().collection("users").doc(receiverId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    const prefs = userData?.notificationPreferences;

    if (prefs) {
      if (prefs.all === false) return null;
      if (prefs.radarEslemeIstekleri === false) return null;
    }

    const fcmToken = userData?.fcmToken;
    if (!fcmToken) return null;

    const payload = {
      notification: {
        title: "Yeni Radar Eşleşme İsteği! 📡",
        body: `${senderName} radar üzerinden seninle eşleşmek istiyor.`,
      },
      token: fcmToken,
    };

    try {
      await admin.messaging().send(payload);
    } catch (error) {
      console.error("Radar eşleşme bildirim hatası:", error);
    }
    return null;
  });

// 4. YANKILAR EŞLEŞME İSTEĞİ BİLDİRİMİ
export const onNewEchoRequest = functions.firestore
  .document("echoRequests/{requestId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const receiverId = data?.receiverId;
    const senderName = data?.senderName || "Biri";

    if (!receiverId) return null;

    const userDoc = await admin.firestore().collection("users").doc(receiverId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    const prefs = userData?.notificationPreferences;

    if (prefs) {
      if (prefs.all === false) return null;
      if (prefs.yankilarEslemeIstekleri === false) return null;
    }

    const fcmToken = userData?.fcmToken;
    if (!fcmToken) return null;

    const payload = {
      notification: {
        title: "Yeni Yankı Etkileşimi! 💫",
        body: `${senderName} sana bir yankı isteği gönderdi.`,
      },
      token: fcmToken,
    };

    try {
      await admin.messaging().send(payload);
    } catch (error) {
      console.error("Yankı bildirim hatası:", error);
    }
    return null;
  });

// 5. RADAR KESİŞME BİLDİRİMİ
export const onRadarIntersection = functions.firestore
  .document("intersections/{intersectionId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const userId = data?.userId;
    const message = data?.message || "Biriyle yollarınız kesişti!";

    if (!userId) return null;

    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();
    const prefs = userData?.notificationPreferences;

    if (prefs) {
      if (prefs.all === false) return null;
      if (prefs.radarKesismeBildirimleri === false) return null;
    }

    const fcmToken = userData?.fcmToken;
    if (!fcmToken) return null;

    const payload = {
      notification: {
        title: "Radar Kesişmesi! 📍",
        body: message,
      },
      token: fcmToken,
    };

    try {
      await admin.messaging().send(payload);
    } catch (error) {
      console.error("Kesişme bildirim hatası:", error);
    }
    return null;
  });

// 6. KAPSÜL OKUNDU BİLDİRİMİ
export const onCapsuleRead = functions.firestore
  .document("capsules/{capsuleId}")
  .onUpdate(async (change) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    if (!beforeData?.isRead && afterData?.isRead) {
      const authorId = afterData?.authorId;
      const readerName = afterData?.readerName || "Biri";

      if (!authorId) return null;

      const userDoc = await admin.firestore().collection("users").doc(authorId).get();
      if (!userDoc.exists) return null;

      const userData = userDoc.data();
      const prefs = userData?.notificationPreferences;

      if (prefs) {
        if (prefs.all === false) return null;
        if (prefs.kapsulOkunduBildirimi === false) return null;
      }

      const fcmToken = userData?.fcmToken;
      if (!fcmToken) return null;

      const payload = {
        notification: {
          title: "Zaman Kapsülün Okundu! 📖",
          body: `${readerName} bıraktığın kapsülü okudu.`,
        },
        token: fcmToken,
      };

      try {
        await admin.messaging().send(payload);
      } catch (error) {
        console.error("Kapsül okundu bildirim hatası:", error);
      }
    }
    return null;
  });