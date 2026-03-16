import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

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

  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <View style={styles.container}>
      {/* 固定在顶部的标题栏 */}
      <View style={[styles.stickyHeader, { paddingTop: topPadding }]}>
        <View style={styles.headerContent}>
          <View style={styles.titleSection}>
            <View>
              <Text style={styles.mainTitle}>消息通知</Text>
              <Text style={styles.subtitle}>
                {unreadCount > 0 ? `${unreadCount} 条未读` : '暂无新消息'}
              </Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <Pressable 
                onPress={handleMarkAllRead} 
                style={({ pressed }) => [styles.markAllBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="checkmark-done-outline" size={18} color="#0082EF" />
                <Text style={styles.markAllText}>全部已读</Text>
              </Pressable>
            )}
            <Pressable 
              onPress={() => router.back()} 
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="close" size={22} color="#5E6D82" />
            </Pressable>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingTop: topPadding + 100 }]}
          scrollEnabled={!!notifs.length}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
              <Pressable
                onPress={() => handleTap(item)}
                style={({ pressed }) => [
                  styles.notifCard,
                  !item.isRead && styles.notifUnread,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={[styles.notifIcon, { backgroundColor: item.isRead ? '#F5F6F7' : '#E6F4FF' }]}>
                  <Ionicons 
                    name={item.isRead ? "mail-open-outline" : "mail-unread-outline"} 
                    size={20} 
                    color={item.isRead ? '#8F9BB3' : '#0082EF'} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleUnread]}>{item.title}</Text>
                  <Text style={styles.notifContent} numberOfLines={2}>{item.content}</Text>
                  <View style={styles.notifMeta}>
                    <Ionicons name="time-outline" size={12} color="#8F9BB3" />
                    <Text style={styles.notifTime}>
                      {new Date(item.createdAt).toLocaleDateString('zh-CN')} {new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                {!item.isRead && <View style={styles.unreadDot} />}
              </Pressable>
            </Animated.View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="notifications-off-outline" size={48} color="#0082EF" />
              </View>
              <Text style={styles.emptyTitle}>暂无通知</Text>
              <Text style={styles.emptyText}>当有人@您或更新进度时，您将收到通知</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  
  // 固定在顶部的标题栏
  stickyHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEEF5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 100,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleSection: {
    flex: 1,
  },
  mainTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#171A1D',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#8F9BB3',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  markAllText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#0082EF',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F6F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 40 },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EBEEF5',
  },
  notifUnread: {
    backgroundColor: '#F0F7FF',
    borderLeftWidth: 3,
    borderLeftColor: '#0082EF',
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#5E6D82',
  },
  notifTitleUnread: {
    color: '#171A1D',
  },
  notifContent: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#5E6D82',
    marginTop: 4,
    lineHeight: 18,
  },
  notifMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  notifTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#8F9BB3',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0082EF',
    marginTop: 6,
  },
  
  // 空状态样式
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E6F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#171A1D',
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#8F9BB3',
    textAlign: 'center',
  },
});
