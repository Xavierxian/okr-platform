import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Alert, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

export default function ManageCyclesScreen() {
  const { cycles, refresh } = useOKR();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editOrder, setEditOrder] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOrder, setNewOrder] = useState('');

  const handleDelete = useCallback((id: string, name: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const doDelete = async () => {
      try {
        await apiRequest("DELETE", `/api/cycles/${id}`);
        await refresh();
      } catch {
        if (Platform.OS === 'web') window.alert('删除失败');
        else Alert.alert('错误', '删除失败');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`确定删除周期"${name}"吗？该操作不可恢复。`)) doDelete();
    } else {
      Alert.alert('删除周期', `确定删除"${name}"吗？该操作不可恢复。`, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [refresh]);

  const handleEdit = useCallback(async (id: string) => {
    if (!editName.trim()) return;
    try {
      await apiRequest("PUT", `/api/cycles/${id}`, {
        name: editName.trim(),
        sortOrder: parseInt(editOrder) || 0,
      });
      setEditingId(null);
      setEditName('');
      setEditOrder('');
      await refresh();
    } catch (err: any) {
      const msg = err?.message || '更新失败';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('错误', msg);
    }
  }, [editName, editOrder, refresh]);

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      await apiRequest("POST", "/api/cycles", {
        name: newName.trim(),
        sortOrder: parseInt(newOrder) || (cycles.length + 1),
      });
      setNewName('');
      setNewOrder('');
      setAddMode(false);
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const msg = err?.message || '创建失败';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('错误', msg);
    }
  }, [newName, newOrder, cycles.length, refresh]);

  const renderCycle = ({ item, index }: { item: typeof cycles[0]; index: number }) => {
    const isEditing = editingId === item.id;
    return (
      <View style={styles.card}>
        {isEditing ? (
          <View style={styles.editContainer}>
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { flex: 1 }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="周期名称"
                placeholderTextColor={Colors.textTertiary}
                autoFocus
              />
              <TextInput
                style={[styles.editInput, { width: 60 }]}
                value={editOrder}
                onChangeText={setEditOrder}
                placeholder="排序"
                placeholderTextColor={Colors.textTertiary}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.editActions}>
              <Pressable onPress={() => handleEdit(item.id)} style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <Text style={styles.saveBtnText}>保存</Text>
              </Pressable>
              <Pressable onPress={() => { setEditingId(null); setEditName(''); setEditOrder(''); }} style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.cardRow}>
            <View style={styles.orderBadge}>
              <Text style={styles.orderText}>{item.sortOrder}</Text>
            </View>
            <Text style={styles.cycleName}>{item.name}</Text>
            <Pressable onPress={() => { setEditingId(item.id); setEditName(item.name); setEditOrder(String(item.sortOrder)); }} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}>
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
        <Text style={styles.headerTitle}>周期管理</Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setAddMode(true)}
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

      {addMode && (
        <View style={styles.addCard}>
          <Text style={styles.addTitle}>新增周期</Text>
          <View style={styles.editRow}>
            <TextInput
              style={[styles.editInput, { flex: 1 }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="如：2026 第二季度"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
            <TextInput
              style={[styles.editInput, { width: 60 }]}
              value={newOrder}
              onChangeText={setNewOrder}
              placeholder="排序"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.editActions}>
            <Pressable onPress={handleAdd} style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={styles.saveBtnText}>创建</Text>
            </Pressable>
            <Pressable onPress={() => { setAddMode(false); setNewName(''); setNewOrder(''); }} style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={cycles}
        keyExtractor={item => item.id}
        renderItem={renderCycle}
        contentContainerStyle={styles.list}
        scrollEnabled={!!cycles.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>暂无周期，请添加</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EBEEF5' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#171A1D' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0082EF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, shadowColor: '#0082EF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  addBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#FFFFFF' },
  list: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#EBEEF5' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E6F4FF', alignItems: 'center', justifyContent: 'center' },
  orderText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#0082EF' },
  cycleName: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#171A1D', flex: 1 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addCard: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#0082EF30', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  addTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#171A1D', marginBottom: 10 },
  editContainer: { gap: 10 },
  editRow: { flexDirection: 'row', gap: 8 },
  editInput: { flex: 1, backgroundColor: '#F5F6F7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#171A1D', borderWidth: 1, borderColor: '#EBEEF5' },
  editActions: { flexDirection: 'row', gap: 8 },
  saveBtn: { backgroundColor: '#0082EF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, shadowColor: '#0082EF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  saveBtnText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#FFFFFF' },
  cancelBtn: { backgroundColor: '#F5F6F7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#EBEEF5' },
  cancelBtnText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#5E6D82' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#8F9BB3' },
});
