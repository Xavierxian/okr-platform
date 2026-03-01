import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

const STATUS_LABELS: Record<string, string> = {
  normal: '正常', behind: '滞后', completed: '已完成', overdue: '已逾期', paused: '已暂停',
};

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

function getScoreColor(score: number): string {
  if (score === 1) return '#10B981';
  if (score === 0.7) return '#3B82F6';
  if (score === 0.3) return '#F59E0B';
  return '#EF4444';
}

function getScoreLabel(score: number): string {
  if (score === 1) return '完全达成';
  if (score === 0.7) return '基本达成';
  if (score === 0.3) return '部分达成';
  return '未达成';
}

export default function ObjectiveDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { objectives, keyResults, departments, removeObjective, removeKeyResult } = useOKR();

  const objective = useMemo(() => objectives.find(o => o.id === id), [objectives, id]);
  const objKRs = useMemo(() => keyResults.filter(kr => kr.objectiveId === id), [keyResults, id]);
  const dept = useMemo(() => departments.find(d => d.id === objective?.departmentId), [departments, objective]);

  const avgProgress = useMemo(() => {
    if (objKRs.length === 0) return 0;
    return Math.round(objKRs.reduce((s, kr) => s + kr.progress, 0) / objKRs.length);
  }, [objKRs]);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  if (!objective) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.notFoundText}>目标未找到</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtnFallback}>
            <Text style={styles.backBtnText}>返回</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleDeleteObjective = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (Platform.OS === 'web') {
      if (window.confirm('此操作将删除该目标及其所有关键结果，确定删除吗？')) {
        await removeObjective(objective.id);
        router.back();
      }
    } else {
      Alert.alert('删除目标', '此操作将删除该目标及其所有关键结果。', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除', style: 'destructive',
          onPress: async () => {
            await removeObjective(objective.id);
            router.back();
          },
        },
      ]);
    }
  };

  const handleDeleteKR = async (krId: string, krTitle: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (Platform.OS === 'web') {
      if (window.confirm(`确定删除"${krTitle}"吗？`)) {
        await removeKeyResult(krId);
      }
    } else {
      Alert.alert('删除关键结果', `确定删除"${krTitle}"吗？`, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => removeKeyResult(krId) },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: topPadding + 8 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: '/create-objective', params: { editId: objective.id } });
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginRight: 16 })}
        >
          <Ionicons name="pencil-outline" size={22} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={handleDeleteObjective} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="trash-outline" size={22} color={Colors.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === 'web' ? 34 : 40 }]} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.objHeader}>
            <View style={styles.cycleBadge}>
              <Text style={styles.cycleBadgeText}>{objective.cycle}</Text>
            </View>
            <View style={styles.deptBadge}>
              <Ionicons name="business-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.deptBadgeText}>{dept?.name || '未知'}</Text>
            </View>
            <View style={[styles.deptBadge, { backgroundColor: (objective.okrType === '挑战型' ? '#F59E0B' : '#3B82F6') + '20' }]}>
              <Ionicons name={objective.okrType === '挑战型' ? "flash-outline" : "shield-checkmark-outline"} size={12} color={objective.okrType === '挑战型' ? '#F59E0B' : '#3B82F6'} />
              <Text style={[styles.deptBadgeText, { color: objective.okrType === '挑战型' ? '#F59E0B' : '#3B82F6' }]}>{objective.okrType || '承诺型'}</Text>
            </View>
            {objective.linkedToParent && (
              <View style={[styles.deptBadge, { backgroundColor: '#8B5CF6' + '20' }]}>
                <Ionicons name="git-merge-outline" size={12} color="#8B5CF6" />
                <Text style={[styles.deptBadgeText, { color: '#8B5CF6' }]}>关联上级</Text>
              </View>
            )}
            {objective.isCollaborative && (
              <View style={[styles.deptBadge, { backgroundColor: Colors.accent + '20' }]}>
                <Ionicons name="people-outline" size={12} color={Colors.accent} />
                <Text style={[styles.deptBadgeText, { color: Colors.accent }]}>跨部门协同</Text>
              </View>
            )}
          </View>

          <Text style={styles.objTitle}>{objective.title}</Text>

          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>整体进度</Text>
              <Text style={[styles.progressValue, {
                color: avgProgress >= 70 ? Colors.success : avgProgress >= 40 ? Colors.warning : Colors.danger
              }]}>{avgProgress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${avgProgress}%`,
                backgroundColor: avgProgress >= 70 ? Colors.success : avgProgress >= 40 ? Colors.warning : Colors.danger,
              }]} />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.krHeader}>
            <Text style={styles.krSectionTitle}>关键结果 ({objKRs.length})</Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/create-kr', params: { objectiveId: objective.id } });
              }}
              style={({ pressed }) => [styles.addKRBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addKRText}>添加 KR</Text>
            </Pressable>
          </View>

          {objKRs.length === 0 ? (
            <View style={styles.emptyKR}>
              <Ionicons name="key-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyKRText}>暂无关键结果</Text>
            </View>
          ) : (
            objKRs.map((kr, idx) => (
              <Animated.View key={kr.id} entering={FadeInDown.delay(300 + idx * 100).duration(300)} style={styles.krCard}>
                <View style={styles.krTop}>
                  <View style={[styles.krStatusDot, { backgroundColor: getStatusColor(kr.status) }]} />
                  <Text style={styles.krTitle} numberOfLines={2}>{kr.title}</Text>
                </View>
                <View style={styles.krMeta}>
                  {kr.assigneeName ? (
                    <View style={styles.krMetaItem}>
                      <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
                      <Text style={styles.krMetaText}>{kr.assigneeName}</Text>
                    </View>
                  ) : null}
                  {kr.collaboratorName ? (
                    <View style={styles.krMetaItem}>
                      <Ionicons name="people-outline" size={12} color={Colors.info} />
                      <Text style={[styles.krMetaText, { color: Colors.info }]}>协同: {kr.collaboratorName}</Text>
                    </View>
                  ) : null}
                  <View style={styles.krMetaItem}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
                    <Text style={styles.krMetaText}>{new Date(kr.endDate).toLocaleDateString('zh-CN')}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: getStatusColor(kr.status) + '20' }]}>
                    <Text style={[styles.statusChipText, { color: getStatusColor(kr.status) }]}>{STATUS_LABELS[kr.status] || kr.status}</Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: (kr.okrType === '挑战型' ? '#F59E0B' : '#3B82F6') + '15' }]}>
                    <Text style={[styles.statusChipText, { color: kr.okrType === '挑战型' ? '#F59E0B' : '#3B82F6' }]}>{kr.okrType || '承诺型'}</Text>
                  </View>
                </View>
                <View style={styles.krProgressRow}>
                  <View style={styles.krProgressBar}>
                    <View style={[styles.krProgressFill, { width: `${kr.progress}%`, backgroundColor: getStatusColor(kr.status) }]} />
                  </View>
                  <Text style={styles.krProgressText}>{kr.progress}%</Text>
                </View>
                {kr.selfScore !== null && (
                  <View style={styles.scoreSection}>
                    <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(kr.selfScore) + '20' }]}>
                      <Text style={[styles.scoreBadgeVal, { color: getScoreColor(kr.selfScore) }]}>{kr.selfScore}</Text>
                    </View>
                    <Text style={styles.scoreLabel}>{getScoreLabel(kr.selfScore)}</Text>
                  </View>
                )}
                <View style={styles.krActions}>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/create-kr', params: { objectiveId: objective.id, editId: kr.id } }); }}
                    style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Ionicons name="pencil-outline" size={16} color={Colors.info} />
                    <Text style={[styles.actionText, { color: Colors.info }]}>编辑</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/update-progress', params: { krId: kr.id } }); }}
                    style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Ionicons name="create-outline" size={16} color={Colors.primary} />
                    <Text style={styles.actionText}>更新进度</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/score-kr', params: { krId: kr.id } }); }}
                    style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Ionicons name="star-outline" size={16} color={Colors.accent} />
                    <Text style={[styles.actionText, { color: Colors.accent }]}>自评</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteKR(kr.id, kr.title)}
                    style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                  </Pressable>
                </View>
                {kr.progressHistory && kr.progressHistory.length > 0 && (
                  <View style={styles.historySection}>
                    <Text style={styles.historyTitle}>最近更新</Text>
                    {kr.progressHistory.slice(-3).reverse().map((entry: any) => (
                      <View key={entry.id} style={styles.historyItem}>
                        <View style={styles.historyDot} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.historyTop}>
                            <Text style={styles.historyProgress}>{entry.progress}%</Text>
                            <Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString('zh-CN')}</Text>
                          </View>
                          {entry.note ? <Text style={styles.historyNote} numberOfLines={2}>{entry.note}</Text> : null}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  scrollContent: { paddingHorizontal: 20 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: Colors.textSecondary },
  backBtnFallback: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  backBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.white },
  objHeader: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  cycleBadge: { backgroundColor: Colors.primary + '20', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  cycleBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.primary },
  deptBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  deptBadgeText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  objTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text, marginBottom: 8 },
  objDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  progressCard: { backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 24 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary },
  progressValue: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  progressBar: { height: 6, backgroundColor: Colors.backgroundTertiary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  krHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  krSectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
  addKRBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addKRText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.primary },
  emptyKR: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyKRText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textTertiary },
  krCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  krTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  krStatusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  krTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text, flex: 1 },
  krDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, marginTop: 6, marginLeft: 18 },
  krMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginLeft: 18 },
  krMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  krMetaText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textSecondary },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusChipText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  krProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginLeft: 18 },
  krProgressBar: { flex: 1, height: 4, backgroundColor: Colors.backgroundTertiary, borderRadius: 2, overflow: 'hidden' },
  krProgressFill: { height: 4, borderRadius: 2 },
  krProgressText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.text, width: 36, textAlign: 'right' },
  scoreSection: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginLeft: 18 },
  scoreBadge: { width: 36, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  scoreBadgeVal: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  scoreLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  krActions: { flexDirection: 'row', gap: 10, marginTop: 12, marginLeft: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundTertiary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.primary },
  historySection: { marginTop: 12, marginLeft: 18, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
  historyTitle: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.textTertiary, marginBottom: 8 },
  historyItem: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  historyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textTertiary, marginTop: 5 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between' },
  historyProgress: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.text },
  historyDate: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textTertiary },
  historyNote: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
