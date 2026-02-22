import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import Colors from '@/constants/colors';

export default function OKRsScreen() {
  const insets = useSafeAreaInsets();
  const { objectives, keyResults, departments, isLoading } = useOKR();
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);

  const filteredObjectives = useMemo(() => {
    let filtered = objectives;
    if (selectedDept) filtered = filtered.filter(o => o.departmentId === selectedDept);
    if (selectedCycle) filtered = filtered.filter(o => o.cycle === selectedCycle);
    return filtered;
  }, [objectives, selectedDept, selectedCycle]);

  const cycles = useMemo(() => {
    const set = new Set(objectives.map(o => o.cycle));
    return Array.from(set);
  }, [objectives]);

  const usedDepts = useMemo(() => {
    const ids = new Set(objectives.map(o => o.departmentId));
    return departments.filter(d => ids.has(d.id));
  }, [objectives, departments]);

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
            <Text style={styles.metaText}>{dept?.name || 'Unknown'}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{item.cycle}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="key-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{objKRs.length} KRs</Text>
          </View>
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
            <Text style={styles.progressCount}>{completedCount}/{objKRs.length} completed</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding + 16 }]}>
        <Text style={styles.headerTitle}>Objectives</Text>
        <Pressable onPress={() => router.push('/create-objective')} style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}>
          <Ionicons name="add" size={24} color={Colors.white} />
        </Pressable>
      </View>

      {(usedDepts.length > 0 || cycles.length > 0) && (
        <View style={styles.filters}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: null, label: 'All' }, ...usedDepts.map(d => ({ id: d.id, label: d.name }))]}
            keyExtractor={item => item.id || 'all'}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelectedDept(item.id)}
                style={[styles.filterChip, selectedDept === item.id && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, selectedDept === item.id && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            )}
          />
          {cycles.length > 0 && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ id: null, label: 'All Cycles' }, ...cycles.map(c => ({ id: c, label: c }))]}
              keyExtractor={item => item.id || 'all-cycles'}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginTop: 8 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelectedCycle(item.id)}
                  style={[styles.filterChip, selectedCycle === item.id && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, selectedCycle === item.id && styles.filterTextActive]}>{item.label}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}

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
            <Text style={styles.emptyTitle}>No objectives found</Text>
            <Text style={styles.emptyText}>Create your first objective to start tracking goals</Text>
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
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  filters: { paddingBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.backgroundTertiary },
  filterChipActive: { backgroundColor: Colors.primary },
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
