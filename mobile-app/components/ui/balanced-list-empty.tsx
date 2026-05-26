import type { ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';

type BalancedListEmptyProps = {
  children: ReactNode;
};

/** Centers list empty content between stack header and tab bar */
export function BalancedListEmpty({ children }: BalancedListEmptyProps) {
  const { height } = useWindowDimensions();
  const { listEmptyMinHeight } = useTabScreenInsets();
  const minHeight = Math.min(listEmptyMinHeight(height), height * 0.52);

  return (
    <View style={[styles.wrap, { minHeight }]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 24,
  },
  inner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
