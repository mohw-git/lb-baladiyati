import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { useTranslate } from '../../lib/i18n';

export function LoadingState({ message }: { message?: string }) {
  const t = useTranslate();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={Colors.brand[600]} />
      <Text style={styles.text}>{message ?? t('common.loading')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxxl, gap: Spacing.md },
  text: { fontSize: FontSize.sm, color: Colors.gray[500] },
});
