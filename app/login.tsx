import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

function isDingtalkBrowser(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return /DingTalk/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

function loadDingtalkJSAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).dd?.runtime?.permission?.requestAuthCode) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="dingtalk"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      if ((window as any).dd) { resolve(); return; }
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://g.alicdn.com/dingding/dingtalk-jsapi/3.0.25/dingtalk.open.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load DingTalk JSAPI'));
    document.head.appendChild(script);
  });
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, dingtalkLogin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dtEnabled, setDtEnabled] = useState(false);
  const [dtLoading, setDtLoading] = useState(false);
  const [dtConfig, setDtConfig] = useState<{ corpId: string; appKey: string } | null>(null);
  const dtAttemptedRef = useRef(false);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const inDingtalk = isDingtalkBrowser();

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('dt_error') === '1') {
          setError('钉钉登录失败，请使用账号密码登录');
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch {}
    }
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/auth/dingtalk-config");
        const data = await res.json();
        if (data.enabled) {
          setDtEnabled(true);
          setDtConfig({ corpId: data.corpId, appKey: data.appKey });
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!inDingtalk || !dtConfig || dtAttemptedRef.current) return;
    dtAttemptedRef.current = true;
    handleDingtalkAutoLogin();
  }, [dtConfig, inDingtalk]);

  const handleDingtalkAutoLogin = async () => {
    if (!dtConfig) return;
    setDtLoading(true);
    setError('');
    try {
      await loadDingtalkJSAPI();
      const dd = (window as any).dd;
      if (!dd?.runtime?.permission?.requestAuthCode) {
        const redirectUri = encodeURIComponent(window.location.origin + '/api/auth/dingtalk-callback');
        const url = `https://login.dingtalk.com/oauth2/auth?response_type=code&client_id=${dtConfig.appKey}&redirect_uri=${redirectUri}&scope=openid&prompt=consent`;
        window.location.href = url;
        return;
      }
      dd.runtime.permission.requestAuthCode({
        corpId: dtConfig.corpId,
        onSuccess: async (result: { code: string }) => {
          try {
            const loginResult = await dingtalkLogin(result.code);
            if (!loginResult.success) {
              setError(loginResult.message || '钉钉登录失败');
            }
          } catch (e: any) {
            setError(e?.message || '钉钉登录失败');
          }
          setDtLoading(false);
        },
        onFail: (err: any) => {
          console.error('DingTalk auth failed:', err);
          setError('钉钉授权失败，请使用账号密码登录');
          setDtLoading(false);
        },
      });
    } catch (err) {
      const redirectUri = encodeURIComponent(window.location.origin + '/api/auth/dingtalk-callback');
      const url = `https://login.dingtalk.com/oauth2/auth?response_type=code&client_id=${dtConfig.appKey}&redirect_uri=${redirectUri}&scope=openid&prompt=consent`;
      window.location.href = url;
    }
  };

  const handleDingtalkWebLogin = () => {
    if (!dtConfig) return;
    const redirectUri = encodeURIComponent(window.location.origin + '/api/auth/dingtalk-callback');
    const url = `https://login.dingtalk.com/oauth2/auth?response_type=code&client_id=${dtConfig.appKey}&redirect_uri=${redirectUri}&scope=openid&prompt=consent`;
    window.location.href = url;
  };

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

  if (dtLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.appDesc, { marginTop: 16 }]}>正在通过钉钉登录...</Text>
      </View>
    );
  }

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

          {dtEnabled && Platform.OS === 'web' && !inDingtalk && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>或</Text>
                <View style={styles.dividerLine} />
              </View>
              <Pressable
                onPress={handleDingtalkWebLogin}
                style={({ pressed }) => [styles.dtBtn, { opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name="chatbubbles-outline" size={20} color="#0082EF" />
                <Text style={styles.dtBtnText}>钉钉扫码登录</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'flex-start' },
  logoWrap: { alignItems: 'center', marginBottom: 48 },
  logoCircle: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#E6F4FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#0082EF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  appName: { fontFamily: 'Inter_700Bold', fontSize: 26, color: '#171A1D', letterSpacing: -0.5 },
  appDesc: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#5E6D82', marginTop: 6 },
  form: { gap: 14 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF2F0', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#FF4D4F' },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#FF4D4F', flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#EBEEF5', shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  inputIcon: { paddingLeft: 14 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 16, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#171A1D' },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 16 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0082EF', paddingVertical: 16, borderRadius: 12, marginTop: 8, shadowColor: '#0082EF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  loginBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#FFFFFF' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EBEEF5' },
  dividerText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8F9BB3' },
  dtBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E6F4FF', paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: '#0082EF30' },
  dtBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#0082EF' },
});
