import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

export default function CreateKRScreen() {
  const { objectiveId } = useLocalSearchParams<{ objectiveId: string }>();
  const { addKeyResult } = useOKR();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [weight, setWeight] = useState('1');
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const endDefault = new Date(today);
  endDefault.setMonth(endDefault.getMonth() + 3);

  const [startDate] = useState(today.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(endDefault.toISOString().split('T')[0]);

  const canSave = title.trim().length > 0 && assigneeName.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addKeyResult({
      objectiveId: objectiveId || '',
      title: title.trim(),
      description: description.trim(),
      assigneeName: assigneeName.trim(),
      assigneeId: null,
      startDate,
      endDate,
      weight: parseFloat(weight) || 1,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新建关键结果</Text>
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>KR 名称</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="可衡量的关键成果"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
        />

        <Text style={styles.label}>描述</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="如何衡量成功？执行路径是什么？"
          placeholderTextColor={Colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <Text style={styles.label}>执行人</Text>
        <TextInput
          style={styles.input}
          value={assigneeName}
          onChangeText={setAssigneeName}
          placeholder="谁来负责？"
          placeholderTextColor={Colors.textTertiary}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>截止日期</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          <View style={{ width: 80 }}>
            <Text style={styles.label}>权重</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="1"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!canSave || saving}
          style={({ pressed }) => [
            styles.saveBtn,
            { opacity: (!canSave || saving) ? 0.5 : pressed ? 0.9 : 1 }
          ]}
        >
          <Ionicons name="checkmark" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : '创建关键结果'}</Text>
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
  row: { flexDirection: 'row', gap: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 28 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
});
