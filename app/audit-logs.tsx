import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, buildUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

interface AuditLogItem {
  id: string;
  requestId: string;
  actorUsername: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  success: boolean;
  errorCode: string | null;
  createdAt: string;
}

export default function AuditLogsScreen() {
  const { user } = useAuth();
  if (user?.role !== 'super_admin') return <Redirect href="/" />;
  return <AuditLogsContent />;
}

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [result, setResult] = useState<'all' | 'success' | 'failure'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (action.trim()) params.set('action', action.trim());
      if (resourceType.trim()) params.set('resourceType', resourceType.trim());
      if (result !== 'all') params.set('success', String(result === 'success'));
      const response = await apiRequest('GET', `/api/admin/audit-logs?${params.toString()}`);
      setLogs(await response.json());
    } finally {
      setLoading(false);
    }
  }, [action, resourceType, result]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="返回">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>安全审计</Text>
        <Pressable onPress={() => Linking.openURL(buildUrl('/api/admin/audit-logs/export'))} style={styles.iconButton} accessibilityLabel="导出审计日志">
          <Ionicons name="download-outline" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.filters}>
        <TextInput value={action} onChangeText={setAction} placeholder="操作，例如 auth.login" placeholderTextColor={Colors.textTertiary} style={styles.input} />
        <TextInput value={resourceType} onChangeText={setResourceType} placeholder="资源类型" placeholderTextColor={Colors.textTertiary} style={styles.input} />
        <View style={styles.segmented}>
          {([['all', '全部'], ['success', '成功'], ['failure', '失败']] as const).map(([value, label]) => (
            <Pressable key={value} onPress={() => setResult(value)} style={[styles.segment, result === value && styles.segmentActive]}>
              <Text style={[styles.segmentText, result === value && styles.segmentTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={load}
          refreshing={loading}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>没有匹配的审计记录</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.status, { backgroundColor: item.success ? Colors.success : Colors.danger }]} />
              <View style={styles.rowMain}>
                <Text style={styles.action}>{item.action}</Text>
                <Text style={styles.meta}>{item.actorUsername || '匿名'} · {item.resourceType}{item.resourceId ? ` / ${item.resourceId}` : ''}</Text>
                <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()} · {item.ipAddress || '未知IP'}</Text>
              </View>
              {!item.success && <Text style={styles.error}>{item.errorCode || '失败'}</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { height: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.card },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.text },
  filters: { padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  input: { height: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, color: Colors.text, fontFamily: 'Inter_400Regular', fontSize: 14 },
  segmented: { height: 38, flexDirection: 'row', borderWidth: 1, borderColor: Colors.border },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: Colors.primary },
  segmentText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary },
  segmentTextActive: { color: Colors.white },
  list: { paddingBottom: 32 },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'stretch', backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  status: { width: 4 },
  rowMain: { flex: 1, padding: 12, gap: 3 },
  action: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.text },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary },
  error: { alignSelf: 'center', marginRight: 12, fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.danger },
  center: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: 'Inter_400Regular', color: Colors.textTertiary },
});

