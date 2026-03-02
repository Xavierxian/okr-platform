import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOKR } from '@/lib/okr-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import NotificationBell from '@/components/NotificationBell';

function getScoreColor(score: number): string {
  if (score >= 0.7) return Colors.success;
  if (score >= 0.3) return Colors.warning;
  return Colors.danger;
}

function Bar({ label, value, maxValue, color, delay, suffix }: { label: string; value: number; maxValue: number; color: string; delay: number; suffix?: string }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)} style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color }]}>{value}{suffix === undefined ? '%' : suffix}</Text>
    </Animated.View>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color?: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={18} color={color || Colors.primary} />
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    return [...new Set(objectives.map(o => o.cycle))].sort();
  }, [objectives]);

  const recentCycles = useMemo(() => {
    return cycles.slice(-3);
  }, [cycles]);

  const { data: rankingsData } = useQuery({
    queryKey: [selectedCycle ? `/api/analytics/department-rankings?cycle=${encodeURIComponent(selectedCycle)}` : '/api/analytics/department-rankings'],
    enabled: true,
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

  const typeDistribution = useMemo(() => {
    const commitObjs = filteredObjs.filter(o => (o.okrType || '承诺型') === '承诺型');
    const challengeObjs = filteredObjs.filter(o => (o.okrType || '承诺型') === '挑战型');
    const commitKRs = filteredKRs.filter(kr => (kr.okrType || '承诺型') === '承诺型');
    const challengeKRs = filteredKRs.filter(kr => (kr.okrType || '承诺型') === '挑战型');

    const commitScoredKRs = commitKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);
    const challengeScoredKRs = challengeKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);
    const commitAvgScore = commitScoredKRs.length > 0
      ? (commitScoredKRs.reduce((s, kr) => s + (kr.selfScore || 0), 0) / commitScoredKRs.length)
      : null;
    const challengeAvgScore = challengeScoredKRs.length > 0
      ? (challengeScoredKRs.reduce((s, kr) => s + (kr.selfScore || 0), 0) / challengeScoredKRs.length)
      : null;

    return {
      commitObjCount: commitObjs.length,
      challengeObjCount: challengeObjs.length,
      commitKRCount: commitKRs.length,
      challengeKRCount: challengeKRs.length,
      commitAvgScore,
      challengeAvgScore,
      commitAvgProgress: commitKRs.length > 0 ? Math.round(commitKRs.reduce((s, kr) => s + kr.progress, 0) / commitKRs.length) : 0,
      challengeAvgProgress: challengeKRs.length > 0 ? Math.round(challengeKRs.reduce((s, kr) => s + kr.progress, 0) / challengeKRs.length) : 0,
    };
  }, [filteredObjs, filteredKRs]);

  const linkedStats = useMemo(() => {
    const linked = filteredObjs.filter(o => o.linkedToParent);
    const unlinked = filteredObjs.filter(o => !o.linkedToParent);
    const linkedObjIds = new Set(linked.map(o => o.id));
    const unlinkedObjIds = new Set(unlinked.map(o => o.id));
    const linkedKRs = filteredKRs.filter(kr => linkedObjIds.has(kr.objectiveId));
    const unlinkedKRs = filteredKRs.filter(kr => unlinkedObjIds.has(kr.objectiveId));

    const linkedScored = linkedKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);
    const unlinkedScored = unlinkedKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);

    return {
      linkedCount: linked.length,
      unlinkedCount: unlinked.length,
      linkedAvgProgress: linkedKRs.length > 0 ? Math.round(linkedKRs.reduce((s, kr) => s + kr.progress, 0) / linkedKRs.length) : 0,
      unlinkedAvgProgress: unlinkedKRs.length > 0 ? Math.round(unlinkedKRs.reduce((s, kr) => s + kr.progress, 0) / unlinkedKRs.length) : 0,
      linkedAvgScore: linkedScored.length > 0 ? (linkedScored.reduce((s, kr) => s + (kr.selfScore || 0), 0) / linkedScored.length) : null,
      unlinkedAvgScore: unlinkedScored.length > 0 ? (unlinkedScored.reduce((s, kr) => s + (kr.selfScore || 0), 0) / unlinkedScored.length) : null,
    };
  }, [filteredObjs, filteredKRs]);

  const cycleTrend = useMemo(() => {
    if (recentCycles.length === 0) return [];
    return recentCycles.map(cycle => {
      const cObjs = objectives.filter(o => o.cycle === cycle);
      const cObjIds = new Set(cObjs.map(o => o.id));
      const cKRs = keyResults.filter(kr => cObjIds.has(kr.objectiveId));
      const scored = cKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);
      const avgScore = scored.length > 0 ? parseFloat((scored.reduce((s, kr) => s + (kr.selfScore || 0), 0) / scored.length).toFixed(2)) : 0;
      const avgProgress = cKRs.length > 0 ? Math.round(cKRs.reduce((s, kr) => s + kr.progress, 0) / cKRs.length) : 0;

      const commitKRs = cKRs.filter(kr => (kr.okrType || '承诺型') === '承诺型');
      const challengeKRs = cKRs.filter(kr => (kr.okrType || '承诺型') === '挑战型');
      const commitScored = commitKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);
      const challengeScored = challengeKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);

      return {
        cycle,
        avgScore,
        avgProgress,
        objCount: cObjs.length,
        krCount: cKRs.length,
        commitAvgScore: commitScored.length > 0 ? parseFloat((commitScored.reduce((s, kr) => s + (kr.selfScore || 0), 0) / commitScored.length).toFixed(2)) : null,
        challengeAvgScore: challengeScored.length > 0 ? parseFloat((challengeScored.reduce((s, kr) => s + (kr.selfScore || 0), 0) / challengeScored.length).toFixed(2)) : null,
      };
    });
  }, [objectives, keyResults, recentCycles]);

  const deptScoreStats = useMemo(() => {
    return departments.map(dept => {
      const deptObjs = filteredObjs.filter(o => o.departmentId === dept.id);
      const deptObjIds = new Set(deptObjs.map(o => o.id));
      const deptKRs = filteredKRs.filter(kr => deptObjIds.has(kr.objectiveId));
      const scoredKRs = deptKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);
      const krAvg = scoredKRs.length > 0 ? parseFloat((scoredKRs.reduce((s, kr) => s + (kr.selfScore || 0), 0) / scoredKRs.length).toFixed(2)) : null;

      const objScores = deptObjs.map(obj => {
        const objKRs = deptKRs.filter(kr => kr.objectiveId === obj.id);
        const objScored = objKRs.filter(kr => kr.selfScore !== null && kr.selfScore !== undefined);
        return objScored.length > 0 ? objScored.reduce((s, kr) => s + (kr.selfScore || 0), 0) / objScored.length : null;
      }).filter(s => s !== null) as number[];
      const oAvg = objScores.length > 0 ? parseFloat((objScores.reduce((s, v) => s + v, 0) / objScores.length).toFixed(2)) : null;

      return {
        deptId: dept.id,
        deptName: dept.name,
        krAvgScore: krAvg,
        oAvgScore: oAvg,
        krCount: deptKRs.length,
        objCount: deptObjs.length,
      };
    }).filter(d => d.krCount > 0);
  }, [departments, filteredObjs, filteredKRs]);

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
      setAiError('AI 分析失败，请重试');
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={styles.title}>数据分析</Text>
          <NotificationBell />
        </View>

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
            {/* 汇总概览 */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>汇总概览</Text>
              </View>
              <View style={styles.statsRow}>
                <StatCard label="目标数" value={filteredObjs.length} icon="flag-outline" />
                <StatCard label="关键结果" value={filteredKRs.length} icon="key-outline" />
                <StatCard label="完成率" value={`${filteredKRs.length > 0 ? Math.round((statusBreakdown.completed / statusBreakdown.total) * 100) : 0}%`} color={Colors.success} icon="checkmark-circle-outline" />
                <StatCard label="风险项" value={statusBreakdown.overdue + statusBreakdown.behind} color={Colors.danger} icon="warning-outline" />
              </View>
            </Animated.View>

            {/* 状态分布 */}
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

            {/* 承诺型 vs 挑战型 */}
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="flash" size={18} color={Colors.accent} />
                <Text style={styles.sectionTitle}>承诺型 vs 挑战型</Text>
              </View>
              <View style={styles.compareGrid}>
                <View style={styles.compareCard}>
                  <View style={[styles.compareIcon, { backgroundColor: Colors.info + '15' }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={Colors.info} />
                  </View>
                  <Text style={styles.compareTitle}>承诺型</Text>
                  <Text style={styles.compareDetail}>{typeDistribution.commitObjCount} 个目标 · {typeDistribution.commitKRCount} 个KR</Text>
                  <Text style={styles.compareProgress}>平均进度 {typeDistribution.commitAvgProgress}%</Text>
                  <Text style={[styles.compareScore, { color: typeDistribution.commitAvgScore !== null ? getScoreColor(typeDistribution.commitAvgScore) : Colors.textTertiary }]}>
                    平均评分 {typeDistribution.commitAvgScore !== null ? typeDistribution.commitAvgScore.toFixed(2) : '暂无'}
                  </Text>
                </View>
                <View style={styles.compareCard}>
                  <View style={[styles.compareIcon, { backgroundColor: Colors.accent + '15' }]}>
                    <Ionicons name="flash-outline" size={20} color={Colors.accent} />
                  </View>
                  <Text style={styles.compareTitle}>挑战型</Text>
                  <Text style={styles.compareDetail}>{typeDistribution.challengeObjCount} 个目标 · {typeDistribution.challengeKRCount} 个KR</Text>
                  <Text style={styles.compareProgress}>平均进度 {typeDistribution.challengeAvgProgress}%</Text>
                  <Text style={[styles.compareScore, { color: typeDistribution.challengeAvgScore !== null ? getScoreColor(typeDistribution.challengeAvgScore) : Colors.textTertiary }]}>
                    平均评分 {typeDistribution.challengeAvgScore !== null ? typeDistribution.challengeAvgScore.toFixed(2) : '暂无'}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* 关联上级分析 */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="git-merge" size={18} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>是否关联上级分析</Text>
              </View>
              <View style={styles.compareGrid}>
                <View style={styles.compareCard}>
                  <View style={[styles.compareIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
                    <Ionicons name="git-merge-outline" size={20} color="#8B5CF6" />
                  </View>
                  <Text style={styles.compareTitle}>已关联</Text>
                  <Text style={styles.compareDetail}>{linkedStats.linkedCount} 个目标</Text>
                  <Text style={styles.compareProgress}>平均进度 {linkedStats.linkedAvgProgress}%</Text>
                  <Text style={[styles.compareScore, { color: linkedStats.linkedAvgScore !== null ? getScoreColor(linkedStats.linkedAvgScore) : Colors.textTertiary }]}>
                    平均评分 {linkedStats.linkedAvgScore !== null ? linkedStats.linkedAvgScore.toFixed(2) : '暂无'}
                  </Text>
                </View>
                <View style={styles.compareCard}>
                  <View style={[styles.compareIcon, { backgroundColor: Colors.textTertiary + '15' }]}>
                    <Ionicons name="remove-circle-outline" size={20} color={Colors.textTertiary} />
                  </View>
                  <Text style={styles.compareTitle}>未关联</Text>
                  <Text style={styles.compareDetail}>{linkedStats.unlinkedCount} 个目标</Text>
                  <Text style={styles.compareProgress}>平均进度 {linkedStats.unlinkedAvgProgress}%</Text>
                  <Text style={[styles.compareScore, { color: linkedStats.unlinkedAvgScore !== null ? getScoreColor(linkedStats.unlinkedAvgScore) : Colors.textTertiary }]}>
                    平均评分 {linkedStats.unlinkedAvgScore !== null ? linkedStats.unlinkedAvgScore.toFixed(2) : '暂无'}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* 部门 O/KR 平均分 */}
            {deptScoreStats.length > 0 && (
              <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="business" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>部门 O/KR 平均分</Text>
                </View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableCellName]}>部门</Text>
                  <Text style={[styles.tableCell, styles.tableCellNum]}>O均分</Text>
                  <Text style={[styles.tableCell, styles.tableCellNum]}>KR均分</Text>
                  <Text style={[styles.tableCell, styles.tableCellNum]}>目标数</Text>
                </View>
                {deptScoreStats.map(d => (
                  <View key={d.deptId} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableCellName]} numberOfLines={1}>{d.deptName}</Text>
                    <Text style={[styles.tableCell, styles.tableCellNum, d.oAvgScore !== null ? { color: getScoreColor(d.oAvgScore) } : {}]}>{d.oAvgScore !== null ? d.oAvgScore.toFixed(2) : '-'}</Text>
                    <Text style={[styles.tableCell, styles.tableCellNum, d.krAvgScore !== null ? { color: getScoreColor(d.krAvgScore) } : {}]}>{d.krAvgScore !== null ? d.krAvgScore.toFixed(2) : '-'}</Text>
                    <Text style={[styles.tableCell, styles.tableCellNum]}>{d.objCount}</Text>
                  </View>
                ))}
              </Animated.View>
            )}

            {/* 部门进度排名 */}
            {rankings.length > 0 && !selectedDeptId && (
              <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bar-chart" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>部门进度排名</Text>
                </View>
                {rankings.map((dept: any, idx: number) => (
                  <Bar key={dept.departmentId} label={dept.departmentName} value={dept.avgProgress} maxValue={100}
                    color={dept.avgProgress >= 70 ? Colors.success : dept.avgProgress >= 40 ? Colors.warning : Colors.danger} delay={idx * 50} />
                ))}
              </Animated.View>
            )}

            {/* 部门自评排名 */}
            {rankings.length > 0 && !selectedDeptId && (
              <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="star" size={18} color={Colors.accent} />
                  <Text style={styles.sectionTitle}>部门自评排名（KR平均）</Text>
                </View>
                {rankings.filter((d: any) => d.avgScore > 0).length > 0 ? (
                  [...rankings].filter((d: any) => d.avgScore > 0).sort((a: any, b: any) => b.avgScore - a.avgScore).map((dept: any, idx: number) => (
                    <Bar key={dept.departmentId} label={dept.departmentName} value={dept.avgScore} maxValue={1}
                      color={dept.avgScore >= 0.7 ? Colors.success : dept.avgScore >= 0.3 ? Colors.warning : Colors.danger} delay={idx * 50} suffix="" />
                  ))
                ) : (
                  <Text style={styles.noDataText}>暂无自评数据</Text>
                )}
              </Animated.View>
            )}

            {/* 近三周期趋势 — 仅在"全部"周期时显示 */}
            {!selectedCycle && cycleTrend.length > 1 && (
              <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="trending-up" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>近{recentCycles.length}周期评分趋势</Text>
                </View>
                <View style={styles.trendTable}>
                  <View style={styles.trendHeaderRow}>
                    <Text style={[styles.trendCell, styles.trendCellName]}>周期</Text>
                    <Text style={[styles.trendCell, styles.trendCellNum]}>目标</Text>
                    <Text style={[styles.trendCell, styles.trendCellNum]}>KR</Text>
                    <Text style={[styles.trendCell, styles.trendCellNum]}>总均分</Text>
                    <Text style={[styles.trendCell, styles.trendCellNum]}>承诺型</Text>
                    <Text style={[styles.trendCell, styles.trendCellNum]}>挑战型</Text>
                  </View>
                  {cycleTrend.map(ct => (
                    <View key={ct.cycle} style={styles.trendDataRow}>
                      <Text style={[styles.trendCell, styles.trendCellName]} numberOfLines={1}>{ct.cycle}</Text>
                      <Text style={[styles.trendCell, styles.trendCellNum]}>{ct.objCount}</Text>
                      <Text style={[styles.trendCell, styles.trendCellNum]}>{ct.krCount}</Text>
                      <Text style={[styles.trendCell, styles.trendCellNum, ct.avgScore > 0 ? { color: getScoreColor(ct.avgScore), fontFamily: 'Inter_600SemiBold' } : {}]}>{ct.avgScore > 0 ? ct.avgScore.toFixed(2) : '-'}</Text>
                      <Text style={[styles.trendCell, styles.trendCellNum, ct.commitAvgScore !== null ? { color: Colors.info } : {}]}>{ct.commitAvgScore !== null ? ct.commitAvgScore.toFixed(2) : '-'}</Text>
                      <Text style={[styles.trendCell, styles.trendCellNum, ct.challengeAvgScore !== null ? { color: Colors.accent } : {}]}>{ct.challengeAvgScore !== null ? ct.challengeAvgScore.toFixed(2) : '-'}</Text>
                    </View>
                  ))}
                </View>
                {cycleTrend.length >= 2 && (() => {
                  const last = cycleTrend[cycleTrend.length - 1];
                  const prev = cycleTrend[cycleTrend.length - 2];
                  const diff = last.avgScore - prev.avgScore;
                  if (last.avgScore === 0 && prev.avgScore === 0) return null;
                  return (
                    <View style={styles.trendSummary}>
                      <Ionicons name={diff >= 0 ? "arrow-up" : "arrow-down"} size={16} color={diff >= 0 ? Colors.success : Colors.danger} />
                      <Text style={[styles.trendSummaryText, { color: diff >= 0 ? Colors.success : Colors.danger }]}>
                        较上一周期{diff >= 0 ? '上升' : '下降'} {Math.abs(diff).toFixed(2)}
                      </Text>
                    </View>
                  );
                })()}
              </Animated.View>
            )}

            {/* AI 分析 */}
            {selectedCycle && (
              <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.section}>
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
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },
  section: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '40%', backgroundColor: Colors.background, borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  barLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, width: 80 },
  barTrack: { flex: 1, height: 8, backgroundColor: Colors.background, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, width: 44, textAlign: 'right' },
  pieList: { gap: 10 },
  pieItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pieDot: { width: 10, height: 10, borderRadius: 5 },
  pieLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, flex: 1 },
  pieValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text, width: 30, textAlign: 'right' },
  piePct: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, width: 40, textAlign: 'right' },
  compareGrid: { flexDirection: 'row', gap: 12 },
  compareCard: { flex: 1, backgroundColor: Colors.background, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  compareIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  compareTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  compareDetail: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  compareProgress: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.text },
  compareScore: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 8, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + '60' },
  tableCell: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary },
  tableCellName: { flex: 1 },
  tableCellNum: { width: 60, textAlign: 'center', fontFamily: 'Inter_500Medium' },
  trendTable: { borderRadius: 10, overflow: 'hidden' },
  trendHeaderRow: { flexDirection: 'row', backgroundColor: Colors.background, paddingVertical: 8, paddingHorizontal: 4 },
  trendDataRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border + '60' },
  trendCell: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  trendCellName: { flex: 1 },
  trendCellNum: { width: 50, textAlign: 'center' },
  trendSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.background, borderRadius: 10 },
  trendSummaryText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  noDataText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 10 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#8B5CF6', paddingVertical: 14, borderRadius: 12 },
  aiBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.white },
  aiLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  aiLoadingText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#8B5CF6' },
  aiErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.danger + '10', borderRadius: 10, padding: 12 },
  aiErrorText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.danger, flex: 1 },
  aiRetry: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.primary },
  aiResult: { backgroundColor: Colors.background, borderRadius: 12, padding: 16 },
  aiText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text, lineHeight: 22 },
});
