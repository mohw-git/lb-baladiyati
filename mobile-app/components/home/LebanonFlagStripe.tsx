import { View, StyleSheet } from 'react-native';

/** Thin tricolor accent — use on card edges, not between hero and surface */
export function LebanonFlagStripe() {
  return (
    <View style={styles.stripe}>
      <View style={styles.red} />
      <View style={styles.white} />
      <View style={styles.green} />
    </View>
  );
}

const styles = StyleSheet.create({
  stripe: { height: 3, flexDirection: 'row', width: '100%' },
  red: { flex: 1, backgroundColor: '#dc2626' },
  white: { flex: 1, backgroundColor: '#ffffff' },
  green: { flex: 1, backgroundColor: '#15803d' },
});
