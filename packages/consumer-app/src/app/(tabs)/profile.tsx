// ============================================================
// SUPER RESERVATION PLATFORM — Profile / Account Screen
// Shows user name, phone, language toggle, logout.
// Allows editing full_name via PATCH /users/me.
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';

export default function ProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => usersApi.getMe().then((r) => r.data),
  });

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: { full_name?: string; language_pref?: string }) =>
      usersApi.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setEditingName(false);
    },
    onError: () => {
      Alert.alert('خطأ', 'فشل التحديث. حاول مرة أخرى.');
    },
  });

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      Alert.alert('خطأ', 'الاسم يجب أن يكون حرفين على الأقل.');
      return;
    }
    updateMutation.mutate({ full_name: trimmed });
  };

  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد أنك تريد الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'خروج',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleToggleLanguage = () => {
    const newLang = user?.language_pref === 'ar' ? 'en' : 'ar';
    updateMutation.mutate({ language_pref: newLang });
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>حسابي</Text>
      </View>

      {/* Avatar placeholder */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {user?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.phone}>{user?.phone}</Text>
      </View>

      {/* Name field */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>الاسم</Text>
        {editingName ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="اسمك الكامل"
              autoFocus
              textAlign="right"
              writingDirection="rtl"
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveName}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>حفظ</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => {
              setNameInput(user?.full_name ?? '');
              setEditingName(true);
            }}
          >
            <Text style={styles.editHint}>تعديل ✏️</Text>
            <Text style={styles.fieldValue}>{user?.full_name}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Language toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>اللغة</Text>
        <TouchableOpacity
          style={styles.fieldRow}
          onPress={handleToggleLanguage}
          disabled={updateMutation.isPending}
        >
          <Text style={styles.editHint}>تغيير ↔</Text>
          <Text style={styles.fieldValue}>
            {user?.language_pref === 'ar' ? 'العربية 🇪🇬' : 'English 🇺🇸'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* No-show warning (if applicable) */}
      {(user?.no_show_count ?? 0) > 0 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ لديك {user?.no_show_count} حالة غياب.{' '}
            {user?.deposit_mandatory
              ? 'الإيداع مطلوب على جميع حجوزاتك القادمة.'
              : 'تجنب الغياب للحفاظ على تقييمك.'}
          </Text>
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>

      {/* App version */}
      <Text style={styles.version}>Super Reservation v1.0.0</Text>
    </ScrollView>
  );
}

const NAVY = '#0F2044';
const TEAL = '#1B8A7A';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: { fontFamily: 'Cairo-Bold', fontSize: 24, color: NAVY, textAlign: 'right' },
  avatarSection: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#fff', marginBottom: 16 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: NAVY,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitial: { fontFamily: 'Cairo-Bold', fontSize: 32, color: '#fff' },
  phone: { fontFamily: 'Cairo-Regular', fontSize: 16, color: '#666' },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
    marginBottom: 12,
    paddingHorizontal: 24,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0F0F0',
  },
  sectionLabel: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    paddingTop: 12,
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  fieldValue: { fontFamily: 'Cairo-SemiBold', fontSize: 16, color: NAVY, textAlign: 'right' },
  editHint: { fontFamily: 'Cairo-Regular', fontSize: 13, color: TEAL },
  editRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: TEAL,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    color: NAVY,
  },
  saveButton: {
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  saveButtonText: { fontFamily: 'Cairo-SemiBold', fontSize: 15, color: '#fff' },
  warningBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningText: { fontFamily: 'Cairo-Regular', fontSize: 14, color: '#92400E', textAlign: 'right' },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: { fontFamily: 'Cairo-SemiBold', fontSize: 16, color: '#DC2626' },
  version: { fontFamily: 'Cairo-Regular', fontSize: 12, color: '#CCC', textAlign: 'center', marginTop: 8 },
});
