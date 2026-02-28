import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const canSave = currentPassword.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setError('');
    setSaving(true);
    try {
      const res = await apiRequest("PUT", "/api/auth/change-password", { currentPassword, newPassword });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || '修改失败');
        setSaving(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS === 'web') {
        window.alert('密码修改成功');
      } else {
        Alert.alert('成功', '密码修改成功');
      }
      router.back();
    } catch {
      setError('网络错误，请重试');
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>修改密码</Text>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.form}>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>当前密码</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="请输入当前密码"
            placeholderTextColor={Colors.textTertiary}
            secureTextEntry={!showCurrent}
          />
          <Pressable onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeBtn}>
            <Ionicons name={showCurrent ? "eye-off" : "eye"} size={20} color={Colors.textTertiary} />
          </Pressable>
        </View>

        <Text style={styles.label}>新密码</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="至少6个字符"
            placeholderTextColor={Colors.textTertiary}
            secureTextEntry={!showNew}
          />
          <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
            <Ionicons name={showNew ? "eye-off" : "eye"} size={20} color={Colors.textTertiary} />
          </Pressable>
        </View>

        <Text style={styles.label}>确认新密码</Text>
        <TextInput
          style={styles.inputFull}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="再次输入新密码"
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry
        />
        {confirmPassword.length > 0 && confirmPassword !== newPassword && (
          <Text style={styles.mismatch}>两次输入的密码不一致</Text>
        )}

        <Pressable onPress={handleSave} disabled={!canSave || saving} style={({ pressed }) => [styles.saveBtn, { opacity: (!canSave || saving) ? 0.5 : pressed ? 0.9 : 1 }]}>
          <Ionicons name="checkmark" size={20} color={Colors.white} />
          <Text style={styles.saveBtnText}>{saving ? '保存中...' : '确认修改'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.card },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.text },
  form: { paddingHorizontal: 20, gap: 4 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.textSecondary, marginTop: 16, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundTertiary, borderRadius: 12 },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  inputFull: { backgroundColor: Colors.backgroundTertiary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  eyeBtn: { paddingHorizontal: 12 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.danger + '15', borderRadius: 10, padding: 12 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.danger, flex: 1 },
  mismatch: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.danger, marginTop: 4 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 28 },
  saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
});
