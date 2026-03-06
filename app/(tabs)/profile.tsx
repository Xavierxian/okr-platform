import React, { useMemo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import Animated, { FadeInDown } from 'react-native-reanimated';

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  vp: 'VP',
  center_head: '中心负责人',
  member: '普通员工和部门经理',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { objectives, keyResults, departments } = useOKR();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'super_admin';
  const [unreadCount, setUnreadCount] = useState(0);
  const [dtSyncing, setDtSyncing] = useState(false);
  const [dtEnabled, setDtEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/notifications/unread-count");
        const data = await res.json();
        setUnreadCount(data.count || 0);
      } catch {}
    })();
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/auth/dingtalk-config");
        const data = await res.json();
        setDtEnabled(data.enabled || false);
      } catch {}
    })();
  }, []);

  const userDeptNames = useMemo(() => {
    const deptIds: string[] = (user as any)?.departmentIds || (user?.departmentId ? [user.departmentId] : []);
    if (deptIds.length === 0) return '';
    return deptIds.map(id => departments.find(d => d.id === id)?.name || '未知').join('、');
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

  const handleDtSync = async () => {
    setDtSyncing(true);
    try {
      const res = await apiRequest("POST", "/api/dingtalk/sync-org");
      const data = await res.json();
      const msg = data.message || '同步完成';
      if (Platform.OS === 'web') { window.alert(msg); }
      else { Alert.alert('同步结果', msg); }
    } catch (err: any) {
      const msg = '同步失败';
      if (Platform.OS === 'web') { window.alert(msg); }
      else { Alert.alert('错误', msg); }
    }
    setDtSyncing(false);
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('确定要退出当前账号吗？')) {
        logout();
      }
    } else {
      Alert.alert('退出登录', '确定要退出当前账号吗？', [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: logout },
      ]);
    }
  };

  const topPadding = Platform.OS === 'web' ? 20 : insets.top;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding + 8, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.displayName || '用户').charAt(0)}</Text>
          </View>
          <Text style={styles.userName}>{user?.displayName || '用户'}</Text>
          <Text style={styles.userRole}>{ROLE_LABELS[user?.role || ''] || user?.role}</Text>
          {userDeptNames ? <Text style={styles.userDept}>{userDeptNames}</Text> : null}
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

        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>消息</Text>
          <Pressable onPress={() => router.push('/notifications')} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.8 : 1 }]}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '20' }]}>
              <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.settingText}>消息通知</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </Pressable>
        </Animated.View>

        {isAdmin && (
          <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>管理后台</Text>
            <Pressable onPress={() => router.push('/manage-departments')} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.info + '20' }]}>
                <Ionicons name="business-outline" size={18} color={Colors.info} />
              </View>
              <Text style={styles.settingText}>中心管理</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
            <Pressable onPress={() => router.push('/manage-users')} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.accent + '20' }]}>
                <Ionicons name="people-outline" size={18} color={Colors.accent} />
              </View>
              <Text style={styles.settingText}>用户管理</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
            <Pressable onPress={() => router.push('/manage-cycles')} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.warning + '20' }]}>
                <Ionicons name="calendar-outline" size={18} color={Colors.warning} />
              </View>
              <Text style={styles.settingText}>周期管理</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
            {dtEnabled && (
              <Pressable onPress={handleDtSync} disabled={dtSyncing} style={({ pressed }) => [styles.settingRow, { opacity: dtSyncing ? 0.5 : pressed ? 0.8 : 1 }]}>
                <View style={[styles.settingIcon, { backgroundColor: '#0082EF20' }]}>
                  <Ionicons name="sync-outline" size={18} color="#0082EF" />
                </View>
                <Text style={styles.settingText}>同步钉钉组织架构</Text>
                {dtSyncing ? (
                  <ActivityIndicator size="small" color="#0082EF" />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                )}
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* 只有非钉钉登录用户才显示账号设置（修改密码和退出登录） */}
        {!(user as any)?.dingtalkUserId && (
          <Animated.View entering={FadeInDown.delay(isAdmin ? 400 : 300).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>账号</Text>
            <Pressable onPress={() => router.push('/change-password')} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '20' }]}>
                <Ionicons name="key-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.settingText}>修改密码</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
            <Pressable onPress={handleLogout} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.danger + '20' }]}>
                <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
              </View>
              <Text style={[styles.settingText, { color: Colors.danger }]}>退出登录</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </Pressable>
          </Animated.View>
        )}

        <View style={styles.footerSection}>
          <Text style={styles.version}>OKR 管理平台 v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#171A1D', marginBottom: 20, letterSpacing: -0.3, paddingHorizontal: 4 },
  avatarSection: { alignItems: 'center', marginBottom: 24, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 20, marginHorizontal: 4, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#EBEEF5' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0082EF', alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#0082EF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 32, color: '#FFFFFF' },
  userName: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#171A1D' },
  userRole: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#0082EF', marginTop: 6, backgroundColor: '#E6F4FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  userDept: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#5E6D82', marginTop: 8 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#EBEEF5' },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#171A1D', marginBottom: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: { flex: 1, minWidth: '40%', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#EBEEF5' },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#171A1D' },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#5E6D82', marginTop: 6 },
  assessRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F6F7' },
  assessLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#5E6D82' },
  assessValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#171A1D' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F6F7' },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#171A1D', flex: 1 },
  badge: { backgroundColor: '#FF4D4F', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#FFFFFF' },
  footerSection: { alignItems: 'center', paddingVertical: 24 },
  version: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8F9BB3' },
});
