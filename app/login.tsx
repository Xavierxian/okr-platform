import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setError('');
    setLoading(true);
    const result = await login(username.trim(), password);
    if (!result.success) {
      setError(result.message || '登录失败');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { paddingTop: topPadding + 60 }]}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="flag" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>OKR 管理平台</Text>
          <Text style={styles.appDesc}>目标与关键结果管理系统</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="用户名"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              testID="login-username"
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="密码"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry={!showPassword}
              testID="login-password"
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textTertiary} />
            </Pressable>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [styles.loginBtn, { opacity: loading ? 0.6 : pressed ? 0.9 : 1 }]}
            testID="login-submit"
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color={Colors.white} />
                <Text style={styles.loginBtnText}>登 录</Text>
              </>
            )}
          </Pressable>

        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'flex-start' },
  logoWrap: { alignItems: 'center', marginBottom: 48 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  appName: { fontFamily: 'Inter_700Bold', fontSize: 26, color: Colors.text },
  appDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, marginTop: 6 },
  form: { gap: 14 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.danger + '15', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.danger, flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 16, fontSize: 15, fontFamily: 'Inter_400Regular', color: Colors.text },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 16 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, marginTop: 8 },
  loginBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.white },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textTertiary, textAlign: 'center', marginTop: 8 },
});
