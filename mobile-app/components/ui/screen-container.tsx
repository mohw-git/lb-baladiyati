import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Spacing } from '../../constants/theme';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { useStableRefresh } from '../../lib/ui/use-stable-refresh';

type ScreenContainerProps = {
  children: ReactNode;
  /** @deprecated Ignored — pull-to-refresh state is managed internally */
  refreshing?: boolean;
  onRefresh?: () => void | Promise<unknown>;
  contentStyle?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  /** When true, adds tab-bar-safe bottom padding (citizen home, etc.) */
  tabSafeBottom?: boolean;
};

export function ScreenContainer({
  children,
  onRefresh,
  contentStyle,
  noPadding,
  tabSafeBottom = false,
}: ScreenContainerProps) {
  const { contentPaddingBottom, horizontalPadding } = useTabScreenInsets();
  const stable = useStableRefresh({
    onRefresh: onRefresh ?? (() => undefined),
  });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        noPadding && styles.noPad,
        !noPadding && { paddingHorizontal: horizontalPadding },
        tabSafeBottom && { paddingBottom: contentPaddingBottom },
        contentStyle,
      ]}
      refreshControl={onRefresh ? stable.refreshControl : undefined}
      onScroll={onRefresh ? stable.onScroll : undefined}
      scrollEventThrottle={onRefresh ? stable.scrollEventThrottle : undefined}
      showsVerticalScrollIndicator={false}
      bounces={!!onRefresh}
      overScrollMode={onRefresh ? 'always' : 'never'}
      nestedScrollEnabled={false}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenSurface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.surface },
  content: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  noPad: { paddingHorizontal: 0 },
  surface: { flex: 1, backgroundColor: Colors.surface },
});
