import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Alert, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

export default function ManageDepartmentsScreen() {
  const { departments, refresh } = useOKR();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleDelete = (id: string, name: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const doDelete = async () => {
      try {
        await apiRequest("DELETE", `/api/departments/${id}`);
        await refresh();
      } catch {
        if (Platform.OS === 'web') window.alert('删除失败');
        else Alert.alert('错误', '删除失败');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`确定删除部门"${name}"吗？该操作不可恢复。`)) doDelete();
    } else {
      Alert.alert('删除部门', `确定删除"${name}"吗？该操作不可恢复。`, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await apiRequest("PUT", `/api/departments/${id}`, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      await refresh();
    } catch { Alert.alert('错误', '更新失败'); }
  };

  const renderDept = ({ item }: { item: typeof departments[0] }) => {
    const isEditing = editingId === item.id;
    return (
      <View style={[styles.card, { marginLeft: item.level * 20 }]}>
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              autoFocus
            />
            <Pressable onPress={() => handleEdit(item.id)} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="checkmark" size={20} color={Colors.success} />
            </Pressable>
            <Pressable onPress={() => { setEditingId(null); setEditName(''); }} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="close" size={20} color={Colors.textTertiary} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.cardRow}>
            <View style={[styles.levelDot, { backgroundColor: item.level === 0 ? Colors.primary : Colors.accent }]} />
            <Text style={styles.deptName}>{item.name}</Text>
            <Pressable onPress={() => { setEditingId(item.id); setEditName(item.name); }} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="create-outline" size={18} color={Colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => handleDelete(item.id, item.name)} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>部门管理</Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push('/create-department')}
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
      <FlatList
        data={departments}
        keyExtractor={item => item.id}
        renderItem={renderDept}
        contentContainerStyle={styles.list}
        scrollEnabled={!!departments.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>暂无部门</Text>
          </View>
        }
      />
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
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 14, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelDot: { width: 8, height: 8, borderRadius: 4 },
  deptName: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.text, flex: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editInput: { flex: 1, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textTertiary },
});
