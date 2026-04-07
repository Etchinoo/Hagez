// ============================================================
// SUPER RESERVATION PLATFORM — OTP Login Screen
// Phone → OTP flow. Arabic RTL. Cairo font.
// ============================================================

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';

type Step = 'phone' | 'otp';

export default function LoginScreen() {
  const router = useRouter();
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp);
  const loginWithSocial = useAuthStore((s) => s.loginWithSocial);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRef = useRef<TextInput>(null);

  const handleRequestOtp = async () => {
    if (!phone.match(/^\+20\d{10}$/)) {
      setError('أدخل رقم هاتف مصري صحيح (+20XXXXXXXXXX)');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authApi.requestOtp(phone);
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch {
      setError('فشل الإرسال. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token');
      await loginWithSocial('apple', credential.identityToken);
      router.replace('/(tabs)');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError('فشل تسجيل الدخول بـ Apple. حاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 4) {
      setError('أدخل الكود المكون من 4 أرقام');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await loginWithOtp(phone, otp);
      router.replace('/(tabs)');
    } catch {
      setError('الكود غير صحيح أو منتهي الصلاحية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        {/* Logo placeholder */}
        <View style={styles.logoPlaceholder} />
        <Text style={styles.title}>اتحجز في ثوانٍ</Text>
        <Text style={styles.subtitle}>مطاعم، صالونات وأكثر في تطبيق واحد</Text>
      </View>

      <View style={styles.form}>
        {step === 'phone' ? (
          <>
            <Text style={styles.label}>رقم الهاتف</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+201XXXXXXXXX"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoFocus
              textAlign="right"
              writingDirection="rtl"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={handleRequestOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>إرسال الكود</Text>}
            </TouchableOpacity>

            {/* US-067: Apple Sign-In — iOS only, required by App Store */}
            {Platform.OS === 'ios' && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>أو</Text>
                  <View style={styles.dividerLine} />
                </View>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={styles.appleBtn}
                  onPress={handleAppleSignIn}
                />
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.label}>كود التحقق</Text>
            <Text style={styles.sentTo}>أرسلنا الكود إلى {phone}</Text>
            <TextInput
              ref={otpRef}
              style={[styles.input, styles.otpInput]}
              value={otp}
              onChangeText={setOtp}
              placeholder="1111"
              keyboardType="number-pad"
              maxLength={4}
              textAlign="center"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>تأكيد</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); setError(''); }}>
              <Text style={styles.backLink}>تغيير رقم الهاتف</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  header: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  logoPlaceholder: { width: 80, height: 80, borderRadius: 20, backgroundColor: NAVY, marginBottom: 16 },
  title: { fontFamily: 'Cairo-Bold', fontSize: 28, color: NAVY, textAlign: 'center' },
  subtitle: { fontFamily: 'Cairo-Regular', fontSize: 16, color: '#666', textAlign: 'center', marginTop: 8 },
  form: { paddingBottom: 40 },
  label: { fontFamily: 'Cairo-SemiBold', fontSize: 16, color: NAVY, marginBottom: 8, textAlign: 'right' },
  sentTo: { fontFamily: 'Cairo-Regular', fontSize: 14, color: '#666', marginBottom: 12, textAlign: 'right' },
  input: {
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: 'Cairo-Regular', fontSize: 18, color: NAVY,
    marginBottom: 8,
    minHeight: 54,    // WCAG: min touch target
  },
  otpInput: { letterSpacing: 8, fontSize: 24, fontFamily: 'Cairo-Bold' },
  errorText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: '#D32F2F', textAlign: 'right', marginBottom: 8 },
  button: {
    backgroundColor: TEAL, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 8, minHeight: 54,
  },
  buttonText: { fontFamily: 'Cairo-Bold', fontSize: 18, color: '#fff' },
  backLink: { fontFamily: 'Cairo-Regular', fontSize: 14, color: TEAL, textAlign: 'center', marginTop: 16, paddingVertical: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dividerText: { fontFamily: 'Cairo-Regular', fontSize: 13, color: '#999' },
  appleBtn: { width: '100%', height: 54 },
});
