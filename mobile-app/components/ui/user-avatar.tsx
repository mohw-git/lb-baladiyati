import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, FontSize } from '../../constants/theme';
import { getAvatarImageUri } from '../../lib/utils/avatar-url';

type UserAvatarProps = {
  /** Relative `/uploads/...` or absolute URL from API. */
  url?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  /** Bust native image cache after upload (timestamp or URL). */
  cacheBust?: string | number;
  /** Show spinner overlay (e.g. during upload). */
  loading?: boolean;
  /** Light border/text for dark hero headers. */
  tone?: 'default' | 'onDark';
};

/**
 * Circular user avatar — matches web dashboard `Avatar` (rounded-full).
 */
export function UserAvatar({
  url,
  firstName,
  lastName,
  size = 80,
  cacheBust,
  loading = false,
  tone = 'default',
}: UserAvatarProps) {
  const radius = size / 2;
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const imageUri = url ? getAvatarImageUri(url, cacheBust ?? url) : null;
  const onDark = tone === 'onDark';

  return (
    <View
      style={[
        styles.outer,
        onDark ? styles.outerOnDark : null,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.fallback,
            onDark ? styles.fallbackOnDark : null,
            { width: size, height: size, borderRadius: radius },
          ]}
        >
          <Text
            style={[
              styles.initials,
              onDark ? styles.initialsOnDark : null,
              { fontSize: Math.max(FontSize.lg, size * 0.32) },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}
      {loading ? (
        <View style={[styles.loadingOverlay, { borderRadius: radius }]}>
          <ActivityIndicator color={Colors.white} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    backgroundColor: Colors.brand[100],
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  outerOnDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  fallback: {
    backgroundColor: Colors.brand[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackOnDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  initials: {
    fontWeight: '700',
    color: Colors.brand[700],
  },
  initialsOnDark: {
    color: Colors.white,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
