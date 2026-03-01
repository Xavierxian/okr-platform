import React, { useState, useMemo, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';

interface SimpleUser {
  id: string;
  displayName: string;
  departmentId: string | null;
  role: string;
}

export default function OKRsScreen() {
  const insets = useSafeAreaInsets();
  const { objectives, keyResults, departments, isLoading } = useOKR();
  const { user } = useAuth();
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);

  const userRole = user?.role || 'member';
  const showUserFilter = true;
  const showDeptFilter = userRole === 'center_head' || userRole === 'vp' || userRole === 'super_admin';

  useEffect(() => {
    if (showUserFilter || showDeptFilter) {
      apiRequest("GET", "/api/users/all-safe")
        .then(res => res.json())
        .then((data: SimpleUser[]) => setAllUsers(data))
        .catch(() => {});
    }
  }, [showUserFilter, showDeptFilter]);

  const visibleUsers = useMemo(() => {
    if (userRole === 'member') {
      return allUsers.filter(u => u.departmentId === user?.departmentId);
    }
    if (userRole === 'center_head') {
      if (selectedDeptIds.length > 0) {
        return allUsers.filter(u => u.departmentId && selectedDeptIds.includes(u.departmentId));
      }
      return allUsers.filter(u => u.role === 'center_head');
    }
    if (selectedDeptIds.length > 0) {
      return allUsers.filter(u => u.departmentId && selectedDeptIds.includes(u.departmentId));
    }
    return allUsers;
  }, [allUsers, userRole, user, selectedDeptIds]);

  const filteredObjectives = useMemo(() => {
    let filtered = objectives;
    if (selectedDeptIds.length > 0) filtered = filtered.filter(o => selectedDeptIds.includes(o.departmentId));
    if (selectedUserId) filtered = filtered.filter(o => o.createdBy === selectedUserId);
    if (selectedCycle) filtered = filtered.filter(o => o.cycle === selectedCycle);
    return filtered;
  }, [objectives, selectedDeptIds, selectedUserId, selectedCycle]);

  const cycles = useMemo(() => {
    const set = new Set(objectives.map(o => o.cycle));
    return Array.from(set);
  }, [objectives]);

  const usedDepts = useMemo(() => {
    const ids = new Set(objectives.map(o => o.departmentId));
    return departments.filter(d => ids.has(d.id));
  }, [objectives, departments]);

  const toggleDept = (id: string) => {
    setSelectedDeptIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    setSelectedUserId(null);
  };

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderObjective = ({ item }: { item: typeof objectives[0] }) => {
    const objKRs = keyResults.filter(kr => kr.objectiveId === item.id);
    const dept = departments.find(d => d.id === item.departmentId);
    const avgProg = objKRs.length > 0
      ? Math.round(objKRs.reduce((s, kr) => s + kr.progress, 0) / objKRs.length)
      : 0;
    const completedCount = objKRs.filter(kr => kr.status === 'completed').length;
    const creator = allUsers.find(u => u.id === item.createdBy);

    return (
      <Pressable
        onPress={() => router.push({ pathname: '/objective/[id]', params: { id: item.id } })}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.statusDot, {
            backgroundColor: avgProg >= 70 ? Colors.success : avgProg >= 40 ? Colors.warning : avgProg > 0 ? Colors.danger : Colors.textTertiary
          }]} />
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="business-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{dept?.name || '未知'}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{item.cycle}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="key-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{objKRs.length} 个 KR</Text>
          </View>
          {creator && (
            <View style={styles.metaChip}>
              <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{creator.displayName}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardProgress}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${avgProg}%`,
              backgroundColor: avgProg >= 70 ? Colors.success : avgProg >= 40 ? Colors.warning : Colors.danger,
            }]} />
          </View>
          <View style={styles.progressInfo}>
            <Text style={styles.progressPercent}>{avgProg}%</Text>
            <Text style={styles.progressCount}>{completedCount}/{objKRs.length} 已完成</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <Text style={styles.headerTitle}>目标管理</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/import-okr')} style={({ pressed }) => [styles.importBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
          </Pressable>
          <Pressable onPress={() => router.push('/create-objective')} style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="add" size={24} color={Colors.white} />
          </Pressable>
        </View>
      </View>

      <View style={styles.filters}>
        {showDeptFilter && usedDepts.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 8 }}>
            <Pressable
              onPress={() => { setSelectedDeptIds([]); setSelectedUserId(null); }}
              style={[styles.filterChip, selectedDeptIds.length === 0 && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, selectedDeptIds.length === 0 && styles.filterTextActive]}>全部中心</Text>
            </Pressable>
            {usedDepts.map(d => {
              const isActive = selectedDeptIds.includes(d.id);
              return (
                <Pressable key={d.id} onPress={() => toggleDept(d.id)} style={[styles.filterChip, isActive && styles.filterChipActive]}>
                  {isActive && <Ionicons name="checkmark" size={14} color={Colors.white} style={{ marginRight: 2 }} />}
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{d.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {showUserFilter && visibleUsers.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 8 }}>
            <Pressable
              onPress={() => setSelectedUserId(null)}
              style={[styles.filterChip, !selectedUserId && styles.filterChipUserActive]}
            >
              <Text style={[styles.filterText, !selectedUserId && styles.filterTextActive]}>全部人员</Text>
            </Pressable>
            {visibleUsers.map(u => {
              const isActive = selectedUserId === u.id;
              return (
                <Pressable key={u.id} onPress={() => setSelectedUserId(isActive ? null : u.id)} style={[styles.filterChip, isActive && styles.filterChipUserActive]}>
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{u.displayName}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {cycles.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            <Pressable
              onPress={() => setSelectedCycle(null)}
              style={[styles.filterChip, !selectedCycle && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, !selectedCycle && styles.filterTextActive]}>全部周期</Text>
            </Pressable>
            {cycles.map(c => (
              <Pressable
                key={c}
                onPress={() => setSelectedCycle(selectedCycle === c ? null : c)}
                style={[styles.filterChip, selectedCycle === c && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, selectedCycle === c && styles.filterTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <FlatList
        data={filteredObjectives}
        keyExtractor={item => item.id}
        renderItem={renderObjective}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filteredObjectives.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flag-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>暂无目标</Text>
            <Text style={styles.emptyText}>创建你的第一个目标，开始追踪进展</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  importBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  filters: { paddingBottom: 12 },
  filterChip: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.backgroundTertiary },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipUserActive: { backgroundColor: Colors.success },
  filterText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text, flex: 1 },
  cardDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 6, marginLeft: 20 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginLeft: 20 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textSecondary },
  cardProgress: { marginTop: 14, marginLeft: 20 },
  progressBar: { height: 4, backgroundColor: Colors.backgroundTertiary, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressPercent: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.text },
  progressCount: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textTertiary },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
