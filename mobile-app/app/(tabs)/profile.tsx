import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/auth/store';
import { authApi, notificationsApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useLocale, useTranslate } from '../../lib/i18n';
import { pickName } from '@shared/types/locale';

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, updateUser } = useAuthStore();
  const t = useTranslate();
  const locale = useLocale();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });

  const { data: unread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
  });

  useEffect(() => {
    if (profile) {
      setForm({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone || '' });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateProfile({
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone || undefined,
    }),
    onSuccess: (data: any) => {
      // Sync the auth store so avatar/header reflects changes immediately
      updateUser({
        firstName: data?.firstName || form.firstName,
        lastName: data?.lastName || form.lastName,
        phone: form.phone || undefined,
      });
      Alert.alert(t('common.success'), t('profile.updated'));
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.details?.length) {
        Alert.alert(t('common.error'), err.details.map((d) => `• ${d.message}`).join('\n'));
      } else {
        Alert.alert(t('common.error'), err instanceof Error ? err.message : t('profile.updateFailed'));
      }
    },
  });

  const { refreshToken } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'), style: 'destructive',
        onPress: async () => {
          // Invalidate refresh token on the server
          if (refreshToken) {
            try { await authApi.logout(refreshToken); } catch {}
          }
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
        </View>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm }}>
          {user?.roles?.[0] && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user.roles[0]}</Text>
            </View>
          )}
          {user?.verificationStatus === 'VERIFIED' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.green[100], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Ionicons name="shield-checkmark" size={14} color={Colors.green[700]} />
              <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: Colors.green[700] }}>{t('profile.verified')}</Text>
            </View>
          )}
        </View>
      </View>

      {/* KYC verification banner */}
      {user?.verificationStatus !== 'VERIFIED' && (
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', backgroundColor: user?.verificationStatus === 'PENDING' ? Colors.orange[50] : Colors.red[50],
            borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.lg,
            borderWidth: 1, borderColor: user?.verificationStatus === 'PENDING' ? Colors.orange[500] : Colors.red[200],
          }}
          onPress={() => router.push('/kyc')}
        >
          <Ionicons
            name={user?.verificationStatus === 'PENDING' ? 'time' : 'shield-checkmark'}
            size={28}
            color={user?.verificationStatus === 'PENDING' ? Colors.orange[600] : Colors.red[600]}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontWeight: '700', fontSize: FontSize.sm, color: Colors.gray[900] }}>
              {user?.verificationStatus === 'PENDING' ? t('profile.verifyPending') : t('profile.verifyMissing')}
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 2 }}>
              {user?.verificationStatus === 'PENDING'
                ? t('profile.verifyPendingHint')
                : t('profile.verifyMissingHint')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
        </TouchableOpacity>
      )}

      {/* Profile info / edit */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t('profile.personalInfo')}</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editLink}>{t('profile.edit')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <View style={styles.form}>
            <Text style={styles.label}>{t('profile.firstName')}</Text>
            <TextInput style={styles.input} value={form.firstName} onChangeText={(v) => setForm({ ...form, firstName: v })} />
            <Text style={[styles.label, { marginTop: Spacing.md }]}>{t('profile.lastName')}</Text>
            <TextInput style={styles.input} value={form.lastName} onChangeText={(v) => setForm({ ...form, lastName: v })} />
            <Text style={[styles.label, { marginTop: Spacing.md }]}>{t('profile.phone')}</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.infoList}>
            <InfoRow icon="person" label={t('profile.name')} value={`${profile?.firstName || user?.firstName} ${profile?.lastName || user?.lastName}`} />
            <InfoRow icon="mail" label={t('profile.email')} value={user?.email || ''} />
            <InfoRow icon="call" label={t('profile.phone')} value={profile?.phone || user?.phone || t('profile.notSet')} />
            <InfoRow icon="business" label={t('profile.municipality')} value={pickName(profile?.municipality as any, locale) || '—'} />
          </View>
        )}
      </View>

      {/* Menu items */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={22} color={Colors.gray[600]} />
          <Text style={styles.menuText}>{t('profile.notifications')}</Text>
          {(unread?.unreadCount ?? 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread?.unreadCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: Colors.gray[200], marginVertical: Spacing.xs }} />
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/language')}>
          <Ionicons name="language-outline" size={22} color={Colors.gray[600]} />
          <Text style={styles.menuText}>{t('common.language')}</Text>
          <Text style={{ marginLeft: 'auto', color: Colors.gray[500], fontSize: FontSize.sm }}>
            {locale === 'ar' ? 'العربية' : locale === 'fr' ? 'Français' : 'English'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} style={{ marginLeft: Spacing.sm }} />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={Colors.red[500]} />
        <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Baladi v1.0.0</Text>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={Colors.gray[400]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Spacing.xl, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.brand[100],
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.brand[700] },
  name: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900] },
  email: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 2 },
  roleBadge: { marginTop: Spacing.sm, backgroundColor: Colors.brand[50], borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  roleText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.brand[700] },
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900] },
  editLink: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600] },
  infoList: { gap: Spacing.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  infoLabel: { fontSize: FontSize.xs, color: Colors.gray[500] },
  infoValue: { fontSize: FontSize.md, color: Colors.gray[900], fontWeight: '500' },
  form: {},
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  input: {
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md,
    color: Colors.gray[900], backgroundColor: Colors.white,
  },
  editActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  cancelText: { fontSize: FontSize.md, color: Colors.gray[600], fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  saveText: { fontSize: FontSize.md, color: Colors.white, fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  menuText: { fontSize: FontSize.md, color: Colors.gray[700], fontWeight: '500' },
  unreadBadge: { backgroundColor: Colors.red[500], borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  unreadText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.red[100],
  },
  logoutText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.red[500] },
  version: { fontSize: FontSize.xs, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.md },
});
