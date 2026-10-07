import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '../../constants/theme';

type CivicBrandMarkProps = {
  size?: 'md' | 'lg';
};

/** Official municipal seal-style mark for auth heroes */
export function CivicBrandMark({ size = 'lg' }: CivicBrandMarkProps) {
  const dim = size === 'lg' ? 72 : 56;
  const icon = size === 'lg' ? 34 : 28;
  return (
    <View style={[styles.wrap, { width: dim, height: dim, borderRadius: BorderRadius.lg }]}>
      <Ionicons name="business" size={icon} color={Colors.white} />
      <View style={styles.cedarStripe} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cedarStripe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.cedar[600],
  },
});
