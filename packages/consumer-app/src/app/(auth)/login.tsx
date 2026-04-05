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
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';

type Step = 'phone' | 'otp';

export default function LoginScreen() {
  const router = useRouter();
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp);

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

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('أدخل الكود المكون من 6 أرقام');
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
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
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
});
