import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';

interface NotifData {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedObjectiveId: string | null;
  fromUserName: string | null;
  isRead: boolean;
  createdAt: string;
}

const POLL_INTERVAL = 15000;

export default function NotificationToast() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<NotifData | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const lastCheckRef = useRef<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((notif: NotifData) => {
    setToast(notif);
    slideAnim.setValue(-120);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      hideToast();
    }, 5000);
  }, []);

  const hideToast = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, []);

  const handleTap = useCallback(async () => {
    if (!toast) return;
    try {
      await apiRequest("PUT", `/api/notifications/${toast.id}/read`);
    } catch {}
    hideToast();
    if (toast.relatedObjectiveId) {
      router.push({ pathname: '/objective/[id]', params: { id: toast.relatedObjectiveId } });
    } else {
      router.push('/notifications');
    }
  }, [toast]);

  useEffect(() => {
    if (!user) return;

    const checkNew = async () => {
      try {
        const res = await apiRequest("GET", "/api/notifications");
        const data: NotifData[] = await res.json();
        const unread = data.filter(n => !n.isRead).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        if (unread.length > 0) {
          const newest = unread[0];
          if (lastCheckRef.current && newest.createdAt > lastCheckRef.current) {
            showToast(newest);
          }
          lastCheckRef.current = newest.createdAt;
        }
        if (!lastCheckRef.current && unread.length === 0) {
          lastCheckRef.current = new Date().toISOString();
        }
        if (!lastCheckRef.current && unread.length > 0) {
          lastCheckRef.current = unread[0].createdAt;
        }
      } catch {}
    };

    checkNew();
    const interval = setInterval(checkNew, POLL_INTERVAL);
    return () => {
      clearInterval(interval);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [user]);

  if (!toast) return null;

  const topOffset = Platform.OS === 'web' ? 12 : insets.top + 4;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: topOffset, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Pressable onPress={handleTap} style={({ pressed }) => [styles.toast, { opacity: pressed ? 0.9 : 1 }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="chatbubble-ellipses" size={20} color={Colors.white} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.toastTitle} numberOfLines={1}>{toast.title}</Text>
          <Text style={styles.toastContent} numberOfLines={1}>{toast.content}</Text>
        </View>
        <Pressable onPress={hideToast} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Ionicons name="close" size={18} color={Colors.white + '80'} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 12,
    paddingRight: 14,
    ...Platform.select({
      web: { boxShadow: '0 4px 20px rgba(0,0,0,0.25)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
      },
    }),
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  toastTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.white },
  toastContent: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.white + 'CC', marginTop: 2 },
});
