import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

const ROLES = [
  { value: 'member', label: '普通员工和部门经理' },
  { value: 'center_head', label: '中心负责人' },
  { value: 'vp', label: 'VP' },
  { value: 'super_admin', label: '超级管理员' },
];

export default function CreateUserScreen() {
  const { departments } = useOKR();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('member');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');

  const canSave = username.trim() && password.trim() && displayName.trim();

  const toggleDept = (deptId: string) => {
    setSelectedDeptIds(prev =>
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const filteredDepts = useMemo(() => {
    if (!deptSearch.trim()) return departments;
    return departments.filter(d => d.name.toLowerCase().includes(deptSearch.trim().toLowerCase()));
  }, [departments, deptSearch]);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiRequest("POST", "/api/users", {
        username: username.trim(),
        password: password.trim(),
        displayName: displayName.trim(),
        role,
        departmentIds: selectedDeptIds,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      const msg = err?.message || '创建失败';
      const match = msg.match(/\d+:\s*(.*)/);
      Alert.alert('错误', match ? match[1] : msg);
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新增用户</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>用户名</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="登录用户名"
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        <Text style={styles.label}>密码</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="登录密码"
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry
        />

        <Text style={styles.label}>显示名称</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="在系统中显示的名称"
          placeholderTextColor={Colors.textTertiary}
        />

        <Text style={styles.label}>角色</Text>
        <View style={styles.chipRow}>
          {ROLES.map(r => (
            <Pressable
              key={r.value}
              onPress={() => setRole(r.value)}
              style={[styles.chip, role === r.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, role === r.value && styles.chipTextActive]}>{r.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>所属中心（可多选）</Text>
        {departments.length > 6 && (
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={deptSearch}
              onChangeText={setDeptSearch}
              placeholder="搜索中心..."
              placeholderTextColor={Colors.textTertiary}
            />
            {deptSearch.length > 0 && (
              <Pressable onPress={() => setDeptSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
              </Pressable>
            )}
          </View>
        )}
        <View style={styles.chipRow}>
          {filteredDepts.map(dept => (
            <Pressable
              key={dept.id}
              onPress={() => toggleDept(dept.id)}
              style={[styles.chip, selectedDeptIds.includes(dept.id) && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedDeptIds.includes(dept.id) && styles.chipTextActive]}>{dept.name}</Text>
            </Pressable>
          ))}
          {filteredDepts.length === 0 && deptSearch.trim() && (
            <Text style={styles.hint}>未找到匹配的中心</Text>
          )}
        </View>
        {selectedDeptIds.length === 0 && (
          <Text style={styles.hint}>未选择中心时为"未分配"</Text>
        )}

        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { opacity: (!canSave || saving) ? 0.5 : pressed ? 0.9 : 1 }
          ]}
        >
          <Ionicons name="person-add" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? '创建中...' : '创建用户'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.backgroundTertiary },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundTertiary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text, padding: 0 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, marginTop: 4 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 28 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
});
