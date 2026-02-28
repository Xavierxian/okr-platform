import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

interface SimpleUser {
  id: string;
  username: string;
  displayName: string;
  departmentId: string | null;
}

export default function CreateKRScreen() {
  const { objectiveId } = useLocalSearchParams<{ objectiveId: string }>();
  const { addKeyResult, objectives, departments } = useOKR();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [weight, setWeight] = useState('1');
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userLoadError, setUserLoadError] = useState(false);

  const objective = objectives.find(o => o.id === objectiveId);

  const today = new Date();
  const endDefault = new Date(today);
  endDefault.setMonth(endDefault.getMonth() + 3);
  const [startDate] = useState(today.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(endDefault.toISOString().split('T')[0]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/users/all-safe");
        const data = await res.json();
        setAllUsers(data);
      } catch {
        setUserLoadError(true);
      }
      setLoadingUsers(false);
    })();
  }, []);

  const deptUsers = objective?.departmentId
    ? allUsers.filter(u => u.departmentId === objective.departmentId)
    : allUsers;
  const otherUsers = allUsers.filter(u => !deptUsers.some(du => du.id === u.id));

  const canSave = title.trim().length > 0 && (selectedUserId || selectedUserName.trim().length > 0);

  const handleSelectUser = (u: SimpleUser) => {
    setSelectedUserId(u.id);
    setSelectedUserName(u.displayName);
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addKeyResult({
      objectiveId: objectiveId || '',
      title: title.trim(),
      description: description.trim(),
      assigneeId: selectedUserId,
      assigneeName: selectedUserName.trim(),
      startDate,
      endDate,
      weight: parseFloat(weight) || 1,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const deptName = objective?.departmentId
    ? departments.find(d => d.id === objective.departmentId)?.name || ''
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>新建关键结果</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
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
        {loadingUsers ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
        ) : (
          <>
            {deptUsers.length > 0 && (
              <>
                <Text style={styles.subLabel}>{deptName || '本部门'}</Text>
                <View style={styles.chipRow}>
                  {deptUsers.map(u => (
                    <Pressable
                      key={u.id}
                      onPress={() => handleSelectUser(u)}
                      style={[styles.userChip, selectedUserId === u.id && styles.userChipActive]}
                    >
                      <Ionicons name="person" size={14} color={selectedUserId === u.id ? Colors.white : Colors.textSecondary} />
                      <Text style={[styles.userChipText, selectedUserId === u.id && styles.userChipTextActive]}>{u.displayName}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {otherUsers.length > 0 && (
              <>
                <Text style={styles.subLabel}>其他部门</Text>
                <View style={styles.chipRow}>
                  {otherUsers.map(u => (
                    <Pressable
                      key={u.id}
                      onPress={() => handleSelectUser(u)}
                      style={[styles.userChip, selectedUserId === u.id && styles.userChipActive]}
                    >
                      <Ionicons name="person-outline" size={14} color={selectedUserId === u.id ? Colors.white : Colors.textTertiary} />
                      <Text style={[styles.userChipText, selectedUserId === u.id && styles.userChipTextActive]}>{u.displayName}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {userLoadError && (
              <Pressable onPress={() => {
                setUserLoadError(false);
                setLoadingUsers(true);
                (async () => {
                  try {
                    const res = await apiRequest("GET", "/api/users/all-safe");
                    setAllUsers(await res.json());
                  } catch { setUserLoadError(true); }
                  setLoadingUsers(false);
                })();
              }} style={styles.retryRow}>
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.retryText}>加载用户列表失败，点击重试</Text>
              </Pressable>
            )}
            {!userLoadError && allUsers.length === 0 && !loadingUsers && (
              <TextInput
                style={styles.input}
                value={selectedUserName}
                onChangeText={(text) => { setSelectedUserName(text); setSelectedUserId(null); }}
                placeholder="输入执行人名称"
                placeholderTextColor={Colors.textTertiary}
              />
            )}
          </>
        )}

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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  form: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary, marginTop: 16, marginBottom: 8 },
  subLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  textArea: { minHeight: 80 },
  row: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.backgroundTertiary },
  userChipActive: { backgroundColor: Colors.primary },
  userChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  userChipTextActive: { color: Colors.white },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  retryText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.danger },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 28 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
});
