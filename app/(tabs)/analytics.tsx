import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOKR } from '@/lib/okr-context';
import Colors from '@/constants/colors';
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
import Animated, { FadeInDown } from 'react-native-reanimated';

function Bar({ label, value, maxValue, color, delay }: { label: string; value: number; maxValue: number; color: string; delay: number }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color }]}>{value}%</Text>
    </Animated.View>
  );
}

function PieSegment({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.pieItem}>
      <View style={[styles.pieDot, { backgroundColor: color }]} />
      <Text style={styles.pieLabel}>{label}</Text>
      <Text style={styles.pieValue}>{value}</Text>
      <Text style={styles.piePct}>{pct}%</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { objectives, keyResults, departments, isLoading } = useOKR();

  const deptStats = useMemo(() => {
    const stats: { name: string; avgProgress: number; count: number; completedRate: number }[] = [];
    const deptIds = new Set(objectives.map(o => o.departmentId));

    deptIds.forEach(deptId => {
      const dept = departments.find(d => d.id === deptId);
      const deptObjs = objectives.filter(o => o.departmentId === deptId);
      const deptKRs = keyResults.filter(kr =>
        deptObjs.some(o => o.id === kr.objectiveId)
      );
      if (deptKRs.length > 0) {
        const avg = Math.round(deptKRs.reduce((s, kr) => s + kr.progress, 0) / deptKRs.length);
        const completed = deptKRs.filter(kr => kr.status === 'completed').length;
        stats.push({
          name: dept?.name || '未知',
          avgProgress: avg,
          count: deptKRs.length,
          completedRate: Math.round((completed / deptKRs.length) * 100),
        });
      }
    });

    return stats.sort((a, b) => b.avgProgress - a.avgProgress);
  }, [objectives, keyResults, departments]);

  const statusBreakdown = useMemo(() => {
    const normal = keyResults.filter(kr => kr.status === 'normal').length;
    const behind = keyResults.filter(kr => kr.status === 'behind').length;
    const completed = keyResults.filter(kr => kr.status === 'completed').length;
    const overdue = keyResults.filter(kr => kr.status === 'overdue').length;
    const paused = keyResults.filter(kr => kr.status === 'paused').length;
    return { normal, behind, completed, overdue, paused, total: keyResults.length };
  }, [keyResults]);

  const scoreStats = useMemo(() => {
    const scored = keyResults.filter(kr => kr.selfScore !== null);
    const scores = [1, 0.7, 0.3, 0];
    return scores.map(s => ({
      score: s,
      count: scored.filter(kr => kr.selfScore === s).length,
      total: scored.length,
    }));
  }, [keyResults]);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const hasData = keyResults.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding + 16, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>数据分析</Text>

        {!hasData ? (
          <View style={styles.empty}>
            <Ionicons name="analytics-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>暂无数据</Text>
            <Text style={styles.emptyText}>创建目标和关键结果后即可查看分析报表</Text>
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="pie-chart" size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>状态分布</Text>
              </View>
              <View style={styles.pieList}>
                <PieSegment label="正常推进" value={statusBreakdown.normal} total={statusBreakdown.total} color={Colors.success} />
                <PieSegment label="已完成" value={statusBreakdown.completed} total={statusBreakdown.total} color={Colors.info} />
                <PieSegment label="进度滞后" value={statusBreakdown.behind} total={statusBreakdown.total} color={Colors.warning} />
                <PieSegment label="已逾期" value={statusBreakdown.overdue} total={statusBreakdown.total} color={Colors.danger} />
                <PieSegment label="已暂停" value={statusBreakdown.paused} total={statusBreakdown.total} color={Colors.textTertiary} />
              </View>
            </Animated.View>

            {deptStats.length > 0 && (
              <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bar-chart" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>部门进度</Text>
                </View>
                {deptStats.map((dept, idx) => (
                  <Bar
                    key={dept.name}
                    label={dept.name}
                    value={dept.avgProgress}
                    maxValue={100}
                    color={dept.avgProgress >= 70 ? Colors.success : dept.avgProgress >= 40 ? Colors.warning : Colors.danger}
                    delay={idx * 80}
                  />
                ))}
              </Animated.View>
            )}

            {scoreStats.some(s => s.total > 0) && (
              <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="star" size={18} color={Colors.accent} />
                  <Text style={styles.sectionTitle}>自评分布</Text>
                </View>
                {scoreStats.map(s => (
                  <View key={s.score} style={styles.scoreRow}>
                    <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(s.score) + '20' }]}>
                      <Text style={[styles.scoreBadgeText, { color: getScoreColor(s.score) }]}>{s.score}</Text>
                    </View>
                    <Text style={styles.scoreLabel}>{getScoreLabel(s.score)}</Text>
                    <Text style={styles.scoreCount}>{s.count}</Text>
                    <Text style={styles.scorePct}>{s.total > 0 ? Math.round((s.count / s.total) * 100) : 0}%</Text>
                  </View>
                ))}
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(600).duration(400)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>汇总概览</Text>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{objectives.length}</Text>
                  <Text style={styles.summaryLabel}>目标数</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{keyResults.length}</Text>
                  <Text style={styles.summaryLabel}>关键结果</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: Colors.success }]}>
                    {keyResults.length > 0 ? Math.round((statusBreakdown.completed / statusBreakdown.total) * 100) : 0}%
                  </Text>
                  <Text style={styles.summaryLabel}>完成率</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: Colors.danger }]}>
                    {statusBreakdown.overdue + statusBreakdown.behind}
                  </Text>
                  <Text style={styles.summaryLabel}>风险项</Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text, marginBottom: 24 },
  section: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  barLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, width: 80 },
  barTrack: { flex: 1, height: 8, backgroundColor: Colors.backgroundTertiary, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, width: 40, textAlign: 'right' },
  pieList: { gap: 10 },
  pieItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pieDot: { width: 10, height: 10, borderRadius: 5 },
  pieLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, flex: 1 },
  pieValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text, width: 30, textAlign: 'right' },
  piePct: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, width: 40, textAlign: 'right' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  scoreBadge: { width: 40, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scoreBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  scoreLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, flex: 1 },
  scoreCount: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text, width: 30, textAlign: 'right' },
  scorePct: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, width: 40, textAlign: 'right' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { flex: 1, minWidth: '40%', backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 14, alignItems: 'center' },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
