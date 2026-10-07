import { View, Text, StyleSheet, Image, Pressable, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { GovCard } from './gov-card';
import { flexRow, positionStart, textAlignEnd, textAlignStart } from '../../lib/ui/rtl';

type AnnouncementCardProps = {
  title: string;
  preview?: string;
  dateLabel: string;
  authorLabel?: string;
  imageUri?: string;
  placeholderImage?: ImageSourcePropType;
  onPress: () => void;
  rtl?: boolean;
  noticeLabel?: string;
};

/** Municipality notice / news card with optional hero image */
export function AnnouncementCard({
  title,
  preview,
  dateLabel,
  authorLabel,
  imageUri,
  placeholderImage,
  onPress,
  rtl = false,
  noticeLabel = 'Notice',
}: AnnouncementCardProps) {
  const showImage = imageUri || placeholderImage;

  return (
    <GovCard onPress={onPress} padded={false} style={styles.card}>
      {showImage ? (
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : placeholderImage ? (
            <Image source={placeholderImage} style={styles.image} resizeMode="cover" />
          ) : null}
          <View style={styles.imageOverlay} />
          <View style={[styles.noticePill, flexRow(rtl), positionStart(rtl, Spacing.sm), { top: Spacing.sm }]}>
            <Ionicons name="megaphone-outline" size={12} color={Colors.white} />
            <Text style={styles.noticeText}>{noticeLabel}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="newspaper-outline" size={28} color={Colors.gray[400]} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.title, textAlignStart(rtl)]} numberOfLines={2}>
          {title}
        </Text>
        {preview ? (
          <Text style={[styles.preview, textAlignStart(rtl)]} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
        <View style={[styles.footer, flexRow(rtl)]}>
          {authorLabel ? (
            <Text style={[styles.meta, textAlignStart(rtl)]} numberOfLines={1}>
              {authorLabel}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Text style={[styles.meta, textAlignEnd(rtl)]}>{dateLabel}</Text>
        </View>
      </View>
    </GovCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.md, overflow: 'hidden' },
  imageWrap: { height: 120, backgroundColor: Colors.navy[800] },
  image: { width: '100%', height: '100%' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(12, 26, 46, 0.25)',
  },
  imagePlaceholder: {
    height: 88,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticePill: {
    position: 'absolute',
    top: Spacing.sm,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(12, 26, 46, 0.75)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  noticeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.white,
  },
  body: { padding: Spacing.lg },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.navy[900],
    lineHeight: 22,
  },
  preview: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  footer: {
    marginTop: Spacing.md,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  meta: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    flexShrink: 1,
  },
});
