import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import Colors from '@/constants/colors';
import { getScoreColor, getScoreLabel } from '@/lib/storage';
import * as Haptics from 'expo-haptics';

const SCORES = [
  { value: 1, desc: 'Fully achieved, exceeded expectations' },
  { value: 0.7, desc: 'Mostly achieved, minor gaps' },
  { value: 0.3, desc: 'Partially achieved, significant gaps' },
  { value: 0, desc: 'Not achieved, no meaningful progress' },
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
        <Text style={styles.errorText}>Key result not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Self Assessment</Text>
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.krName} numberOfLines={2}>{kr.title}</Text>
        <Text style={styles.krProgress}>Current progress: {kr.progress}%</Text>

        <Text style={styles.label}>Score</Text>
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
              <Text style={styles.scoreTitle}>{getScoreLabel(s.value)}</Text>
              <Text style={styles.scoreDesc}>{s.desc}</Text>
            </View>
            {selectedScore === s.value && (
              <Ionicons name="checkmark-circle" size={22} color={getScoreColor(s.value)} />
            )}
          </Pressable>
        ))}

        <Text style={styles.label}>Assessment Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder="Explain your score, lessons learned..."
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
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Submit Score'}</Text>
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
  krName: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.textSecondary, marginBottom: 4 },
  krProgress: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textTertiary, marginBottom: 8 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary, marginTop: 16, marginBottom: 10 },
  scoreOption: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  scoreDot: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scoreDotText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.white },
  scoreTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.text },
  scoreDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  input: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  textArea: { minHeight: 80 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 24 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.textSecondary },
});
