import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
  StatusBar, Dimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { C, R, S } from '@/lib/theme';

const { height: H } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login Failed', error.message);
  }

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── TOP: brand ───────────────────────────────────────────────────── */}
      <View style={st.top}>
        {/* Grid dot pattern decoration */}
        <View style={st.gridDots} />

        <View style={st.logoWrap}>
          <View style={st.logoBg}>
            <Text style={st.logoTxt}>N</Text>
          </View>
        </View>
        <Text style={st.brand}>Nomadller</Text>
        <Text style={st.tagline}>Travel CRM</Text>
      </View>

      {/* ── BOTTOM: sign-in sheet ────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={st.kvWrap}
      >
        <View style={st.sheet}>
          <View style={st.handle} />

          <Text style={st.title}>Welcome back 👋</Text>
          <Text style={st.subtitle}>Sign in to your account</Text>

          {/* Email */}
          <View style={st.field}>
            <Text style={st.fieldLabel}>EMAIL ADDRESS</Text>
            <View style={[st.inputBox, focused === 'email' && st.inputFocused]}>
              <Ionicons name="mail-outline" size={17} color={focused === 'email' ? C.primary : C.textMuted} />
              <TextInput
                style={st.input}
                placeholder="you@nomadller.com"
                placeholderTextColor={C.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </View>

          {/* Password */}
          <View style={st.field}>
            <Text style={st.fieldLabel}>PASSWORD</Text>
            <View style={[st.inputBox, focused === 'pass' && st.inputFocused]}>
              <Ionicons name="lock-closed-outline" size={17} color={focused === 'pass' ? C.primary : C.textMuted} />
              <TextInput
                style={[st.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={C.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                onFocus={() => setFocused('pass')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={17} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign in */}
          <TouchableOpacity
            style={[st.btn, loading && { opacity: 0.65 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.btnTxt}>Sign In</Text>
            }
          </TouchableOpacity>

          <Text style={st.footer}>Nomadller Travel CRM · v1.0</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Top brand section
  top: {
    height: H * 0.38,
    alignItems: 'center', justifyContent: 'center', gap: S.sm,
    overflow: 'hidden',
  },
  gridDots: {
    position: 'absolute',
    inset: 0,
    opacity: 0.04,
    // Simple approximation of grid dots via a large circular glow
    backgroundColor: C.primary,
    borderRadius: 0,
  },

  logoWrap: {
    shadowColor: C.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 22, elevation: 14,
  },
  logoBg: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  logoTxt:  { color: '#fff', fontSize: 32, fontWeight: '900' },
  brand:    { color: C.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  tagline:  { color: C.textMuted, fontSize: 13 },

  // Sheet
  kvWrap: { flex: 1 },
  sheet: {
    flex: 1,
    backgroundColor: C.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: S.xxl, paddingTop: S.xl,
    gap: S.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5, shadowRadius: 22, elevation: 20,
  },
  handle: {
    width: 36, height: 3, borderRadius: 2,
    backgroundColor: C.border, alignSelf: 'center', marginBottom: 4,
  },
  title:    { color: C.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { color: C.textMuted, fontSize: 13, marginTop: -S.sm },

  // Fields
  field:       { gap: 7 },
  fieldLabel:  { color: C.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.surface2, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: S.md, paddingVertical: 13,
  },
  inputFocused: { borderColor: C.primary, backgroundColor: C.primaryLight },
  input:        { flex: 1, color: C.textPrimary, fontSize: 15, backgroundColor: 'transparent' },

  // Button
  btn: {
    backgroundColor: C.primary, borderRadius: R.lg,
    paddingVertical: 16, alignItems: 'center',
    marginTop: S.xs,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  btnTxt:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  footer:  { color: C.textMuted, fontSize: 11, textAlign: 'center' },
});
