import type { ReactNode } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '../../constants/theme';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';

type TabScreenShellProps = {
  children: ReactNode;
  /** Vertically center content in space between header and tab bar */
  centerContent?: boolean;
  style?: StyleProp<ViewStyle>;
  noHorizontalPadding?: boolean;
};

/** Standard tab screen body — consistent padding above bottom tabs */
export function TabScreenShell({
  children,
  centerContent = false,
  style,
  noHorizontalPadding = false,
}: TabScreenShellProps) {
  const { contentPaddingBottom, horizontalPadding } = useTabScreenInsets();

  return (
    <View
      style={[
        styles.root,
        {
          paddingBottom: contentPaddingBottom,
          paddingHorizontal: noHorizontalPadding ? 0 : horizontalPadding,
        },
        style,
      ]}
    >
      {centerContent ? <View style={styles.center}>{children}</View> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    width: '100%',
  },
});
