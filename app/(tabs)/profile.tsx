import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';
import Animated, { FadeInDown } from 'react-native-reanimated';

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  dept_admin: '部门管理员',
  member: '普通成员',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { objectives, keyResults, departments } = useOKR();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'super_admin';

  const userDept = useMemo(() => {
    if (!user?.departmentId) return null;
    return departments.find(d => d.id === user.departmentId);
  }, [user, departments]);

  const personalStats = useMemo(() => {
    const totalKR = keyResults.length;
    const completed = keyResults.filter(kr => kr.status === 'completed').length;
    const avgProgress = totalKR > 0
      ? Math.round(keyResults.reduce((s, kr) => s + kr.progress, 0) / totalKR)
      : 0;
    const scored = keyResults.filter(kr => kr.selfScore !== null);
    const avgScore = scored.length > 0
      ? (scored.reduce((s, kr) => s + (kr.selfScore || 0), 0) / scored.length).toFixed(2)
      : '暂无';
    return { totalKR, completed, avgProgress, avgScore, scored: scored.length };
  }, [keyResults]);

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: logout },
    ]);
  };

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding + 16, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>我的</Text>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.userName}>{user?.displayName || '用户'}</Text>
          <Text style={styles.userRole}>{ROLE_LABELS[user?.role || ''] || user?.role}</Text>
          {userDept && <Text style={styles.userDept}>{userDept.name}</Text>}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>我的统计</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{objectives.length}</Text>
              <Text style={styles.statLabel}>目标数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{personalStats.totalKR}</Text>
              <Text style={styles.statLabel}>关键结果</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.success }]}>{personalStats.completed}</Text>
              <Text style={styles.statLabel}>已完成</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.primary }]}>{personalStats.avgProgress}%</Text>
              <Text style={styles.statLabel}>平均进度</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>自评情况</Text>
          <View style={styles.assessRow}>
            <Text style={styles.assessLabel}>已评分 KR</Text>
            <Text style={styles.assessValue}>{personalStats.scored} / {personalStats.totalKR}</Text>
          </View>
          <View style={styles.assessRow}>
            <Text style={styles.assessLabel}>平均分</Text>
            <Text style={[styles.assessValue, { color: Colors.primary }]}>{personalStats.avgScore}</Text>
          </View>
        </Animated.View>

        {isAdmin && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>管理后台</Text>
            <Pressable onPress={() => router.push('/manage-departments')} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.info + '20' }]}>
                <Ionicons name="business-outline" size={18} color={Colors.info} />
              </View>
              <Text style={styles.settingText}>部门管理</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
            <Pressable onPress={() => router.push('/manage-users')} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.accent + '20' }]}>
                <Ionicons name="people-outline" size={18} color={Colors.accent} />
              </View>
              <Text style={styles.settingText}>用户管理</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(isAdmin ? 400 : 300).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>账号</Text>
          <Pressable onPress={handleLogout} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.8 : 1 }]}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.danger + '20' }]}>
              <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            </View>
            <Text style={[styles.settingText, { color: Colors.danger }]}>退出登录</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </Pressable>
        </Animated.View>

        <View style={styles.footerSection}>
          <Text style={styles.version}>OKR 管理平台 v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 28, color: Colors.text, marginBottom: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  userName: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: Colors.text },
  userRole: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  userDept: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.primary, marginTop: 4 },
  section: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.text, marginBottom: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: { flex: 1, minWidth: '40%', backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  assessRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  assessLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary },
  assessValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.text },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  settingIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.text, flex: 1 },
  footerSection: { alignItems: 'center', paddingVertical: 20 },
  version: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary },
});
