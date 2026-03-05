import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView, Image, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { buildUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

export default function UpdateProgressScreen() {
  const { krId } = useLocalSearchParams<{ krId: string }>();
  const { keyResults, reportProgress } = useOKR();
  const kr = useMemo(() => keyResults.find(k => k.id === krId), [keyResults, krId]);

  const [progress, setProgress] = useState(kr?.progress?.toString() || '0');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const uploadingRef = useRef(false);

  const progressNum = Math.min(100, Math.max(0, parseInt(progress) || 0));

  const uploadImageFromUri = async (uri: string, mimeType?: string) => {
    setUploading(true);
    try {
      const { fetch: expoFetch } = await import('expo/fetch');
      const { File } = await import('expo-file-system');
      const file = new File(uri);
      const formData = new FormData();
      formData.append('file', file as any);

      const uploadUrl = buildUrl('/api/upload/image');
      const resp = await expoFetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType || 'image/jpeg' },
        body: file,
        credentials: 'include',
      });
      const data = await resp.json();
      if (data.url) {
        setImages(prev => [...prev, data.url]);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploading(false);
  };

  const uploadImageFromBlob = useCallback(async (blob: Blob) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    try {
      // 使用当前页面 origin 作为 base URL
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const uploadUrl = `${baseUrl}/api/upload/image`;
      console.log('Uploading to:', uploadUrl);
      const resp = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/png' },
        body: blob,
        credentials: 'include',
      });
      console.log('Upload response:', resp.status);
      const data = await resp.json();
      console.log('Upload data:', data);
      if (data.url) {
        setImages(prev => [...prev, data.url]);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    uploadingRef.current = false;
    setUploading(false);
  }, []);

  const pasteListenerRef = useRef<((e: ClipboardEvent) => void) | null>(null);

  const setTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (Platform.OS !== 'web') return;
    if (textareaRef.current && pasteListenerRef.current) {
      textareaRef.current.removeEventListener('paste', pasteListenerRef.current);
    }
    textareaRef.current = el;
    if (el) {
      const handler = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const blob = items[i].getAsFile();
            if (blob) {
              uploadImageFromBlob(blob);
            }
            return;
          }
        }
      };
      pasteListenerRef.current = handler;
      el.addEventListener('paste', handler);
    }
  }, [uploadImageFromBlob]);

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (!result.canceled && result.assets) {
      for (const asset of result.assets) {
        await uploadImageFromUri(asset.uri, asset.mimeType);
      }
    }
  };

  const handleWebFileChange = async (e: any) => {
    const files = e.target?.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadImageFromBlob(files[i]);
    }
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (saving || !krId) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await reportProgress(krId, progressNum, note.trim(), images.length > 0 ? images : undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (!kr) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>关键结果未找到</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>更新进度</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.krName} numberOfLines={2}>{kr.title}</Text>

        <Text style={styles.label}>进度 (%)</Text>
        <View style={styles.progressRow}>
          <Pressable
            onPress={() => setProgress(String(Math.max(0, progressNum - 10)))}
            style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="remove" size={20} color={Colors.text} />
          </Pressable>
          <TextInput
            style={styles.progressInput}
            value={progress}
            onChangeText={setProgress}
            keyboardType="numeric"
            maxLength={3}
          />
          <Pressable
            onPress={() => setProgress(String(Math.min(100, progressNum + 10)))}
            style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="add" size={20} color={Colors.text} />
          </Pressable>
        </View>

        <View style={styles.progressBarWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${progressNum}%`,
              backgroundColor: progressNum >= 70 ? Colors.success : progressNum >= 40 ? Colors.warning : Colors.danger,
            }]} />
          </View>
          <Text style={styles.progressPercent}>{progressNum}%</Text>
        </View>

        <Text style={styles.label}>执行说明</Text>
        <View onStartShouldSetResponder={() => false}>
          {Platform.OS === 'web' ? (
            <textarea
              ref={setTextareaRef as any}
              value={note}
              onChange={(e: any) => setNote(e.target.value)}
              placeholder="已完成工作、遇到的问题、下一步计划...（可粘贴截图）"
              style={{
                backgroundColor: '#F1F5F9',
                borderRadius: 12,
                padding: 16,
                fontSize: 15,
                fontFamily: 'Inter, sans-serif',
                color: '#1E293B',
                border: 'none',
                outline: 'none',
                minHeight: 80,
                resize: 'vertical' as any,
                width: '100%',
                boxSizing: 'border-box' as any,
              }}
            />
          ) : (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={note}
              onChangeText={setNote}
              placeholder="已完成工作、遇到的问题、下一步计划..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          )}
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>附件截图</Text>
        <View style={styles.imageSection}>
          {images.map((uri, idx) => (
            <View key={idx} style={styles.imageThumb}>
              <Image source={{ uri }} style={styles.thumbImg} />
              <Pressable onPress={() => removeImage(idx)} style={styles.removeImgBtn}>
                <Ionicons name="close-circle" size={20} color={Colors.danger} />
              </Pressable>
            </View>
          ))}
          {uploading && (
            <View style={styles.imageThumb}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}
          <Pressable onPress={pickImage} style={({ pressed }) => [styles.addImageBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="image-outline" size={24} color={Colors.primary} />
            <Text style={styles.addImageText}>添加图片</Text>
          </Pressable>
        </View>
        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef as any}
            type="file"
            accept="image/*"
            multiple
            onChange={handleWebFileChange}
            style={{ display: 'none' }}
          />
        )}
        <Text style={styles.hint}>支持从相册选择图片{Platform.OS === 'web' ? '，或直接在说明框中粘贴截图' : ''}</Text>

        <Pressable
          onPress={handleSave}
          disabled={saving || uploading}
          style={({ pressed }) => [
            styles.saveBtn,
            { opacity: (saving || uploading) ? 0.5 : pressed ? 0.9 : 1 }
          ]}
        >
          <Ionicons name="checkmark" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存进度'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EBEEF5' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#171A1D' },
  form: { paddingHorizontal: 16, paddingBottom: 40 },
  krName: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#5E6D82', marginBottom: 8 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#5E6D82', marginTop: 16, marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EBEEF5' },
  progressInput: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 24, fontFamily: 'Inter_700Bold', color: '#171A1D', textAlign: 'center', borderWidth: 1, borderColor: '#EBEEF5' },
  progressBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  progressBar: { flex: 1, height: 6, backgroundColor: '#E8EAEF', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressPercent: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#171A1D', width: 40, textAlign: 'right' },
  input: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#171A1D', borderWidth: 1, borderColor: '#EBEEF5' },
  textArea: { minHeight: 80 },
  imageSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageThumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#E8EAEF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: 80, height: 80, borderRadius: 10 },
  removeImgBtn: { position: 'absolute', top: -2, right: -2 },
  addImageBtn: { width: 80, height: 80, borderRadius: 10, borderWidth: 1.5, borderColor: '#0082EF40', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#FFFFFF' },
  addImageText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#0082EF' },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8F9BB3', marginTop: 6 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0082EF', paddingVertical: 16, borderRadius: 12, marginTop: 24, shadowColor: '#0082EF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#5E6D82' },
});
