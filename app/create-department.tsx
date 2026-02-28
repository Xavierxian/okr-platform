import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

export default function CreateDepartmentScreen() {
  const { departments, refresh } = useOKR();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const topLevelDepts = departments.filter(d => d.level === 0);
  const selectedParent = departments.find(d => d.id === parentId);
  const level = selectedParent ? selectedParent.level + 1 : 0;

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await apiRequest("POST", "/api/departments", {
        name: name.trim(),
        parentId,
        level,
      });
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新增部门</Text>
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>部门名称</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="输入部门名称"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
        />

        <Text style={styles.label}>上级部门（可选）</Text>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setParentId(null)}
            style={[styles.chip, parentId === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, parentId === null && styles.chipTextActive]}>无（一级部门）</Text>
          </Pressable>
          {topLevelDepts.map(dept => (
            <Pressable
              key={dept.id}
              onPress={() => setParentId(dept.id)}
              style={[styles.chip, parentId === dept.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, parentId === dept.id && styles.chipTextActive]}>{dept.name}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!name.trim() || saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { opacity: (!name.trim() || saving) ? 0.5 : pressed ? 0.9 : 1 }
          ]}
        >
          <Ionicons name="checkmark" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : '创建部门'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
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
