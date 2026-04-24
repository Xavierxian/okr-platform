import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR, type AssignedKRItem } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import Animated, { FadeInDown } from 'react-native-reanimated';
import NotificationBell from '@/components/NotificationBell';

function parseDashboardQuarterCycle(cycle: string): { year: number; quarter: number } | null {
  const normalized = cycle.replace(/\s+/g, '');
  const match = normalized.match(/(\d{4}).*?([\u4E00\u4E8C\u4E09\u56DB1-4]).*?(\u5B63\u5EA6|Q)/i);
  if (!match) return null;

  const quarterMap: Record<string, number> = {
    '\u4E00': 1,
    '\u4E8C': 2,
    '\u4E09': 3,
    '\u56DB': 4,
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
  };

  const year = parseInt(match[1], 10);
  const quarter = quarterMap[match[2]];
  if (!year || !quarter) return null;

  return { year, quarter };
}

function compareDashboardQuarterCycleDesc(a: string, b: string): number {
  const parsedA = parseDashboardQuarterCycle(a);
  const parsedB = parseDashboardQuarterCycle(b);

  if (!parsedA && !parsedB) return b.localeCompare(a, 'zh-CN');
  if (!parsedA) return 1;
  if (!parsedB) return -1;
  if (parsedA.year !== parsedB.year) return parsedB.year - parsedA.year;
  return parsedB.quarter - parsedA.quarter;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'normal': return '#10B981';
    case 'behind': return '#F59E0B';
    case 'completed': return '#3B82F6';
    case 'overdue': return '#EF4444';
    case 'paused': return '#64748B';
    default: return '#94A3B8';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'normal': return '正常';
    case 'behind': return '滞后';
    case 'completed': return '已完成';
    case 'overdue': return '逾期';
    default: return status;
  }
}

function KRCard({ item, showActions, delay }: { item: AssignedKRItem; showActions: boolean; delay: number }) {
  const { kr, objective } = item;

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={styles.krCard}>
      <View style={styles.krHeader}>
        <View style={[styles.krDot, { backgroundColor: getStatusColor(kr.status) }]} />
        <Text style={styles.krTitle} numberOfLines={2}>{kr.title}</Text>
      </View>
      <Text style={styles.krObjName} numberOfLines={1}>目标: {objective.title} ({objective.cycle})</Text>
      {kr.description ? <Text style={styles.krDesc} numberOfLines={2}>{kr.description}</Text> : null}

      <View style={styles.krMeta}>
        <View style={styles.krProgressBarOuter}>
          <View style={[styles.krProgressBarInner, { width: `${kr.progress}%`, backgroundColor: getStatusColor(kr.status) }]} />
        </View>
        <Text style={[styles.krPercent, { color: getStatusColor(kr.status) }]}>{kr.progress}%</Text>
        <View style={[styles.krStatusBadge, { backgroundColor: getStatusColor(kr.status) + '20' }]}>
          <Text style={[styles.krStatusText, { color: getStatusColor(kr.status) }]}>{getStatusLabel(kr.status)}</Text>
        </View>
      </View>

      {kr.progressHistory && kr.progressHistory.length > 0 && (
        <View style={styles.krLastUpdate}>
          <Ionicons name="time-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.krLastUpdateText}>最近更新: {kr.progressHistory[kr.progressHistory.length - 1]?.note || '无说明'}</Text>
        </View>
      )}

      {kr.selfScore !== null && (
        <View style={styles.krScoreRow}>
          <Ionicons name="star" size={12} color={Colors.warning} />
          <Text style={styles.krScoreText}>自评: {kr.selfScore} 分</Text>
          {kr.selfScoreNote ? <Text style={styles.krScoreNote} numberOfLines={1}> - {kr.selfScoreNote}</Text> : null}
        </View>
      )}

      {showActions && (
        <View style={styles.krActions}>
          <Pressable
            onPress={() => router.push({ pathname: '/update-progress', params: { krId: kr.id } })}
            style={({ pressed }) => [styles.krActionBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="create-outline" size={14} color={Colors.primary} />
            <Text style={styles.krActionText}>更新进度</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/score-kr', params: { krId: kr.id } })}
            style={({ pressed }) => [styles.krActionBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name="star-outline" size={14} color={Colors.warning} />
            <Text style={styles.krActionText}>自评</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

interface ObjectiveKRGroup {
  objectiveId: string;
  objective: AssignedKRItem['objective'];
  items: AssignedKRItem[];
}

interface SimpleUser {
  id: string;
  displayName: string;
}

function groupKRItemsByObjective(items: AssignedKRItem[]): ObjectiveKRGroup[] {
  const map = new Map<string, ObjectiveKRGroup>();
  items.forEach(item => {
    const key = item.objective.id;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      return;
    }
    map.set(key, { objectiveId: key, objective: item.objective, items: [item] });
  });
  return Array.from(map.values());
}

function formatSourceLabel(names: (string | null | undefined)[]): string {
  const uniqueNames = Array.from(
    new Set(
      names
        .map(name => (name || '').trim())
        .filter(Boolean)
    )
  );
  if (uniqueNames.length === 0) return '未知';
  if (uniqueNames.length === 1) return uniqueNames[0];
  return `${uniqueNames[0]} 等${uniqueNames.length}人`;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { objectives, keyResults, departments, assignedKRs, collaboratingKRs, isLoading } = useOKR();
  const { user } = useAuth();

  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  const [expandedAssignedObjectives, setExpandedAssignedObjectives] = useState<Record<string, boolean>>({});
  const [expandedCollaboratingObjectives, setExpandedCollaboratingObjectives] = useState<Record<string, boolean>>({});
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const hasInitializedCycleSelection = useRef(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const allMyObjectives = useMemo(() => {
    return objectives.filter(obj => obj.createdBy === user?.id);
  }, [objectives, user]);

  const dashboardObjectives = useMemo(() => {
    return isSuperAdmin ? objectives : allMyObjectives;
  }, [allMyObjectives, isSuperAdmin, objectives]);

  React.useEffect(() => {
    apiRequest('GET', '/api/users/all-safe')
      .then(res => res.json())
      .then((users: SimpleUser[]) => setAllUsers(users))
      .catch(() => {});
  }, []);

  const userNameMap = useMemo(() => {
    return new Map(allUsers.map(u => [u.id, u.displayName]));
  }, [allUsers]);

  const recentQuarterCycles = useMemo(() => {
    const uniqueCycles = Array.from(
      new Set(
        dashboardObjectives
          .map(obj => obj.cycle)
          .filter(cycle => !!parseDashboardQuarterCycle(cycle))
      )
    );
    return uniqueCycles.sort(compareDashboardQuarterCycleDesc).slice(0, 4);
  }, [dashboardObjectives]);

  React.useEffect(() => {
    if (hasInitializedCycleSelection.current) return;
    if (recentQuarterCycles.length === 0) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

    const currentCycle = recentQuarterCycles.find(cycle => {
      const parsed = parseDashboardQuarterCycle(cycle);
      return !!parsed && parsed.year === currentYear && parsed.quarter === currentQuarter;
    });

    setSelectedCycle(currentCycle || recentQuarterCycles[0] || null);
    hasInitializedCycleSelection.current = true;
  }, [recentQuarterCycles]);

  const cycleScopedObjectives = useMemo(() => {
    if (selectedCycle) {
      return dashboardObjectives.filter(obj => obj.cycle === selectedCycle);
    }
    if (recentQuarterCycles.length > 0) {
      return dashboardObjectives.filter(obj => recentQuarterCycles.includes(obj.cycle));
    }
    return dashboardObjectives;
  }, [dashboardObjectives, recentQuarterCycles, selectedCycle]);

  const myObjectives = useMemo(() => {
    if (selectedDeptIds.length === 0) return cycleScopedObjectives;
    return cycleScopedObjectives.filter(obj => selectedDeptIds.includes(obj.departmentId));
  }, [cycleScopedObjectives, selectedDeptIds]);

  const usedDepts = useMemo(() => {
    const ids = new Set(cycleScopedObjectives.map(o => o.departmentId));
    return departments.filter(d => ids.has(d.id));
  }, [cycleScopedObjectives, departments]);

  const shouldShowDeptFilter = usedDepts.length > 1;

  const allVisibleKRItems = useMemo(() => {
    if (!isSuperAdmin) return [];
    const objectiveMap = new Map(myObjectives.map(obj => [obj.id, obj]));
    return keyResults
      .filter(kr => objectiveMap.has(kr.objectiveId))
      .map(kr => ({
        kr,
        objective: objectiveMap.get(kr.objectiveId)!,
      }));
  }, [isSuperAdmin, keyResults, myObjectives]);

  const cycleFilteredAssignedKRs = useMemo(() => {
    if (selectedCycle) {
      return assignedKRs.filter(item => item.objective?.cycle === selectedCycle);
    }
    if (recentQuarterCycles.length > 0) {
      const cycleSet = new Set(recentQuarterCycles);
      return assignedKRs.filter(item => cycleSet.has(item.objective?.cycle));
    }
    return assignedKRs;
  }, [assignedKRs, recentQuarterCycles, selectedCycle]);

  const cycleFilteredCollaboratingKRs = useMemo(() => {
    if (selectedCycle) {
      return collaboratingKRs.filter(item => item.objective?.cycle === selectedCycle);
    }
    if (recentQuarterCycles.length > 0) {
      const cycleSet = new Set(recentQuarterCycles);
      return collaboratingKRs.filter(item => cycleSet.has(item.objective?.cycle));
    }
    return collaboratingKRs;
  }, [collaboratingKRs, recentQuarterCycles, selectedCycle]);

  const displayedAssignedKRs = useMemo(
    () => (isSuperAdmin ? allVisibleKRItems : cycleFilteredAssignedKRs),
    [allVisibleKRItems, cycleFilteredAssignedKRs, isSuperAdmin]
  );
  const displayedCollaboratingKRs = useMemo(
    () => (isSuperAdmin ? ([] as AssignedKRItem[]) : cycleFilteredCollaboratingKRs),
    [cycleFilteredCollaboratingKRs, isSuperAdmin]
  );

  const assignedObjectiveGroups = useMemo(() => groupKRItemsByObjective(displayedAssignedKRs), [displayedAssignedKRs]);
  const collaboratingObjectiveGroups = useMemo(() => groupKRItemsByObjective(displayedCollaboratingKRs), [displayedCollaboratingKRs]);

  const toggleDept = (id: string) => {
    setSelectedDeptIds(prev => (prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]));
  };

  React.useEffect(() => {
    setSelectedDeptIds([]);
    setExpandedAssignedObjectives({});
    setExpandedCollaboratingObjectives({});
  }, [selectedCycle]);

  const topPadding = Platform.OS === 'web' ? 20 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const hasContent = isSuperAdmin
    ? myObjectives.length > 0 || displayedAssignedKRs.length > 0
    : myObjectives.length > 0 || displayedAssignedKRs.length > 0 || displayedCollaboratingKRs.length > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.stickyHeader, { paddingTop: topPadding }]}>
        <View style={styles.headerContent}>
          <View style={styles.titleSection}>
            <View>
              <Text style={styles.mainTitle}>{user?.displayName || 'OKR'} 的仪表盘</Text>
              <Text style={styles.subtitle}>{myObjectives.length} 个目标 · {displayedAssignedKRs.length} 个协同KR · {displayedCollaboratingKRs.length} 个跨部门协同</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <NotificationBell />
            <Pressable onPress={() => router.push('/create-objective')} style={({ pressed }) => [styles.fabButton, { opacity: pressed ? 0.9 : 1 }]}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding + 110, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }]}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {!hasContent ? (
          <View style={styles.emptySectionCard}>
            <Text style={styles.emptySectionText}>暂无数据</Text>
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <View style={styles.sectionHeader}>
                <Ionicons name="flag" size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>我的目标</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{myObjectives.length}</Text>
                </View>
              </View>

              {recentQuarterCycles.length > 0 && (
                <View style={styles.filterBlock}>
                  <View style={styles.filterRow}>
                    <Pressable
                      onPress={() => {
                        setSelectedCycle(null);
                        setSelectedDeptIds([]);
                      }}
                      style={[styles.filterChip, selectedCycle === null && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, selectedCycle === null && styles.filterChipTextActive]}>最近4个季度</Text>
                    </Pressable>
                    {recentQuarterCycles.map(cycle => (
                      <Pressable
                        key={cycle}
                        onPress={() => {
                          setSelectedCycle(selectedCycle === cycle ? null : cycle);
                          setSelectedDeptIds([]);
                        }}
                        style={[styles.filterChip, selectedCycle === cycle && styles.filterChipActive]}
                      >
                        <Text style={[styles.filterChipText, selectedCycle === cycle && styles.filterChipTextActive]}>{cycle}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {shouldShowDeptFilter && (
                <View style={styles.filterBlock}>
                  <View style={styles.filterRow}>
                    <Pressable onPress={() => setSelectedDeptIds([])} style={[styles.filterChip, selectedDeptIds.length === 0 && styles.filterChipDeptActive]}>
                      <Text style={[styles.filterChipText, selectedDeptIds.length === 0 && styles.filterChipTextActive]}>全部部门</Text>
                    </Pressable>
                    {usedDepts.map(dept => {
                      const isActive = selectedDeptIds.includes(dept.id);
                      return (
                        <Pressable key={dept.id} onPress={() => toggleDept(dept.id)} style={[styles.filterChip, isActive && styles.filterChipDeptActive]}>
                          <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{dept.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {myObjectives.length === 0 ? (
                <View style={styles.emptySectionCard}>
                  <Text style={styles.emptySectionText}>暂无目标</Text>
                </View>
              ) : (
                myObjectives.map(obj => {
                  const objKRs = keyResults.filter(kr => kr.objectiveId === obj.id);
                  const dept = departments.find(d => d.id === obj.departmentId);
                  const avgProg = objKRs.length > 0
                    ? Math.round(objKRs.reduce((s, kr) => s + kr.progress, 0) / objKRs.length)
                    : 0;

                  return (
                    <Pressable
                      key={obj.id}
                      onPress={() => router.push({ pathname: '/objective/[id]', params: { id: obj.id } })}
                      style={({ pressed }) => [styles.objCard, { opacity: pressed ? 0.9 : 1 }]}
                    >
                      <View style={styles.objHeader}>
                        <Text style={styles.objTitle} numberOfLines={1}>{obj.title}</Text>
                        <View style={styles.objBadge}><Text style={styles.objBadgeText}>{obj.cycle}</Text></View>
                      </View>
                      <View style={styles.objMeta}>
                        <Text style={styles.objDept}>{dept?.name || '未知'}</Text>
                        <Text style={styles.objKRCount}>{objKRs.length} 个 KR</Text>
                      </View>
                      <View style={styles.objProgressBar}>
                        <View style={[styles.objProgressFill, { width: `${avgProg}%`, backgroundColor: avgProg >= 70 ? Colors.success : avgProg >= 40 ? Colors.warning : Colors.danger }]} />
                      </View>
                      <Text style={styles.objProgressText}>已完成 {avgProg}%</Text>
                    </Pressable>
                  );
                })
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginTop: 24 }}>
              <View style={styles.sectionHeader}>
                <Ionicons name="people" size={20} color={Colors.success} />
                <Text style={styles.sectionTitle}>本部门协同 KR</Text>
                <View style={[styles.sectionBadge, { backgroundColor: Colors.success + '20' }]}>
                  <Text style={[styles.sectionBadgeText, { color: Colors.success }]}>{assignedObjectiveGroups.length}</Text>
                </View>
              </View>

              {assignedObjectiveGroups.length === 0 ? (
                <View style={styles.emptySectionCard}><Text style={styles.emptySectionText}>暂无本部门协同 KR</Text></View>
              ) : (
                assignedObjectiveGroups.map((group, groupIdx) => {
                  const isExpanded = !!expandedAssignedObjectives[group.objectiveId];
                  const objectiveCreatorName = group.objective.createdBy ? userNameMap.get(group.objective.createdBy) : null;
                  const sourceLabel = objectiveCreatorName || formatSourceLabel(
                    group.items.map(item => item.kr.collaboratorName || item.kr.assigneeName)
                  );
                  return (
                    <View key={group.objectiveId} style={styles.objectiveGroupCard}>
                      <Pressable
                        onPress={() => setExpandedAssignedObjectives(prev => ({ ...prev, [group.objectiveId]: !prev[group.objectiveId] }))}
                        style={({ pressed }) => [styles.objectiveGroupHeader, { opacity: pressed ? 0.85 : 1 }]}
                      >
                        <View style={styles.objectiveGroupHeaderLeft}>
                          <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={16} color={Colors.textSecondary} />
                          <View style={styles.objectiveGroupTitleWrap}>
                            <Text style={styles.objectiveGroupTitle} numberOfLines={1}>{group.objective.title}</Text>
                            <Text style={styles.objectiveGroupSource} numberOfLines={1}>来源: {sourceLabel}</Text>
                          </View>
                        </View>
                        <View style={styles.objectiveGroupMeta}>
                          <Text style={styles.objectiveGroupCycle}>{group.objective.cycle}</Text>
                          <View style={styles.objectiveGroupCountBadge}><Text style={styles.objectiveGroupCountText}>{group.items.length} KR</Text></View>
                        </View>
                      </Pressable>

                      {isExpanded && (
                        <View style={styles.objectiveGroupBody}>
                          {group.items.map((item, itemIdx) => (
                            <KRCard key={item.kr.id} item={item} showActions={!isSuperAdmin} delay={(groupIdx * 3 + itemIdx) * 50} />
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </Animated.View>

            {!isSuperAdmin && (
              <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ marginTop: 24 }}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="globe" size={20} color={Colors.info} />
                  <Text style={styles.sectionTitle}>跨部门协同 KR</Text>
                  <View style={[styles.sectionBadge, { backgroundColor: Colors.info + '20' }]}>
                    <Text style={[styles.sectionBadgeText, { color: Colors.info }]}>{collaboratingObjectiveGroups.length}</Text>
                  </View>
                </View>

                {collaboratingObjectiveGroups.length === 0 ? (
                  <View style={styles.emptySectionCard}><Text style={styles.emptySectionText}>暂无跨部门协同 KR</Text></View>
                ) : (
                  collaboratingObjectiveGroups.map((group, groupIdx) => {
                    const isExpanded = !!expandedCollaboratingObjectives[group.objectiveId];
                    const objectiveCreatorName = group.objective.createdBy ? userNameMap.get(group.objective.createdBy) : null;
                    const sourceLabel = objectiveCreatorName || formatSourceLabel(
                      group.items.map(item => item.kr.assigneeName || item.kr.collaboratorName)
                    );
                    return (
                      <View key={group.objectiveId} style={styles.objectiveGroupCard}>
                        <Pressable
                          onPress={() => setExpandedCollaboratingObjectives(prev => ({ ...prev, [group.objectiveId]: !prev[group.objectiveId] }))}
                          style={({ pressed }) => [styles.objectiveGroupHeader, { opacity: pressed ? 0.85 : 1 }]}
                        >
                          <View style={styles.objectiveGroupHeaderLeft}>
                            <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={16} color={Colors.textSecondary} />
                            <View style={styles.objectiveGroupTitleWrap}>
                              <Text style={styles.objectiveGroupTitle} numberOfLines={1}>{group.objective.title}</Text>
                              <Text style={styles.objectiveGroupSource} numberOfLines={1}>来源: {sourceLabel}</Text>
                            </View>
                          </View>
                          <View style={styles.objectiveGroupMeta}>
                            <Text style={styles.objectiveGroupCycle}>{group.objective.cycle}</Text>
                            <View style={styles.objectiveGroupCountBadge}><Text style={styles.objectiveGroupCountText}>{group.items.length} KR</Text></View>
                          </View>
                        </Pressable>

                        {isExpanded && (
                          <View style={styles.objectiveGroupBody}>
                            {group.items.map((item, itemIdx) => (
                              <KRCard key={item.kr.id} item={item} showActions={false} delay={(groupIdx * 3 + itemIdx) * 50} />
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  scrollContent: { paddingHorizontal: 20 },
  scrollView: { flex: 1 },

  stickyHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEEF5',
    zIndex: 100,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleSection: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  mainTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#171A1D' },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8F9BB3', marginTop: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fabButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0082EF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#171A1D', flex: 1 },
  sectionBadge: { backgroundColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  sectionBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#5E6D82' },

  filterBlock: { marginBottom: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEEF5',
  },
  filterChipActive: { backgroundColor: '#0082EF', borderColor: '#0082EF' },
  filterChipDeptActive: { backgroundColor: '#52C41A', borderColor: '#52C41A' },
  filterChipText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#5E6D82', flexShrink: 1 },
  filterChipTextActive: { color: '#FFFFFF' },

  emptySectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EBEEF5',
  },
  emptySectionText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#8F9BB3' },

  objCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EBEEF5' },
  objHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  objTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#171A1D', flex: 1, marginRight: 8 },
  objBadge: { backgroundColor: '#E6F4FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  objBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#0082EF' },
  objMeta: { flexDirection: 'row', gap: 12, marginTop: 10 },
  objDept: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5E6D82' },
  objKRCount: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8F9BB3' },
  objProgressBar: { height: 4, backgroundColor: '#E8EAEF', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  objProgressFill: { height: 4, borderRadius: 2 },
  objProgressText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8F9BB3', marginTop: 6 },

  objectiveGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EBEEF5',
    marginBottom: 10,
    overflow: 'hidden',
  },
  objectiveGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  objectiveGroupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  objectiveGroupTitleWrap: { flex: 1, minWidth: 0 },
  objectiveGroupTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#171A1D', flexShrink: 1 },
  objectiveGroupSource: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8F9BB3', marginTop: 2 },
  objectiveGroupMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  objectiveGroupCycle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8F9BB3' },
  objectiveGroupCountBadge: { backgroundColor: '#F5F6F7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  objectiveGroupCountText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#5E6D82' },
  objectiveGroupBody: { paddingHorizontal: 10, paddingBottom: 10 },

  krCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EBEEF5' },
  krHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  krDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  krTitle: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#171A1D', flex: 1 },
  krObjName: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8F9BB3', marginTop: 4, marginLeft: 16 },
  krDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5E6D82', marginTop: 4, marginLeft: 16 },
  krMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  krProgressBarOuter: { flex: 1, height: 4, backgroundColor: '#E8EAEF', borderRadius: 2, overflow: 'hidden' },
  krProgressBarInner: { height: 4, borderRadius: 2 },
  krPercent: { fontFamily: 'Inter_600SemiBold', fontSize: 13, width: 40, textAlign: 'right' },
  krStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  krStatusText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  krLastUpdate: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, marginLeft: 16 },
  krLastUpdateText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8F9BB3', flex: 1 },
  krScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 16 },
  krScoreText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#FAAD14' },
  krScoreNote: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8F9BB3', flex: 1 },
  krActions: { flexDirection: 'row', gap: 10, marginTop: 10, marginLeft: 16 },
  krActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F5F6F7' },
  krActionText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#5E6D82' },
});
