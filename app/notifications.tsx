import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

interface NotifItem {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedKrId: string | null;
  relatedObjectiveId: string | null;
  fromUserName: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/notifications");
      const data = await res.json();
      data.sort((a: NotifItem, b: NotifItem) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifs(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchNotifs(); }, []);

  const handleMarkAllRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiRequest("PUT", "/api/notifications/read-all");
      setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const handleTap = async (notif: NotifItem) => {
    if (!notif.isRead) {
      try {
        await apiRequest("PUT", `/api/notifications/${notif.id}/read`);
        setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      } catch {}
    }
    if (notif.relatedObjectiveId) {
      router.push({ pathname: '/objective/[id]', params: { id: notif.relatedObjectiveId } });
    }
  };

  const topPadding = Platform.OS === 'web' ? 67 : 0;
  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>消息通知</Text>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllRead} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Text style={styles.markAllText}>全部已读</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          scrollEnabled={!!notifs.length}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleTap(item)}
              style={({ pressed }) => [
                styles.notifCard,
                !item.isRead && styles.notifUnread,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.notifIcon, { backgroundColor: item.isRead ? Colors.backgroundTertiary : Colors.primary + '15' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={item.isRead ? Colors.textTertiary : Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifTitle, !item.isRead && { color: Colors.text }]}>{item.title}</Text>
                <Text style={styles.notifContent} numberOfLines={2}>{item.content}</Text>
                <Text style={styles.notifTime}>{new Date(item.createdAt).toLocaleDateString('zh-CN')} {new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              {!item.isRead && <View style={styles.unreadDot} />}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>暂无通知</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: Colors.text, flex: 1 },
  markAllText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.primary },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  notifCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 8 },
  notifUnread: { backgroundColor: Colors.primary + '08', borderLeftWidth: 3, borderLeftColor: Colors.primary },
  notifIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textSecondary },
  notifContent: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  notifTime: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textTertiary },
});
