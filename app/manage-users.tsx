import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Alert, ActivityIndicator, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  vp: 'VP',
  center_head: '中心负责人',
  member: '普通员工和部门经理',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: Colors.danger,
  vp: '#8B5CF6',
  center_head: Colors.accent,
  member: Colors.info,
};

interface UserItem {
  id: string;
  username: string;
  displayName: string;
  role: string;
  departmentId: string | null;
  departmentIds?: string[];
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'member', label: '普通员工和部门经理' },
  { value: 'center_head', label: '中心负责人' },
  { value: 'vp', label: 'VP' },
  { value: 'super_admin', label: '超级管理员' },
];

export default function ManageUsersScreen() {
  const { departments } = useOKR();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleModalUser, setRoleModalUser] = useState<UserItem | null>(null);
  const [deptModalUser, setDeptModalUser] = useState<UserItem | null>(null);
  const [deptModalSelected, setDeptModalSelected] = useState<string[]>([]);

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

  const doDelete = async (user: UserItem) => {
    try {
      await apiRequest("DELETE", `/api/users/${user.id}`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch {
      if (Platform.OS === 'web') { window.alert('删除失败'); }
      else { Alert.alert('错误', '删除失败'); }
    }
  };

  const handleDelete = (user: UserItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (Platform.OS === 'web') {
      if (window.confirm(`确定删除用户"${user.displayName}"吗？`)) {
        doDelete(user);
      }
    } else {
      Alert.alert('删除用户', `确定删除用户"${user.displayName}"吗？`, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => doDelete(user) },
      ]);
    }
  };

  const handleChangeRole = (user: UserItem) => {
    if (user.username === 'admin') return;
    setRoleModalUser(user);
  };

  const applyRoleChange = async (newRole: string) => {
    if (!roleModalUser) return;
    try {
      await apiRequest("PUT", `/api/users/${roleModalUser.id}`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === roleModalUser.id ? { ...u, role: newRole } : u));
    } catch {
      if (Platform.OS === 'web') { window.alert('更新失败'); }
      else { Alert.alert('错误', '更新失败'); }
    }
    setRoleModalUser(null);
  };

  const handleEditDepts = (user: UserItem) => {
    setDeptModalUser(user);
    setDeptModalSelected(user.departmentIds || (user.departmentId ? [user.departmentId] : []));
  };

  const toggleDeptSelection = (deptId: string) => {
    setDeptModalSelected(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const applyDeptChange = async () => {
    if (!deptModalUser) return;
    try {
      await apiRequest("PUT", `/api/users/${deptModalUser.id}`, { departmentIds: deptModalSelected });
      setUsers(prev => prev.map(u => u.id === deptModalUser.id ? {
        ...u,
        departmentIds: deptModalSelected,
        departmentId: deptModalSelected[0] || null,
      } : u));
    } catch {
      if (Platform.OS === 'web') { window.alert('更新失败'); }
      else { Alert.alert('错误', '更新失败'); }
    }
    setDeptModalUser(null);
  };

  const getDeptNames = (item: UserItem) => {
    const ids = item.departmentIds || (item.departmentId ? [item.departmentId] : []);
    if (ids.length === 0) return '未分配';
    return ids.map(id => {
      const dept = departments.find(d => d.id === id);
      return dept?.name || '未知';
    }).join('、');
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
      <Pressable onPress={() => handleEditDepts(item)} style={({ pressed }) => [styles.cardMeta, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.metaItem}>
          <Ionicons name="business-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{getDeptNames(item)}</Text>
          <Ionicons name="create-outline" size={12} color={Colors.primary} style={{ marginLeft: 4 }} />
        </View>
      </Pressable>
      {item.username !== 'admin' && (
        <View style={styles.actions}>
          <Pressable onPress={() => handleChangeRole(item)} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="swap-horizontal-outline" size={16} color={Colors.primary} />
            <Text style={styles.actionText}>切换角色</Text>
          </Pressable>
          <Pressable onPress={() => handleDelete(item)} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>用户管理</Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push('/create-user')}
            style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="add" size={20} color={Colors.white} />
            <Text style={styles.addBtnText}>新增</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>
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

      <Modal visible={!!roleModalUser} transparent animationType="fade" onRequestClose={() => setRoleModalUser(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRoleModalUser(null)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>切换角色</Text>
            <Text style={styles.modalSub}>{roleModalUser?.displayName}</Text>
            {ROLE_OPTIONS.filter(r => r.value !== roleModalUser?.role).map(r => (
              <Pressable key={r.value} onPress={() => applyRoleChange(r.value)} style={({ pressed }) => [styles.modalOption, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.modalDot, { backgroundColor: ROLE_COLORS[r.value] || Colors.info }]} />
                <Text style={styles.modalOptionText}>{r.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setRoleModalUser(null)} style={({ pressed }) => [styles.modalCancel, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={styles.modalCancelText}>取消</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!deptModalUser} transparent animationType="fade" onRequestClose={() => setDeptModalUser(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDeptModalUser(null)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>编辑所属中心</Text>
            <Text style={styles.modalSub}>{deptModalUser?.displayName}（可多选）</Text>
            <View style={styles.deptChipRow}>
              {departments.map(dept => {
                const selected = deptModalSelected.includes(dept.id);
                return (
                  <Pressable
                    key={dept.id}
                    onPress={() => toggleDeptSelection(dept.id)}
                    style={[styles.deptChip, selected && styles.deptChipActive]}
                  >
                    <Text style={[styles.deptChipText, selected && styles.deptChipTextActive]}>{dept.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            {deptModalSelected.length === 0 && (
              <Text style={styles.deptHint}>未选择任何中心</Text>
            )}
            <Pressable onPress={applyDeptChange} style={({ pressed }) => [styles.deptSaveBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Text style={styles.deptSaveBtnText}>确认</Text>
            </Pressable>
            <Pressable onPress={() => setDeptModalUser(null)} style={({ pressed }) => [styles.modalCancel, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={styles.modalCancelText}>取消</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, width: 300 },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text, textAlign: 'center', marginBottom: 4 },
  modalSub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalDot: { width: 10, height: 10, borderRadius: 5 },
  modalOptionText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.text },
  modalCancel: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  modalCancelText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.textSecondary },
  deptChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  deptChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.backgroundTertiary },
  deptChipActive: { backgroundColor: Colors.primary },
  deptChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  deptChipTextActive: { color: Colors.white },
  deptHint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginBottom: 8 },
  deptSaveBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  deptSaveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.white },
});
