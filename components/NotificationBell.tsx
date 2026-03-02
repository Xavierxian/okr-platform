import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiRequest } from '@/lib/query-client';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';

export default function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const fetchCount = async () => {
      try {
        const res = await apiRequest("GET", "/api/notifications/unread-count");
        const data = await res.json();
        if (mounted) setCount(data.count || 0);
      } catch {}
    };

    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, [user]);

  return (
    <Pressable onPress={() => router.push('/notifications')} style={({ pressed }) => [styles.bell, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={count > 0 ? "notifications" : "notifications-outline"} size={22} color={count > 0 ? Colors.primary : Colors.textSecondary} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 2, backgroundColor: Colors.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: Colors.white },
});
