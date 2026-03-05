import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

interface SimpleUser {
  id: string;
  username: string;
  displayName: string;
  departmentId: string | null;
}

export default function CreateObjectiveScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { departments, cycles, objectives, addObjective, editObjective } = useOKR();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const existingObj = editId ? objectives.find(o => o.id === editId) : null;
  const isEditMode = !!editId;

  const userDeptIds: string[] = user?.departmentIds || (user?.departmentId ? [user.departmentId] : []);
  const defaultDeptId = isAdmin ? (departments[0]?.id || '') : (userDeptIds[0] || departments[0]?.id || '');
  const [title, setTitle] = useState('');
  const [selectedDept, setSelectedDept] = useState(defaultDeptId);
  const cycleOptions = cycles.map(c => c.name);
  const [selectedCycle, setSelectedCycle] = useState(cycleOptions[0] || '');
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [linkedToParent, setLinkedToParent] = useState(false);
  const [okrType, setOkrType] = useState<string>('承诺型');
  const [collabDeptIds, setCollabDeptIds] = useState<string[]>([]);
  const [collabUserIds, setCollabUserIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(!isEditMode);
  const [deptSearch, setDeptSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (!isEditMode && !selectedCycle && cycleOptions.length > 0) {
      setSelectedCycle(cycleOptions[0]);
    }
  }, [cycleOptions, isEditMode, selectedCycle]);

  useEffect(() => {
    if (isEditMode && existingObj && !hydrated) {
      setTitle(existingObj.title);
      setSelectedDept(existingObj.departmentId || defaultDeptId);
      setSelectedCycle(existingObj.cycle || cycleOptions[0] || '');
      setIsCollaborative(existingObj.isCollaborative || false);
      setLinkedToParent(existingObj.linkedToParent || false);
      setOkrType(existingObj.okrType || '承诺型');
      setCollabDeptIds(existingObj.collaborativeDeptIds || []);
      setCollabUserIds(existingObj.collaborativeUserIds || []);
      setHydrated(true);
    }
  }, [isEditMode, existingObj, hydrated]);

  useEffect(() => {
    if (isCollaborative && allUsers.length === 0) {
      setLoadingUsers(true);
      (async () => {
        try {
          const res = await apiRequest("GET", "/api/users/all-safe");
          setAllUsers(await res.json());
        } catch {}
        setLoadingUsers(false);
      })();
    }
  }, [isCollaborative]);

  const canSave = title.trim().length > 0 && selectedDept && selectedCycle && hydrated;

  const toggleCollabDept = (id: string) => {
    setCollabDeptIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const toggleCollabUser = (id: string) => {
    setCollabUserIds(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  };

  const otherDeptUsers = allUsers.filter(u => u.departmentId !== selectedDept);

  const filteredCollabDepts = useMemo(() => {
    const depts = departments.filter(d => d.id !== selectedDept);
    if (!deptSearch.trim()) return depts;
    return depts.filter(d => d.name.toLowerCase().includes(deptSearch.trim().toLowerCase()));
  }, [departments, selectedDept, deptSearch]);

  const filteredCollabUsers = useMemo(() => {
    if (!userSearch.trim()) return otherDeptUsers;
    const q = userSearch.trim().toLowerCase();
    return otherDeptUsers.filter(u =>
      u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  }, [otherDeptUsers, userSearch]);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const payload = {
      title: title.trim(),
      description: '',
      departmentId: selectedDept,
      cycle: selectedCycle,
      parentObjectiveId: null,
      isCollaborative,
      linkedToParent,
      okrType,
      collaborativeDeptIds: isCollaborative ? collabDeptIds : [],
      collaborativeUserIds: isCollaborative ? collabUserIds : [],
    };

    if (isEditMode) {
      await editObjective(existingObj.id, payload);
    } else {
      await addObjective(payload);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isEditMode ? '编辑目标' : '新建目标'}</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>目标名称</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="你想要达成什么目标？" placeholderTextColor={Colors.textTertiary} autoFocus={!isEditMode} />

        <Text style={styles.label}>所属中心</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {departments.filter(dept => isAdmin || userDeptIds.includes(dept.id)).map(dept => (
              <Pressable key={dept.id} onPress={() => setSelectedDept(dept.id)} style={[styles.chip, selectedDept === dept.id && styles.chipActive]}>
                <Text style={[styles.chipText, selectedDept === dept.id && styles.chipTextActive]}>{dept.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>所属周期</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <View style={styles.chipRow}>
            {cycleOptions.map(cycle => (
              <Pressable key={cycle} onPress={() => setSelectedCycle(cycle)} style={[styles.chip, selectedCycle === cycle && styles.chipActive]}>
                <Text style={[styles.chipText, selectedCycle === cycle && styles.chipTextActive]}>{cycle}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>OKR 类型</Text>
        <View style={styles.chipRow}>
          {['承诺型', '挑战型'].map(t => (
            <Pressable key={t} onPress={() => setOkrType(t)} style={[styles.chip, okrType === t && styles.chipActive]}>
              <Text style={[styles.chipText, okrType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>关联上级目标</Text>
            <Text style={styles.switchDesc}>标记此目标是否承接上级目标</Text>
          </View>
          <Switch value={linkedToParent} onValueChange={setLinkedToParent} trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary + '80' }} thumbColor={linkedToParent ? Colors.primary : Colors.textTertiary} />
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>跨部门协同</Text>
            <Text style={styles.switchDesc}>关联其他部门和用户可以看到此目标</Text>
          </View>
          <Switch value={isCollaborative} onValueChange={setIsCollaborative} trackColor={{ false: Colors.backgroundTertiary, true: Colors.primary + '80' }} thumbColor={isCollaborative ? Colors.primary : Colors.textTertiary} />
        </View>

        {isCollaborative && (
          <>
            <Text style={styles.label}>协同部门</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={deptSearch}
                onChangeText={setDeptSearch}
                placeholder="搜索部门..."
                placeholderTextColor={Colors.textTertiary}
              />
              {deptSearch.length > 0 && (
                <Pressable onPress={() => setDeptSearch('')}>
                  <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                </Pressable>
              )}
            </View>
            <View style={styles.chipRow}>
              {filteredCollabDepts.map(dept => (
                <Pressable key={dept.id} onPress={() => toggleCollabDept(dept.id)} style={[styles.chip, collabDeptIds.includes(dept.id) && styles.chipActive]}>
                  <Text style={[styles.chipText, collabDeptIds.includes(dept.id) && styles.chipTextActive]}>{dept.name}</Text>
                </Pressable>
              ))}
              {filteredCollabDepts.length === 0 && deptSearch.trim() && (
                <Text style={styles.emptyText}>未找到匹配的部门</Text>
              )}
            </View>

            <Text style={styles.label}>协同人员</Text>
            <Text style={styles.subLabel}>选择其他部门的人员，他们也能查看此目标和 KR 进度</Text>
            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={userSearch}
                onChangeText={setUserSearch}
                placeholder="搜索人员姓名..."
                placeholderTextColor={Colors.textTertiary}
              />
              {userSearch.length > 0 && (
                <Pressable onPress={() => setUserSearch('')}>
                  <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                </Pressable>
              )}
            </View>
            {loadingUsers ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 10 }} />
            ) : filteredCollabUsers.length > 0 ? (
              <View style={styles.chipRow}>
                {filteredCollabUsers.map(u => {
                  const uDept = departments.find(d => d.id === u.departmentId);
                  return (
                    <Pressable key={u.id} onPress={() => toggleCollabUser(u.id)} style={[styles.userChip, collabUserIds.includes(u.id) && styles.userChipActive]}>
                      <Ionicons name={collabUserIds.includes(u.id) ? "checkmark-circle" : "person-outline"} size={14} color={collabUserIds.includes(u.id) ? Colors.white : Colors.textSecondary} />
                      <View>
                        <Text style={[styles.userChipText, collabUserIds.includes(u.id) && styles.userChipTextActive]}>{u.displayName}</Text>
                        {uDept && <Text style={[styles.userChipDept, collabUserIds.includes(u.id) && { color: Colors.white + '80' }]}>{uDept.name}</Text>}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>{userSearch.trim() ? '未找到匹配的人员' : '暂无其他部门的用户'}</Text>
            )}
          </>
        )}

        <Pressable onPress={handleSave} disabled={!canSave || saving} style={({ pressed }) => [styles.saveBtn, { opacity: (!canSave || saving) ? 0.5 : pressed ? 0.9 : 1 }]}>
          <Ionicons name="checkmark" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : isEditMode ? '保存修改' : '创建目标'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EBEEF5' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#171A1D' },
  form: { paddingHorizontal: 16, paddingBottom: 40, gap: 4 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#5E6D82', marginTop: 16, marginBottom: 8 },
  subLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8F9BB3', marginBottom: 8 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#171A1D', borderWidth: 1, borderColor: '#EBEEF5' },
  textArea: { minHeight: 80 },
  chipScroll: { marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EBEEF5' },
  chipActive: { backgroundColor: '#0082EF', borderColor: '#0082EF' },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#5E6D82' },
  chipTextActive: { color: '#FFFFFF' },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EBEEF5' },
  userChipActive: { backgroundColor: '#0082EF', borderColor: '#0082EF' },
  userChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#5E6D82' },
  userChipTextActive: { color: '#FFFFFF' },
  userChipDept: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#8F9BB3', marginTop: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#EBEEF5' },
  switchLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#171A1D' },
  switchDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8F9BB3', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 10, borderWidth: 1, borderColor: '#EBEEF5' },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#171A1D', padding: 0 },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8F9BB3' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0082EF', paddingVertical: 16, borderRadius: 12, marginTop: 28, shadowColor: '#0082EF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
});
