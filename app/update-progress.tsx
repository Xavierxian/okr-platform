import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

export default function UpdateProgressScreen() {
  const { krId } = useLocalSearchParams<{ krId: string }>();
  const { keyResults, reportProgress } = useOKR();
  const kr = useMemo(() => keyResults.find(k => k.id === krId), [keyResults, krId]);

  const [progress, setProgress] = useState(kr?.progress?.toString() || '0');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const progressNum = Math.min(100, Math.max(0, parseInt(progress) || 0));

  const handleSave = async () => {
    if (saving || !krId) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await reportProgress(krId, progressNum, note.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (!kr) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>关键结果未找到</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>更新进度</Text>
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.krName} numberOfLines={2}>{kr.title}</Text>

        <Text style={styles.label}>进度 (%)</Text>
        <View style={styles.progressRow}>
          <Pressable
            onPress={() => setProgress(String(Math.max(0, progressNum - 10)))}
            style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="remove" size={20} color={Colors.text} />
          </Pressable>
          <TextInput
            style={styles.progressInput}
            value={progress}
            onChangeText={setProgress}
            keyboardType="numeric"
            maxLength={3}
          />
          <Pressable
            onPress={() => setProgress(String(Math.min(100, progressNum + 10)))}
            style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="add" size={20} color={Colors.text} />
          </Pressable>
        </View>

        <View style={styles.progressBarWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${progressNum}%`,
              backgroundColor: progressNum >= 70 ? Colors.success : progressNum >= 40 ? Colors.warning : Colors.danger,
            }]} />
          </View>
          <Text style={styles.progressPercent}>{progressNum}%</Text>
        </View>

        <Text style={styles.label}>执行说明</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder="已完成工作、遇到的问题、下一步计划..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { opacity: saving ? 0.5 : pressed ? 0.9 : 1 }
          ]}
        >
          <Ionicons name="checkmark" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存进度'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  krName: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.textSecondary, marginBottom: 8 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary, marginTop: 16, marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.backgroundTertiary, alignItems: 'center', justifyContent: 'center' },
  progressInput: { flex: 1, backgroundColor: Colors.backgroundTertiary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 24, fontFamily: 'Inter_700Bold', color: Colors.text, textAlign: 'center' },
  progressBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  progressBar: { flex: 1, height: 6, backgroundColor: Colors.backgroundTertiary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressPercent: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.text, width: 40, textAlign: 'right' },
  input: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  textArea: { minHeight: 80 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 24 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.textSecondary },
});
