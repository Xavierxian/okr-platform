import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR, type AssignedKRItem } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';
import Animated, { FadeInDown } from 'react-native-reanimated';
import NotificationBell from '@/components/NotificationBell';

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
      <Text style={styles.krObjName} numberOfLines={1}>目标: {objective.title}</Text>
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
          <Text style={styles.krLastUpdateText}>
            最近更新: {kr.progressHistory[kr.progressHistory.length - 1]?.note || '无说明'}
          </Text>
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

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { objectives, keyResults, departments, assignedKRs, collaboratingKRs, isLoading } = useOKR();
  const { user } = useAuth();
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'vp' || user?.role === 'center_head';

  const allMyObjectives = useMemo(() => {
    // 所有用户（包括管理员）只能看到自己创建的目标
    return objectives.filter(obj => obj.createdBy === user?.id);
  }, [objectives, user]);

  const myObjectives = useMemo(() => {
    if (selectedDeptIds.length === 0) return allMyObjectives;
    return allMyObjectives.filter(obj => selectedDeptIds.includes(obj.departmentId));
  }, [allMyObjectives, selectedDeptIds]);

  const usedDepts = useMemo(() => {
    const ids = new Set(allMyObjectives.map(o => o.departmentId));
    return departments.filter(d => ids.has(d.id));
  }, [allMyObjectives, departments]);

  const toggleDept = (id: string) => {
    setSelectedDeptIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const topPadding = Platform.OS === 'web' ? 20 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const hasContent = myObjectives.length > 0 || assignedKRs.length > 0 || collaboratingKRs.length > 0;

  return (
    <View style={styles.container}>
      {/* 固定在顶部的仪表盘标题 */}
      <View style={[styles.stickyHeader, { paddingTop: topPadding }]}> 
        <View style={styles.headerContent}>
          <View style={styles.titleSection}>
            <View style={styles.iconContainer}>
              <Ionicons name="stats-chart" size={28} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.mainTitle}>{user?.displayName || 'OKR'} 的仪表盘</Text>
              <Text style={styles.subtitle}>
                {myObjectives.length} 个目标 · {assignedKRs.length} 个协同KR · {collaboratingKRs.length} 个跨部门协同
              </Text>
            </View>
          </View>
            
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push('/create-objective')} style={({ pressed }) => [styles.fabButton, { opacity: pressed ? 0.9 : 1 }]}> 
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding + 120, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }]}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >

        {!hasContent ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="flag" size={64} color="#0082EF" />
              </View>
              <Text style={styles.emptyStateTitle}>开始你的 OKR 之旅</Text>
              <Text style={styles.emptyStateText}>
                创建你的第一个目标，开始追踪团队目标进展。
                OKR 帮助你明确方向，聚焦重点，实现团队协作。
              </Text>
              <View style={styles.emptyStateActions}>
                <Pressable 
                  onPress={() => router.push('/create-objective')} 
                  style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>创建目标</Text>
                </Pressable>
                <Pressable 
                  onPress={() => router.push('/okrs')} 
                  style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <Text style={styles.secondaryButtonText}>查看目标</Text>
                </Pressable>
              </View>
              <View style={styles.emptyStateFeatures}>
                <View style={styles.featureItem}>
                  <Ionicons name="target" size={20} color="#10B981" />
                  <Text style={styles.featureText}>明确目标方向</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="trending-up" size={20} color="#3B82F6" />
                  <Text style={styles.featureText}>追踪进度</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="people" size={20} color="#8B5CF6" />
                  <Text style={styles.featureText}>团队协作</Text>
                </View>
              </View>
            </View>
          </Animated.View>
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
                        <View style={styles.objBadge}>
                          <Text style={styles.objBadgeText}>{obj.cycle}</Text>
                        </View>
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
                  <Text style={[styles.sectionBadgeText, { color: Colors.success }]}>{assignedKRs.length}</Text>
                </View>
              </View>
              {assignedKRs.length === 0 ? (
                <View style={styles.emptySectionCard}>
                  <Text style={styles.emptySectionText}>暂无本部门协同 KR</Text>
                </View>
              ) : (
                assignedKRs.map((item, idx) => (
                  <KRCard key={item.kr.id} item={item} showActions={true} delay={idx * 50} />
                ))
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={{ marginTop: 24 }}>
              <View style={styles.sectionHeader}>
                <Ionicons name="globe" size={20} color={Colors.info} />
                <Text style={styles.sectionTitle}>跨部门协同 KR</Text>
                <View style={[styles.sectionBadge, { backgroundColor: Colors.info + '20' }]}>
                  <Text style={[styles.sectionBadgeText, { color: Colors.info }]}>{collaboratingKRs.length}</Text>
                </View>
              </View>
              {collaboratingKRs.length === 0 ? (
                <View style={styles.emptySectionCard}>
                  <Text style={styles.emptySectionText}>暂无跨部门协同 KR</Text>
                </View>
              ) : (
                collaboratingKRs.map((item, idx) => (
                  <KRCard key={item.kr.id} item={item} showActions={false} delay={idx * 50} />
                ))
              )}
            </Animated.View>
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
  
  // 固定在顶部的头部
  stickyHeader: {
    backgroundColor: '#0082EF',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#0082EF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 100,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fabButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  
  // 保持原有样式兼容
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },

  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0082EF', alignItems: 'center', justifyContent: 'center', shadowColor: '#0082EF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: '#171A1D', flex: 1 },
  sectionBadge: { backgroundColor: '#E6F4FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  sectionBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#0082EF' },
  emptySectionCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#EBEEF5' },
  emptySectionText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#8F9BB3' },
  objCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#EBEEF5' },
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
  krCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#0082EF', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
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
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: '#171A1D' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#5E6D82', textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0082EF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8, shadowColor: '#0082EF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  emptyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  deptFilter: { marginBottom: 16 },
  deptFilterRow: { flexDirection: 'row', gap: 8 },
  deptChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EBEEF5' },
  deptChipActive: { backgroundColor: '#0082EF', borderColor: '#0082EF' },
  deptChipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#5E6D82' },
  deptChipTextActive: { color: '#FFFFFF' },
  // 新的空状态样式
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#EBEEF5',
    marginHorizontal: 20,
  },
  emptyStateIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E6F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#171A1D',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  emptyStateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#5E6D82',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  emptyStateActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0082EF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#0082EF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EBEEF5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#0082EF',
  },
  emptyStateFeatures: {
    flexDirection: 'row',
    gap: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#EBEEF5',
  },
  featureItem: {
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#5E6D82',
  },
});
