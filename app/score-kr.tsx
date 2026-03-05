import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import Colors from '@/constants/colors';
function getScoreColor(score: number): string {
  if (score === 1) return '#10B981';
  if (score === 0.7) return '#3B82F6';
  if (score === 0.3) return '#F59E0B';
  return '#EF4444';
}
import * as Haptics from 'expo-haptics';

const SCORES = [
  { value: 1, label: '完全达成', desc: '目标完全达成，执行质量优秀，超出预期' },
  { value: 0.7, label: '基本达成', desc: '基本达成目标，执行质量良好，轻微未达预期' },
  { value: 0.3, label: '部分达成', desc: '部分达成目标，存在明显差距，影响整体目标' },
  { value: 0, label: '未达成', desc: '未达成目标，无实质性进展，严重影响目标' },
];

export default function ScoreKRScreen() {
  const { krId } = useLocalSearchParams<{ krId: string }>();
  const { keyResults, submitScore } = useOKR();
  const kr = useMemo(() => keyResults.find(k => k.id === krId), [keyResults, krId]);

  const [selectedScore, setSelectedScore] = useState<number | null>(kr?.selfScore ?? null);
  const [note, setNote] = useState(kr?.selfScoreNote || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (selectedScore === null || saving || !krId) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await submitScore(krId, selectedScore, note.trim());
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
        <Text style={styles.headerTitle}>自评打分</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.krName} numberOfLines={2}>{kr.title}</Text>
        <Text style={styles.krProgress}>当前进度：{kr.progress}%</Text>

        <Text style={styles.label}>评分</Text>
        {SCORES.map(s => (
          <Pressable
            key={s.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedScore(s.value);
            }}
            style={[
              styles.scoreOption,
              selectedScore === s.value && { borderColor: getScoreColor(s.value), borderWidth: 2 },
            ]}
          >
            <View style={[styles.scoreDot, { backgroundColor: getScoreColor(s.value) }]}>
              <Text style={styles.scoreDotText}>{s.value}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scoreTitle}>{s.label}</Text>
              <Text style={styles.scoreDesc}>{s.desc}</Text>
            </View>
            {selectedScore === s.value && (
              <Ionicons name="checkmark-circle" size={22} color={getScoreColor(s.value)} />
            )}
          </Pressable>
        ))}

        <Text style={styles.label}>自评说明</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder="说明得分原因、未达成的改进方向..."
          placeholderTextColor={Colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Pressable
          onPress={handleSave}
          disabled={selectedScore === null || saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { opacity: (selectedScore === null || saving) ? 0.5 : pressed ? 0.9 : 1 }
          ]}
        >
          <Ionicons name="star" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? '提交中...' : '提交评分'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EBEEF5' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#171A1D' },
  form: { paddingHorizontal: 16, paddingBottom: 40 },
  krName: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#5E6D82', marginBottom: 4 },
  krProgress: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8F9BB3', marginBottom: 8 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#5E6D82', marginTop: 16, marginBottom: 10 },
  scoreOption: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EBEEF5' },
  scoreDot: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scoreDotText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF' },
  scoreTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#171A1D' },
  scoreDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5E6D82', marginTop: 2 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#171A1D', borderWidth: 1, borderColor: '#EBEEF5' },
  textArea: { minHeight: 80 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0082EF', paddingVertical: 16, borderRadius: 12, marginTop: 24, shadowColor: '#0082EF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#5E6D82' },
});
