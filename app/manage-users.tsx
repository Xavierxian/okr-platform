import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  dept_admin: '部门管理员',
  member: '普通成员',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: Colors.danger,
  dept_admin: Colors.accent,
  member: Colors.info,
};

interface UserItem {
  id: string;
  username: string;
  displayName: string;
  role: string;
  departmentId: string | null;
  createdAt: string;
}

export default function ManageUsersScreen() {
  const { departments } = useOKR();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/users");
      const data = await res.json();
      setUsers(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = (user: UserItem) => {
    if (user.role === 'super_admin') {
      Alert.alert('提示', '不能删除超级管理员');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('删除用户', `确定删除用户"${user.displayName}"吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest("DELETE", `/api/users/${user.id}`);
            setUsers(prev => prev.filter(u => u.id !== user.id));
          } catch { Alert.alert('错误', '删除失败'); }
        },
      },
    ]);
  };

  const handleChangeRole = (user: UserItem) => {
    if (user.role === 'super_admin') return;
    const roles = ['member', 'dept_admin'] as const;
    const nextRole = user.role === 'member' ? 'dept_admin' : 'member';
    Alert.alert('修改角色', `将 ${user.displayName} 的角色改为 ${ROLE_LABELS[nextRole]}？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          try {
            await apiRequest("PUT", `/api/users/${user.id}`, { role: nextRole });
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: nextRole } : u));
          } catch { Alert.alert('错误', '更新失败'); }
        },
      },
    ]);
  };

  const getDeptName = (deptId: string | null) => {
    if (!deptId) return '未分配';
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || '未知';
  };

  const renderUser = ({ item }: { item: UserItem }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color={ROLE_COLORS[item.role] || Colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{item.displayName}</Text>
          <Text style={styles.userUsername}>@{item.username}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[item.role] || Colors.info) + '20' }]}>
          <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] || Colors.info }]}>{ROLE_LABELS[item.role] || item.role}</Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="business-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{getDeptName(item.departmentId)}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => handleChangeRole(item)} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="swap-horizontal-outline" size={16} color={Colors.primary} />
          <Text style={styles.actionText}>切换角色</Text>
        </Pressable>
        {item.role !== 'super_admin' && (
          <Pressable onPress={() => handleDelete(item)} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>用户管理</Text>
        <Pressable
          onPress={() => router.push('/create-user')}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="add" size={20} color={Colors.white} />
          <Text style={styles.addBtnText}>新增</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          scrollEnabled={!!users.length}
          onRefresh={fetchUsers}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>暂无用户</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.white },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: Colors.backgroundTertiary, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  userName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  userUsername: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 10, paddingLeft: 52 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10, paddingLeft: 52 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.primary },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textTertiary },
});
