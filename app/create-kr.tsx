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
  const { objectiveId, editId } = useLocalSearchParams<{ objectiveId: string; editId?: string }>();
  const { addKeyResult, editKeyResult, objectives, keyResults, departments } = useOKR();

  const existingKR = editId ? keyResults.find(kr => kr.id === editId) : null;
  const isEditMode = !!editId;

  const effectiveObjectiveId = existingKR?.objectiveId || objectiveId || '';

  const today = new Date();
  const endDefault = new Date(today);
  endDefault.setMonth(endDefault.getMonth() + 3);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [selectedCollaboratorName, setSelectedCollaboratorName] = useState('');
  const [weight, setWeight] = useState('1');
  const [okrType, setOkrType] = useState<string>('承诺型');
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userLoadError, setUserLoadError] = useState(false);
  const [startDate] = useState(today.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(endDefault.toISOString().split('T')[0]);
  const [hydrated, setHydrated] = useState(!isEditMode);

  const objective = objectives.find(o => o.id === effectiveObjectiveId);

  useEffect(() => {
    if (isEditMode && existingKR && !hydrated) {
      setTitle(existingKR.title);
      setDescription(existingKR.description || '');
      setSelectedUserId(existingKR.assigneeId || null);
      setSelectedUserName(existingKR.assigneeName || '');
      setSelectedCollaboratorId(existingKR.collaboratorId || null);
      setSelectedCollaboratorName(existingKR.collaboratorName || '');
      setWeight(String(existingKR.weight ?? 1));
      setOkrType(existingKR.okrType || '承诺型');
      setEndDate(existingKR.endDate?.split('T')[0] || endDefault.toISOString().split('T')[0]);
      setHydrated(true);
    }
  }, [isEditMode, existingKR, hydrated]);

  const loadUsers = async () => {
    setUserLoadError(false);
    setLoadingUsers(true);
    try {
      const res = await apiRequest("GET", "/api/users/all-safe");
      const data = await res.json();
      setAllUsers(data);
    } catch {
      setUserLoadError(true);
    }
    setLoadingUsers(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const deptUsers = objective?.departmentId
    ? allUsers.filter(u => u.departmentId === objective.departmentId)
    : [];
  const otherDeptUsers = allUsers.filter(u => u.departmentId !== objective?.departmentId);

  const canSave = title.trim().length > 0 && hydrated;

  const handleSelectUser = (u: SimpleUser) => {
    if (selectedUserId === u.id) {
      setSelectedUserId(null);
      setSelectedUserName('');
    } else {
      setSelectedUserId(u.id);
      setSelectedUserName(u.displayName);
    }
  };

  const handleSelectCollaborator = (u: SimpleUser) => {
    if (selectedCollaboratorId === u.id) {
      setSelectedCollaboratorId(null);
      setSelectedCollaboratorName('');
    } else {
      setSelectedCollaboratorId(u.id);
      setSelectedCollaboratorName(u.displayName);
    }
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isEditMode) {
      await editKeyResult(existingKR.id, {
        title: title.trim(),
        description: description.trim(),
        assigneeId: selectedUserId,
        assigneeName: selectedUserName.trim(),
        collaboratorId: selectedCollaboratorId,
        collaboratorName: selectedCollaboratorName.trim(),
        endDate,
        weight: parseFloat(weight) || 1,
        okrType,
      });
    } else {
      await addKeyResult({
        objectiveId: effectiveObjectiveId,
        title: title.trim(),
        description: description.trim(),
        assigneeId: selectedUserId,
        assigneeName: selectedUserName.trim(),
        collaboratorId: selectedCollaboratorId,
        collaboratorName: selectedCollaboratorName.trim(),
        startDate,
        endDate,
        weight: parseFloat(weight) || 1,
        okrType,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const deptName = objective?.departmentId
    ? departments.find(d => d.id === objective.departmentId)?.name || ''
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isEditMode ? '编辑关键结果' : '新建关键结果'}</Text>
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
          autoFocus={!isEditMode}
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

        <Text style={styles.label}>执行人（本部门，单选）</Text>
        {loadingUsers ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
        ) : userLoadError ? (
          <Pressable onPress={loadUsers} style={styles.retryRow}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.retryText}>加载用户列表失败，点击重试</Text>
          </Pressable>
        ) : (
          <>
            {deptUsers.length > 0 ? (
              <View style={styles.chipRow}>
                {deptUsers.map(u => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => handleSelectUser(u)}
                      style={[styles.userChip, isSelected && styles.userChipActive]}
                    >
                      <Ionicons name={isSelected ? "radio-button-on" : "radio-button-off"} size={16} color={isSelected ? Colors.white : Colors.textTertiary} />
                      <Text style={[styles.userChipText, isSelected && styles.userChipTextActive]}>{u.displayName}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyHint}>该部门暂无用户</Text>
            )}
          </>
        )}

        <Text style={[styles.label, { marginTop: 20 }]}>跨部门协同人（其他部门，单选，可选）</Text>
        {loadingUsers ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
        ) : userLoadError ? null : (
          <>
            {otherDeptUsers.length > 0 ? (
              <View style={styles.chipRow}>
                {otherDeptUsers.map(u => {
                  const isSelected = selectedCollaboratorId === u.id;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => handleSelectCollaborator(u)}
                      style={[styles.userChip, isSelected && styles.collabChipActive]}
                    >
                      <Ionicons name={isSelected ? "radio-button-on" : "radio-button-off"} size={16} color={isSelected ? Colors.white : Colors.textTertiary} />
                      <Text style={[styles.userChipText, isSelected && styles.collabChipTextActive]}>{u.displayName}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyHint}>无其他部门用户</Text>
            )}
          </>
        )}

        <Text style={styles.label}>KR 类型</Text>
        <View style={styles.chipRow}>
          {['承诺型', '挑战型'].map(t => (
            <Pressable key={t} onPress={() => setOkrType(t)} style={[styles.typeChip, okrType === t && styles.typeChipActive]}>
              <Text style={[styles.typeChipText, okrType === t && styles.typeChipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

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
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : isEditMode ? '保存修改' : '创建关键结果'}</Text>
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
  input: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  textArea: { minHeight: 80 },
  row: { flexDirection: 'row', gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.backgroundTertiary },
  userChipActive: { backgroundColor: Colors.primary },
  collabChipActive: { backgroundColor: Colors.info },
  userChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  userChipTextActive: { color: Colors.white },
  collabChipTextActive: { color: Colors.white },
  emptyHint: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textTertiary, paddingVertical: 8 },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  retryText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.danger },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.backgroundTertiary },
  typeChipActive: { backgroundColor: Colors.primary },
  typeChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  typeChipTextActive: { color: Colors.white },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 28 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
});
