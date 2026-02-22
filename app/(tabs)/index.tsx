import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import Colors from '@/constants/colors';
import { getStatusColor } from '@/lib/storage';
import Animated, { FadeInDown } from 'react-native-reanimated';

function ProgressRing({ progress, size = 80, strokeWidth = 8, color }: { progress: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute' }}>
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: Colors.backgroundTertiary,
        }} />
      </View>
      <View style={{ position: 'absolute' }}>
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: color,
          borderTopColor: progress > 25 ? color : 'transparent',
          borderRightColor: progress > 50 ? color : 'transparent',
          borderBottomColor: progress > 75 ? color : 'transparent',
          borderLeftColor: progress > 0 ? color : 'transparent',
          transform: [{ rotate: '-90deg' }],
        }} />
      </View>
      <Text style={{ fontFamily: 'Inter_700Bold', fontSize: size * 0.22, color: Colors.text }}>
        {Math.round(progress)}%
      </Text>
    </View>
  );
}

function StatCard({ title, value, subtitle, icon, color, delay }: { title: string; value: string | number; subtitle: string; icon: string; color: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { objectives, keyResults, departments, isLoading } = useOKR();

  const stats = useMemo(() => {
    const totalKRs = keyResults.length;
    const completedKRs = keyResults.filter(kr => kr.status === 'completed').length;
    const behindKRs = keyResults.filter(kr => kr.status === 'behind').length;
    const overdueKRs = keyResults.filter(kr => kr.status === 'overdue').length;
    const avgProgress = totalKRs > 0
      ? Math.round(keyResults.reduce((sum, kr) => sum + kr.progress, 0) / totalKRs)
      : 0;
    const atRiskKRs = keyResults.filter(kr => kr.status === 'behind' || kr.status === 'overdue');
    return { totalKRs, completedKRs, behindKRs, overdueKRs, avgProgress, atRiskKRs };
  }, [keyResults]);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding + 16, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>OKR Dashboard</Text>
            <Text style={styles.subtitle}>{objectives.length} objectives, {keyResults.length} key results</Text>
          </View>
          <Pressable onPress={() => router.push('/create-objective')} style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="add" size={24} color={Colors.white} />
          </Pressable>
        </View>

        {objectives.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
            <Ionicons name="flag-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No OKRs yet</Text>
            <Text style={styles.emptyText}>Create your first objective to get started tracking goals</Text>
            <Pressable onPress={() => router.push('/create-objective')} style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name="add" size={20} color={Colors.white} />
              <Text style={styles.emptyBtnText}>Create Objective</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(400)} style={styles.progressSection}>
              <View style={styles.progressCenter}>
                <ProgressRing
                  progress={stats.avgProgress}
                  size={100}
                  strokeWidth={10}
                  color={stats.avgProgress >= 70 ? Colors.success : stats.avgProgress >= 40 ? Colors.warning : Colors.danger}
                />
                <Text style={styles.progressLabel}>Overall Progress</Text>
              </View>
            </Animated.View>

            <View style={styles.statsGrid}>
              <StatCard title="Total KRs" value={stats.totalKRs} subtitle="Key Results" icon="layers" color={Colors.info} delay={100} />
              <StatCard title="Completed" value={stats.completedKRs} subtitle={`${stats.totalKRs > 0 ? Math.round((stats.completedKRs / stats.totalKRs) * 100) : 0}% done`} icon="checkmark-circle" color={Colors.success} delay={200} />
              <StatCard title="Behind" value={stats.behindKRs} subtitle="Need attention" icon="warning" color={Colors.warning} delay={300} />
              <StatCard title="Overdue" value={stats.overdueKRs} subtitle="Past deadline" icon="alert-circle" color={Colors.danger} delay={400} />
            </View>

            {stats.atRiskKRs.length > 0 && (
              <Animated.View entering={FadeInDown.delay(500).duration(400)}>
                <Text style={styles.sectionTitle}>At Risk</Text>
                {stats.atRiskKRs.slice(0, 5).map(kr => {
                  const obj = objectives.find(o => o.id === kr.objectiveId);
                  return (
                    <Pressable
                      key={kr.id}
                      onPress={() => obj && router.push({ pathname: '/objective/[id]', params: { id: obj.id } })}
                      style={({ pressed }) => [styles.riskCard, { opacity: pressed ? 0.9 : 1 }]}
                    >
                      <View style={[styles.riskDot, { backgroundColor: getStatusColor(kr.status) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.riskTitle} numberOfLines={1}>{kr.title}</Text>
                        <Text style={styles.riskSub} numberOfLines={1}>{obj?.title}</Text>
                      </View>
                      <View style={styles.riskProgress}>
                        <Text style={[styles.riskPercent, { color: getStatusColor(kr.status) }]}>{kr.progress}%</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(600).duration(400)}>
              <Text style={styles.sectionTitle}>Recent Objectives</Text>
              {objectives.slice(0, 3).map(obj => {
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
                      <Text style={styles.objDept}>{dept?.name || 'Unknown'}</Text>
                      <Text style={styles.objKRCount}>{objKRs.length} KRs</Text>
                    </View>
                    <View style={styles.objProgressBar}>
                      <View style={[styles.objProgressFill, { width: `${avgProg}%`, backgroundColor: avgProg >= 70 ? Colors.success : avgProg >= 40 ? Colors.warning : Colors.danger }]} />
                    </View>
                    <Text style={styles.objProgressText}>{avgProg}% complete</Text>
                  </Pressable>
                );
              })}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  progressSection: { backgroundColor: Colors.card, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 },
  progressCenter: { alignItems: 'center' },
  progressLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary, marginTop: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: 16, padding: 16 },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text },
  statTitle: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  statSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text, marginBottom: 12 },
  riskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskTitle: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text },
  riskSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  riskProgress: { alignItems: 'flex-end' },
  riskPercent: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  objCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  objHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  objTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text, flex: 1, marginRight: 8 },
  objBadge: { backgroundColor: Colors.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  objBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.primary },
  objMeta: { flexDirection: 'row', gap: 12, marginTop: 8 },
  objDept: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  objKRCount: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary },
  objProgressBar: { height: 4, backgroundColor: Colors.backgroundTertiary, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  objProgressFill: { height: 4, borderRadius: 2 },
  objProgressText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textTertiary, marginTop: 6 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: Colors.text },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.white },
});
