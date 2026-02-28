import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

const ROLES = [
  { value: 'member', label: '普通成员' },
  { value: 'dept_admin', label: '部门管理员' },
  { value: 'super_admin', label: '超级管理员' },
];

export default function CreateUserScreen() {
  const { departments } = useOKR();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('member');
  const [departmentId, setDepartmentId] = useState<string | null>(departments[0]?.id || null);
  const [saving, setSaving] = useState(false);

  const canSave = username.trim() && password.trim() && displayName.trim();

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
        departmentId,
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

        <Text style={styles.label}>所属部门</Text>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setDepartmentId(null)}
            style={[styles.chip, departmentId === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, departmentId === null && styles.chipTextActive]}>未分配</Text>
          </Pressable>
          {departments.map(dept => (
            <Pressable
              key={dept.id}
              onPress={() => setDepartmentId(dept.id)}
              style={[styles.chip, departmentId === dept.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, departmentId === dept.id && styles.chipTextActive]}>{dept.name}</Text>
            </Pressable>
          ))}
        </View>

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
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 28 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
});
