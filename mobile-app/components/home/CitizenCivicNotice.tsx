import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { flexRow, textAlignStart, chevronForward } from '../../lib/ui/rtl';

type NoticeVariant = 'email' | 'kyc' | 'pending' | 'info';

type CitizenCivicNoticeProps = {
  variant: NoticeVariant;
  message: string;
  onPress?: () => void;
  rtl?: boolean;
};

/** Slim inline civic notice — visible but not dashboard-dominating */
export function CitizenCivicNotice({ variant, message, onPress, rtl = false }: CitizenCivicNoticeProps) {
  const icon =
    variant === 'email'
      ? 'mail-unread-outline'
      : variant === 'kyc'
        ? 'shield-outline'
        : variant === 'pending'
          ? 'time-outline'
          : 'information-circle-outline';

  const tint =
    variant === 'info'
      ? { bg: Colors.navy[50], border: Colors.navy[200], icon: Colors.navy[700] }
      : { bg: Colors.orange[50], border: Colors.orange[100], icon: Colors.orange[700] };

  const content = (
    <View style={[styles.row, flexRow(rtl), { backgroundColor: tint.bg, borderColor: tint.border }]}>
      <Ionicons name={icon} size={16} color={tint.icon} />
      <Text style={[styles.text, textAlignStart(rtl)]} numberOfLines={2}>
        {message}
      </Text>
      {onPress ? (
        <Ionicons name={chevronForward(rtl)} size={16} color={Colors.gray[400]} />
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.wrap}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.wrap}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm },
  row: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '500',
    color: Colors.gray[700],
    lineHeight: 17,
  },
});
