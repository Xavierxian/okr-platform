import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';

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

function Bar({ label, value, maxValue, color, delay, suffix }: { label: string; value: number; maxValue: number; color: string; delay: number; suffix?: string }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color }]}>{value}{suffix || '%'}</Text>
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
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiError, setAiError] = useState('');

  const cycles = useMemo(() => {
    const c = [...new Set(objectives.map(o => o.cycle))].sort();
    return c;
  }, [objectives]);

  const { data: rankingsData } = useQuery({
    queryKey: [selectedCycle ? `/api/analytics/department-rankings?cycle=${encodeURIComponent(selectedCycle)}` : '/api/analytics/department-rankings'],
    enabled: !!selectedCycle,
  });

  const filteredObjs = useMemo(() => {
    let objs = objectives;
    if (selectedCycle) objs = objs.filter(o => o.cycle === selectedCycle);
    if (selectedDeptId) objs = objs.filter(o => o.departmentId === selectedDeptId);
    return objs;
  }, [objectives, selectedCycle, selectedDeptId]);

  const filteredKRs = useMemo(() => {
    const objIds = new Set(filteredObjs.map(o => o.id));
    return keyResults.filter(kr => objIds.has(kr.objectiveId));
  }, [keyResults, filteredObjs]);

  const statusBreakdown = useMemo(() => {
    const normal = filteredKRs.filter(kr => kr.status === 'normal').length;
    const behind = filteredKRs.filter(kr => kr.status === 'behind').length;
    const completed = filteredKRs.filter(kr => kr.status === 'completed').length;
    const overdue = filteredKRs.filter(kr => kr.status === 'overdue').length;
    const paused = filteredKRs.filter(kr => kr.status === 'paused').length;
    return { normal, behind, completed, overdue, paused, total: filteredKRs.length };
  }, [filteredKRs]);

  const scoreStats = useMemo(() => {
    const scored = filteredKRs.filter(kr => kr.selfScore !== null);
    const scores = [1, 0.7, 0.3, 0];
    return scores.map(s => ({
      score: s,
      count: scored.filter(kr => kr.selfScore === s).length,
      total: scored.length,
    }));
  }, [filteredKRs]);

  const rankings = (rankingsData as any)?.rankings || [];

  const handleAiAnalysis = useCallback(async () => {
    if (!selectedCycle || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    setAiAnalysis('');
    try {
      const res = await apiRequest("POST", "/api/analytics/ai-analysis", {
        cycle: selectedCycle,
        departmentId: selectedDeptId || undefined,
      });
      const data = await res.json();
      setAiAnalysis(data.analysis);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes(':')) {
        try {
          const parsed = JSON.parse(msg.split(':').slice(1).join(':').trim());
          setAiError(parsed.message || 'AI 分析失败');
        } catch {
          setAiError('AI 分析失败，请重试');
        }
      } else {
        setAiError('AI 分析失败，请重试');
      }
    }
    setAiLoading(false);
  }, [selectedCycle, selectedDeptId, aiLoading]);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const hasData = filteredKRs.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding + 16, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>数据分析</Text>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>周期筛选</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <Pressable onPress={() => { setSelectedCycle(''); setAiAnalysis(''); }} style={[styles.chip, !selectedCycle && styles.chipActive]}>
                <Text style={[styles.chipText, !selectedCycle && styles.chipTextActive]}>全部</Text>
              </Pressable>
              {cycles.map(c => (
                <Pressable key={c} onPress={() => { setSelectedCycle(c); setAiAnalysis(''); }} style={[styles.chip, selectedCycle === c && styles.chipActive]}>
                  <Text style={[styles.chipText, selectedCycle === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>部门筛选</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <Pressable onPress={() => { setSelectedDeptId(''); setAiAnalysis(''); }} style={[styles.chip, !selectedDeptId && styles.chipActive]}>
                <Text style={[styles.chipText, !selectedDeptId && styles.chipTextActive]}>全部</Text>
              </Pressable>
              {departments.map(d => (
                <Pressable key={d.id} onPress={() => { setSelectedDeptId(d.id); setAiAnalysis(''); }} style={[styles.chip, selectedDeptId === d.id && styles.chipActive]}>
                  <Text style={[styles.chipText, selectedDeptId === d.id && styles.chipTextActive]}>{d.name}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

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
                <Ionicons name="trending-up" size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>汇总概览</Text>
              </View>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{filteredObjs.length}</Text>
                  <Text style={styles.summaryLabel}>目标数</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{filteredKRs.length}</Text>
                  <Text style={styles.summaryLabel}>关键结果</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: Colors.success }]}>
                    {filteredKRs.length > 0 ? Math.round((statusBreakdown.completed / statusBreakdown.total) * 100) : 0}%
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

            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
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

            {rankings.length > 0 && !selectedDeptId && (
              <>
                <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="bar-chart" size={18} color={Colors.primary} />
                    <Text style={styles.sectionTitle}>部门进度排名</Text>
                  </View>
                  {rankings.map((dept: any, idx: number) => (
                    <Bar
                      key={dept.departmentId}
                      label={dept.departmentName}
                      value={dept.avgProgress}
                      maxValue={100}
                      color={dept.avgProgress >= 70 ? Colors.success : dept.avgProgress >= 40 ? Colors.warning : Colors.danger}
                      delay={idx * 60}
                    />
                  ))}
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="star" size={18} color={Colors.accent} />
                    <Text style={styles.sectionTitle}>部门自评排名</Text>
                  </View>
                  {rankings.filter((d: any) => d.avgScore > 0).length > 0 ? (
                    [...rankings].filter((d: any) => d.avgScore > 0).sort((a: any, b: any) => b.avgScore - a.avgScore).map((dept: any, idx: number) => (
                      <Bar
                        key={dept.departmentId}
                        label={dept.departmentName}
                        value={dept.avgScore}
                        maxValue={1}
                        color={dept.avgScore >= 0.7 ? Colors.success : dept.avgScore >= 0.3 ? Colors.warning : Colors.danger}
                        delay={idx * 60}
                        suffix=""
                      />
                    ))
                  ) : (
                    <Text style={styles.noScoreText}>暂无自评数据</Text>
                  )}
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="checkmark-done" size={18} color={Colors.success} />
                    <Text style={styles.sectionTitle}>部门完成率对比</Text>
                  </View>
                  {[...rankings].sort((a: any, b: any) => b.completionRate - a.completionRate).map((dept: any, idx: number) => (
                    <Bar
                      key={dept.departmentId}
                      label={dept.departmentName}
                      value={dept.completionRate}
                      maxValue={100}
                      color={dept.completionRate >= 70 ? Colors.success : dept.completionRate >= 40 ? Colors.warning : Colors.danger}
                      delay={idx * 60}
                    />
                  ))}
                </Animated.View>
              </>
            )}

            {scoreStats.some(s => s.total > 0) && (
              <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.section}>
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

            {selectedCycle && (
              <Animated.View entering={FadeInDown.delay(600).duration(400)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles" size={18} color="#8B5CF6" />
                  <Text style={styles.sectionTitle}>AI 智能分析</Text>
                </View>
                {!aiAnalysis && !aiLoading && (
                  <Pressable onPress={handleAiAnalysis} style={({ pressed }) => [styles.aiBtn, { opacity: pressed ? 0.9 : 1 }]}>
                    <Ionicons name="sparkles" size={18} color={Colors.white} />
                    <Text style={styles.aiBtnText}>生成 AI 分析报告</Text>
                  </Pressable>
                )}
                {aiLoading && (
                  <View style={styles.aiLoading}>
                    <ActivityIndicator size="small" color="#8B5CF6" />
                    <Text style={styles.aiLoadingText}>AI 正在分析数据...</Text>
                  </View>
                )}
                {aiError ? (
                  <View style={styles.aiErrorBox}>
                    <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                    <Text style={styles.aiErrorText}>{aiError}</Text>
                    <Pressable onPress={handleAiAnalysis}>
                      <Text style={styles.aiRetry}>重试</Text>
                    </Pressable>
                  </View>
                ) : null}
                {aiAnalysis ? (
                  <View style={styles.aiResult}>
                    <Text style={styles.aiText}>{aiAnalysis}</Text>
                  </View>
                ) : null}
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text, marginBottom: 16 },
  filterSection: { marginBottom: 12 },
  filterLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.backgroundTertiary },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  section: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  barLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, width: 80 },
  barTrack: { flex: 1, height: 8, backgroundColor: Colors.backgroundTertiary, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, width: 44, textAlign: 'right' },
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
  noScoreText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 10 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#8B5CF6', paddingVertical: 14, borderRadius: 12 },
  aiBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.white },
  aiLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  aiLoadingText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#8B5CF6' },
  aiErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.danger + '15', borderRadius: 10, padding: 12 },
  aiErrorText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.danger, flex: 1 },
  aiRetry: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.primary },
  aiResult: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 16 },
  aiText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text, lineHeight: 22 },
});
