import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GovCard } from '../ui/gov-card';
import { getInboxStatusStyle } from '../../lib/inbox/status-config';
import { useTranslate, useIsRtl } from '../../lib/i18n';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { flexRow, chevronForward, textAlignStart } from '../../lib/ui/rtl';

type InboxListCardProps = {
  title: string;
  routeLine: string;
  reason?: string | null;
  status: string;
  /** When set, shown on the badge instead of help-status i18n lookup */
  statusLabel?: string;
  createdAt: string;
  onPress: () => void;
};

export function InboxListCard({
  title,
  routeLine,
  reason,
  status,
  statusLabel,
  createdAt,
  onPress,
}: InboxListCardProps) {
  const t = useTranslate();
  const rtl = useIsRtl();
  const st = getInboxStatusStyle(status);
  const badgeText = statusLabel ?? t(st.labelKey);

  return (
    <GovCard onPress={onPress} style={styles.card}>
      <View style={[styles.header, flexRow(rtl)]}>
        <Text style={[styles.title, textAlignStart(rtl)]} numberOfLines={2}>
          {title}
        </Text>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[styles.badgeText, { color: st.color }]}>{badgeText}</Text>
        </View>
      </View>
      <Text style={[styles.route, textAlignStart(rtl)]} numberOfLines={1}>
        {routeLine}
      </Text>
      {reason ? (
        <Text style={[styles.reason, textAlignStart(rtl)]} numberOfLines={2}>
          {reason}
        </Text>
      ) : null}
      <View style={[styles.footer, flexRow(rtl)]}>
        <Text style={styles.meta}>{new Date(createdAt).toLocaleString()}</Text>
        <View style={[flexRow(rtl), { alignItems: 'center', gap: 4 }]}>
          <Text style={styles.open}>{t('inbox.open')}</Text>
          <Ionicons name={chevronForward(rtl)} size={16} color={Colors.brand[600]} />
        </View>
      </View>
    </GovCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.sm },
  header: { alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.xs },
  title: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  badge: { borderRadius: 999, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  route: { fontSize: FontSize.sm, color: Colors.gray[600], marginBottom: Spacing.xs },
  reason: { fontSize: FontSize.sm, color: Colors.gray[500], lineHeight: 18 },
  footer: { justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  meta: { fontSize: FontSize.xs, color: Colors.gray[400] },
  open: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600] },
});
