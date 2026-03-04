import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Alert, Platform, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

const COLUMNS = ['部门', '目标名称', 'KR名称', '执行人', '周期', 'OKR类型', '关联上级', '权重'];

function WebFileInput({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  if (Platform.OS !== 'web') return null;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => {
    if (inputRef.current) inputRef.current.click();
  };

  const handleChange = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    onFileSelected(file);
    e.target.value = '';
  };

  return (
    <View>
      <input
        ref={inputRef as any}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <Pressable onPress={handleClick} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="document-outline" size={18} color={Colors.primary} />
        <Text style={styles.actionBtnText}>选择 Excel 文件</Text>
      </Pressable>
    </View>
  );
}

function emptyRow(): Record<string, string> {
  return COLUMNS.reduce((acc, col) => { acc[col] = ''; return acc; }, {} as Record<string, string>);
}

export default function ImportOKRScreen() {
  const { refresh } = useOKR();
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ message: string; errors: string[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const handleDownloadTemplate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await apiRequest("GET", "/api/import/template");
      const blob = await res.blob();
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'okr_import_template.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const { Linking } = await import('react-native');
        const url = new URL('/api/import/template', getApiUrl()).toString();
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert('错误', '下载模板失败');
    }
  }, []);

  const uploadExcelFile = useCallback(async (file: File | { uri: string; name: string }) => {
    setUploading(true);
    setParseError(null);
    setResult(null);
    try {
      let response: Response;
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        const baseUrl = getApiUrl();
        response = await fetch(new URL('/api/import/parse-excel', baseUrl).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          credentials: 'include',
          body: arrayBuffer,
        });
      } else {
        const FileSystem = await import('expo-file-system');
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const baseUrl = getApiUrl();
        response = await fetch(new URL('/api/import/parse-excel', baseUrl).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          credentials: 'include',
          body: bytes.buffer,
        });
      }
      const data = await response.json();
      if (!response.ok) {
        setParseError(data.message || '解析失败');
        return;
      }
      if (data.rows && data.rows.length > 0) {
        setParsedRows(data.rows);
        setEditMode(true);
      } else {
        setParseError('文件中没有有效数据');
      }
    } catch (err: any) {
      setParseError(err?.message || '文件上传解析失败');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleWebFileSelected = useCallback((file: File) => {
    setFileName(file.name);
    uploadExcelFile(file);
  }, [uploadExcelFile]);

  const handlePickFileNative = useCallback(async () => {
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      setFileName(file.name);
      uploadExcelFile({ uri: file.uri, name: file.name });
    } catch {
      Alert.alert('错误', '选择文件失败');
    }
  }, [uploadExcelFile]);

  const handleAddRow = useCallback(() => {
    setParsedRows(prev => [...prev, emptyRow()]);
    if (!editMode) setEditMode(true);
  }, [editMode]);

  const handleDeleteRow = useCallback((index: number) => {
    setParsedRows(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleCellChange = useCallback((rowIdx: number, col: string, value: string) => {
    setParsedRows(prev => {
      const newRows = [...prev];
      newRows[rowIdx] = { ...newRows[rowIdx], [col]: value };
      return newRows;
    });
  }, []);

  const handleImport = useCallback(async () => {
    const validRows = parsedRows.filter(r => r['目标名称']?.trim());
    if (validRows.length === 0) {
      Alert.alert('提示', '没有有效数据（目标名称不能为空）');
      return;
    }
    setImporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiRequest("POST", "/api/import/okr", { rows: validRows });
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

  const handleManualEntry = useCallback(() => {
    setParsedRows([emptyRow(), emptyRow(), emptyRow()]);
    setEditMode(true);
    setFileName('');
    setParseError(null);
    setResult(null);
  }, []);


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>批量导入 OKR</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.methodSection}>
          <Text style={styles.sectionTitle}>选择导入方式</Text>
          <View style={styles.methodRow}>
            <Pressable onPress={handleDownloadTemplate} style={({ pressed }) => [styles.methodCard, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.methodIcon, { backgroundColor: Colors.primary + '15' }]}>
                <Ionicons name="download-outline" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.methodTitle}>下载模板</Text>
              <Text style={styles.methodDesc}>下载Excel模板填写后上传</Text>
            </Pressable>
            <Pressable onPress={handleManualEntry} style={({ pressed }) => [styles.methodCard, { opacity: pressed ? 0.8 : 1 }]}>
              <View style={[styles.methodIcon, { backgroundColor: Colors.success + '15' }]}>
                <Ionicons name="create-outline" size={22} color={Colors.success} />
              </View>
              <Text style={styles.methodTitle}>在线填写</Text>
              <Text style={styles.methodDesc}>直接在表格中录入数据</Text>
            </Pressable>
          </View>
        </View>

        {!editMode && (
          <View style={styles.uploadSection}>
            <Text style={styles.sectionTitle}>上传文件</Text>
            <View style={styles.uploadCard}>
              {uploading ? (
                <>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.uploadHint}>正在解析文件...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={36} color={Colors.textTertiary} />
                  <Text style={styles.uploadHint}>选择填好的 Excel 文件（.xlsx）</Text>
                  {Platform.OS === 'web' ? (
                    <WebFileInput onFileSelected={handleWebFileSelected} />
                  ) : (
                    <Pressable onPress={handlePickFileNative} style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}>
                      <Ionicons name="document-outline" size={18} color={Colors.primary} />
                      <Text style={styles.actionBtnText}>{fileName || '选择 Excel 文件'}</Text>
                    </Pressable>
                  )}
                </>
              )}
              {fileName ? <Text style={styles.fileInfo}>已选择: {fileName}</Text> : null}
              {parseError && (
                <View style={styles.parseErrorRow}>
                  <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                  <Text style={styles.parseErrorText}>{parseError}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {editMode && parsedRows.length > 0 && (
          <View style={styles.tableSection}>
            <View style={styles.tableTitleRow}>
              <Text style={styles.sectionTitle}>数据编辑 ({parsedRows.length} 行)</Text>
              <Pressable onPress={handleAddRow} style={({ pressed }) => [styles.addRowBtn, { opacity: pressed ? 0.8 : 1 }]}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.addRowText}>添加行</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
              <View>
                <View style={styles.tableHeaderRow}>
                  <View style={styles.rowNumCell}><Text style={styles.headerCellText}>#</Text></View>
                  {COLUMNS.map(col => (
                    <View key={col} style={[styles.headerCell, col === '目标名称' || col === 'KR名称' ? styles.wideCell : styles.normalCell]}>
                      <Text style={styles.headerCellText} numberOfLines={1}>{col}</Text>
                    </View>
                  ))}
                  <View style={styles.actionCell}><Text style={styles.headerCellText}>操作</Text></View>
                </View>
                {parsedRows.map((row, rowIdx) => (
                  <View key={rowIdx} style={[styles.tableRow, rowIdx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                    <View style={styles.rowNumCell}><Text style={styles.rowNumText}>{rowIdx + 1}</Text></View>
                    {COLUMNS.map(col => (
                      <View key={col} style={[styles.dataCell, col === '目标名称' || col === 'KR名称' ? styles.wideCell : styles.normalCell]}>
                        {col === 'OKR类型' ? (
                          <Pressable
                            onPress={() => handleCellChange(rowIdx, col, row[col] === '挑战型' ? '承诺型' : '挑战型')}
                            style={[styles.typeBadge, { backgroundColor: row[col] === '挑战型' ? Colors.warning + '20' : Colors.primary + '15' }]}
                          >
                            <Text style={[styles.typeBadgeText, { color: row[col] === '挑战型' ? Colors.warning : Colors.primary }]}>
                              {row[col] || '承诺型'}
                            </Text>
                          </Pressable>
                        ) : col === '关联上级' ? (
                          <Pressable
                            onPress={() => handleCellChange(rowIdx, col, row[col] === '是' ? '否' : '是')}
                            style={[styles.typeBadge, { backgroundColor: row[col] === '是' ? Colors.success + '20' : Colors.backgroundTertiary }]}
                          >
                            <Text style={[styles.typeBadgeText, { color: row[col] === '是' ? Colors.success : Colors.textTertiary }]}>
                              {row[col] || '否'}
                            </Text>
                          </Pressable>
                        ) : (
                          <TextInput
                            style={styles.cellInput}
                            value={row[col] || ''}
                            onChangeText={(v) => handleCellChange(rowIdx, col, v)}
                            placeholder={col === '权重' ? '1' : ''}
                            placeholderTextColor={Colors.textTertiary}
                          />
                        )}
                      </View>
                    ))}
                    <View style={styles.actionCell}>
                      <Pressable onPress={() => handleDeleteRow(rowIdx)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {(editMode && parsedRows.length > 0) && (
          <Pressable
            onPress={handleImport}
            disabled={importing}
            style={({ pressed }) => [
              styles.importBtn,
              { opacity: importing ? 0.5 : pressed ? 0.9 : 1 }
            ]}
          >
            {importing ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color={Colors.white} />
                <Text style={styles.importBtnText}>确认导入 ({parsedRows.filter(r => r['目标名称']?.trim()).length} 条)</Text>
              </>
            )}
          </Pressable>
        )}

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
          <Text style={styles.tipsTitle}>填写说明</Text>
          <Text style={styles.tipsItem}>• <Text style={styles.tipsBold}>目标名称</Text>（必填）：同名目标+同部门+同周期会自动合并</Text>
          <Text style={styles.tipsItem}>• <Text style={styles.tipsBold}>OKR类型</Text>：承诺型（默认）或 挑战型</Text>
          <Text style={styles.tipsItem}>• <Text style={styles.tipsBold}>关联上级</Text>：是 或 否（默认）</Text>
          <Text style={styles.tipsItem}>• <Text style={styles.tipsBold}>执行人</Text>：填写系统用户的姓名或用户名</Text>
          <Text style={styles.tipsItem}>• <Text style={styles.tipsBold}>权重</Text>：默认为1，可调整KR权重</Text>
          <Text style={styles.tipsItem}>• <Text style={styles.tipsBold}>周期/部门</Text>：留空则使用当前周期和您所在部门</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text, marginBottom: 10 },
  methodSection: { marginBottom: 16 },
  methodRow: { flexDirection: 'row', gap: 10 },
  methodCard: { flex: 1, backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 },
  methodIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text },
  methodDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  uploadSection: { marginBottom: 16 },
  uploadCard: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  uploadHint: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginTop: 4 },
  actionBtnText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.primary },
  fileInfo: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.success, marginTop: 4 },
  parseErrorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  parseErrorText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.danger, flex: 1 },
  tableSection: { marginBottom: 16 },
  tableTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.primary + '10', borderRadius: 6 },
  addRowText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.primary },
  tableScroll: { borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: Colors.primary + '10' },
  headerCell: { paddingHorizontal: 8, paddingVertical: 10, borderRightWidth: 1, borderRightColor: Colors.border },
  headerCellText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.primary },
  wideCell: { width: 140 },
  normalCell: { width: 80 },
  rowNumCell: { width: 32, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: Colors.border },
  rowNumText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textTertiary },
  actionCell: { width: 40, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border },
  tableRowEven: { backgroundColor: Colors.card },
  tableRowOdd: { backgroundColor: Colors.backgroundTertiary },
  dataCell: { paddingHorizontal: 4, paddingVertical: 4, borderRightWidth: 1, borderRightColor: Colors.border, justifyContent: 'center' },
  cellInput: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.text, paddingHorizontal: 4, paddingVertical: 4, minHeight: 28 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignItems: 'center' },
  typeBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, marginBottom: 16 },
  importBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.white },
  resultCard: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  resultMsg: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 8 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.danger, flex: 1 },
  tipsCard: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, padding: 16 },
  tipsTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.text, marginBottom: 8 },
  tipsItem: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 20, marginBottom: 2 },
  tipsBold: { fontFamily: 'Inter_500Medium', color: Colors.text },
});
