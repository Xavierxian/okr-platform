import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

function getCycleOptions(): string[] {
  const year = new Date().getFullYear();
  return [
    `${year} 第一季度`,
    `${year} 第二季度`,
    `${year} 第三季度`,
    `${year} 第四季度`,
    `${year} 年度`,
    `${year + 1} 第一季度`,
    `${year + 1} 第二季度`,
  ];
}

export default function CreateObjectiveScreen() {
  const { departments, addObjective } = useOKR();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const defaultDeptId = isAdmin ? (departments[0]?.id || '') : (user?.departmentId || departments[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDept, setSelectedDept] = useState(defaultDeptId);
  const [selectedCycle, setSelectedCycle] = useState(getCycleOptions()[0]);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [collabDeptIds, setCollabDeptIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && selectedDept && selectedCycle;

  const toggleCollabDept = (id: string) => {
    setCollabDeptIds(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addObjective({
      title: title.trim(),
      description: description.trim(),
      departmentId: selectedDept,
      cycle: selectedCycle,
      parentObjectiveId: null,
      isCollaborative,
      collaborativeDeptIds: isCollaborative ? collabDeptIds : [],
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新建目标</Text>
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>目标名称</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="你想要达成什么目标？"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
        />

        <Text style={styles.label}>目标描述</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="描述目标的意义和达成价值"
          placeholderTextColor={Colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={styles.label}>所属部门</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {departments
              .filter(dept => isAdmin || dept.id === user?.departmentId)
              .map(dept => (
                <Pressable
                  key={dept.id}
                  onPress={() => setSelectedDept(dept.id)}
                  style={[styles.chip, selectedDept === dept.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selectedDept === dept.id && styles.chipTextActive]}>
                    {dept.level > 0 ? '  ' : ''}{dept.name}
                  </Text>
                </Pressable>
              ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>所属周期</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {getCycleOptions().map(cycle => (
              <Pressable
                key={cycle}
                onPress={() => setSelectedCycle(cycle)}
                style={[styles.chip, selectedCycle === cycle && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedCycle === cycle && styles.chipTextActive]}>{cycle}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>跨部门协同</Text>
            <Text style={styles.switchDesc}>其他部门也可以看到此目标</Text>
          </View>
          <Switch
            value={isCollaborative}
            onValueChange={setIsCollaborative}
            trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary + '80' }}
            thumbColor={isCollaborative ? Colors.primary : Colors.textTertiary}
          />
        </View>

        {isCollaborative && (
          <>
            <Text style={styles.label}>协同部门</Text>
            <View style={styles.chipRow}>
              {departments
                .filter(d => d.id !== selectedDept)
                .map(dept => (
                  <Pressable
                    key={dept.id}
                    onPress={() => toggleCollabDept(dept.id)}
                    style={[styles.chip, collabDeptIds.includes(dept.id) && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, collabDeptIds.includes(dept.id) && styles.chipTextActive]}>
                      {dept.name}
                    </Text>
                  </Pressable>
                ))}
            </View>
          </>
        )}

        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { opacity: (!canSave || saving) ? 0.5 : pressed ? 0.9 : 1 }
          ]}
        >
          <Ionicons name="checkmark" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : '创建目标'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary, marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  textArea: { minHeight: 80 },
  chipScroll: { marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.backgroundTertiary },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 14 },
  switchLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text },
  switchDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 28 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
});
