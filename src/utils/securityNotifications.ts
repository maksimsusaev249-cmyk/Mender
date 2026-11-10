import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export function getDeviceDetailsString(): string {
  const ua = navigator.userAgent;
  let os = 'Windows 11 / 10';
  if (ua.includes('Win')) os = 'Windows 11';
  else if (ua.includes('Mac')) os = 'macOS Apple';
  else if (ua.includes('Android')) os = 'Android Mobile';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device';
  else if (ua.includes('Linux')) os = 'Linux OS';

  let browser = 'Chrome';
  if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';

  return `${os} (${browser})`;
}

export async function sendSystemLoginSecurityNotification(uid: string, customCode?: string): Promise<string> {
  if (!uid) return '';
  try {
    const securityChatId = `chat_system_security_${uid}`;
    const device = getDeviceDetailsString();

    let ip = '178.154.201.55';
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (data.ip) ip = data.ip;
      }
    } catch {
      // fallback IP
    }

    const nowStr = new Date().toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' MSK';

    const randBuf = new Uint32Array(1);
    crypto.getRandomValues(randBuf);
    const verifyCode = customCode || String(100000 + (randBuf[0] % 900000));

    const chatRef = doc(db, 'chats', securityChatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        chatId: securityChatId,
        type: 'direct',
        visibility: 'private',
        name: 'Mender Безопасность',
        description: 'Системные уведомления о безопасности, новых входах и защите аккаунта',
        avatarUrl: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=150&auto=format&fit=crop&q=80',
        ownerId: uid,
        peerUserId: 'mender_security_bot',
        membersCount: 2,
        lastMessageText: `🔐 Вход с устройства: ${device}`,
        lastMessageType: 'text',
        lastMessageSenderId: 'mender_security_bot',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'chats', securityChatId, 'members', uid), {
        chatId: securityChatId,
        userId: uid,
        role: 'owner',
        displayName: 'Вы',
        avatarUrl: '',
        joinedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(chatRef, {
        lastMessageText: `🔐 Вход с устройства: ${device}`,
        updatedAt: serverTimestamp(),
      });
    }

    await setDoc(
      doc(db, 'users', uid, 'memberships', securityChatId),
      {
        userId: uid,
        chatId: securityChatId,
        role: 'owner',
        isPinned: true,
        isMuted: false,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const msgId = `msg_sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const msgContent = `🔐 Вход в аккаунт с нового устройства\n\n📍 Данные авторизации:\n• Устройство: ${device}\n• IP-адрес: ${ip}\n• Время входа: ${nowStr}\n• Код подтверждения для входа: ${verifyCode}\n\nПодтвердите, вы ли совершили этот вход:`;

    await setDoc(doc(db, 'chats', securityChatId, 'messages', msgId), {
      messageId: msgId,
      chatId: securityChatId,
      senderId: 'mender_security_bot',
      senderName: 'Mender Безопасность',
      senderAvatar: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=150&auto=format&fit=crop&q=80',
      recipientId: uid,
      chatVisibility: 'private',
      type: 'text',
      content: msgContent,
      mediaUrl: '',
      duration: 0,
      status: 'delivered',
      likesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return verifyCode;
  } catch (err) {
    console.error('Failed to send security notification:', err);
    return '';
  }
}
