import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Linking } from 'react-native';

const REQUIRED_HEADERS = ['目标名称', '所属部门'];

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string): { rows: Record<string, string>[]; error: string | null } {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { rows: [], error: '文件为空或只有表头' };
  const headers = parseCSVLine(lines[0]);
  const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    return { rows: [], error: `缺少必要列: ${missing.join(', ')}。请使用模板文件。` };
  }
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return { rows, error: null };
}

export default function ImportOKRScreen() {
  const { refresh } = useOKR();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ message: string; errors: string[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleDownloadTemplate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = new URL('/api/import/template', getApiUrl()).toString();
    if (Platform.OS === 'web') {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'okr_import_template.csv';
      link.click();
    } else {
      await Linking.openURL(url);
    }
  }, []);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setFileName(file.name);

      let content = '';
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        content = await response.text();
      } else {
        content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      }

      const { rows, error } = parseCSV(content);
      setParsedRows(rows);
      setParseError(error);
      setResult(null);
    } catch (err) {
      Alert.alert('错误', '文件读取失败');
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("POST", "/api/import/okr", { rows: parsedRows });
      const data = await res.json();
      setResult({ message: data.message, errors: data.errors || [] });
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const msg = err?.message || '导入失败';
      setResult({ message: msg, errors: [] });
    }
    setImporting(false);
  }, [parsedRows, refresh]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>导入 OKR</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.stepCard}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>下载模板</Text>
            <Text style={styles.stepDesc}>下载 CSV 模板，按照格式填写 OKR 数据</Text>
            <Pressable onPress={handleDownloadTemplate} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name="download-outline" size={18} color={Colors.primary} />
              <Text style={styles.actionBtnText}>下载模板文件</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>选择文件</Text>
            <Text style={styles.stepDesc}>选择填写好的 CSV 文件上传</Text>
            <Pressable onPress={handlePickFile} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name="document-outline" size={18} color={Colors.primary} />
              <Text style={styles.actionBtnText}>{fileName || '选择 CSV 文件'}</Text>
            </Pressable>
            {parseError && (
              <View style={styles.parseErrorRow}>
                <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                <Text style={styles.parseErrorText}>{parseError}</Text>
              </View>
            )}
            {parsedRows.length > 0 && !parseError && (
              <Text style={styles.fileInfo}>已解析 {parsedRows.length} 行数据</Text>
            )}
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>确认导入</Text>
            <Text style={styles.stepDesc}>相同目标名称+部门+周期会合并为一个目标，执行人用户名会自动关联系统用户</Text>
          </View>
        </View>

        {parsedRows.length > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>数据预览</Text>
            {parsedRows.slice(0, 5).map((row, idx) => (
              <View key={idx} style={styles.previewRow}>
                <Text style={styles.previewObj} numberOfLines={1}>O: {row['目标名称'] || '-'}</Text>
                <Text style={styles.previewKR} numberOfLines={1}>KR: {row['KR名称'] || '-'}</Text>
                <Text style={styles.previewMeta}>{row['所属部门'] || '-'} · {row['执行人用户名'] || '未指定'}</Text>
              </View>
            ))}
            {parsedRows.length > 5 && <Text style={styles.moreText}>还有 {parsedRows.length - 5} 行...</Text>}
          </View>
        )}

        <Pressable
          onPress={handleImport}
          disabled={parsedRows.length === 0 || importing}
          style={({ pressed }) => [
            styles.importBtn,
            { opacity: (parsedRows.length === 0 || importing) ? 0.5 : pressed ? 0.9 : 1 }
          ]}
        >
          {importing ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color={Colors.white} />
              <Text style={styles.importBtnText}>开始导入</Text>
            </>
          )}
        </Pressable>

        {result && (
          <View style={[styles.resultCard, { borderColor: result.errors.length > 0 ? Colors.warning : Colors.success }]}>
            <Text style={[styles.resultMsg, { color: result.errors.length > 0 ? Colors.warning : Colors.success }]}>{result.message}</Text>
            {result.errors.map((err, idx) => (
              <View key={idx} style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                <Text style={styles.errorText}>{err}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>模板说明</Text>
          <Text style={styles.tipsItem}>• 目标名称、所属部门为必填项</Text>
          <Text style={styles.tipsItem}>• 同名目标+同部门+同周期会自动合并</Text>
          <Text style={styles.tipsItem}>• 执行人用户名需与系统用户名一致</Text>
          <Text style={styles.tipsItem}>• 是否跨部门协同填"是"或"否"</Text>
          <Text style={styles.tipsItem}>• 日期格式: YYYY-MM-DD</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  stepCard: { flexDirection: 'row', gap: 14, backgroundColor: Colors.backgroundTertiary, borderRadius: 14, padding: 16, marginBottom: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.white },
  stepTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  stepDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginTop: 10, alignSelf: 'flex-start' },
  actionBtnText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.primary },
  fileInfo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.success, marginTop: 6 },
  parseErrorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  parseErrorText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.danger, flex: 1 },
  previewCard: { backgroundColor: Colors.backgroundTertiary, borderRadius: 14, padding: 16, marginBottom: 12 },
  previewTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.text, marginBottom: 10 },
  previewRow: { borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: 8 },
  previewObj: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.text },
  previewKR: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  previewMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  moreText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 8 },
  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginBottom: 16 },
  importBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
  resultCard: { backgroundColor: Colors.backgroundTertiary, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  resultMsg: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 8 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.danger, flex: 1 },
  tipsCard: { backgroundColor: Colors.backgroundTertiary, borderRadius: 14, padding: 16 },
  tipsTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.text, marginBottom: 8 },
  tipsItem: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 20 },
});
