import type { ReactNode } from 'react';
import { View, Text, StyleSheet, ImageBackground, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Overlay } from '../../constants/theme';
import { textAlignStart } from '../../lib/ui/rtl';

type CivicHeroProps = {
  title: string;
  subtitle?: string;
  imageSource?: ImageSourcePropType;
  overlay?: string;
  minHeight?: number;
  children?: ReactNode;
  showCedarStripe?: boolean;
  rtl?: boolean;
  variant?: 'auth' | 'citizen' | 'worker';
};

const VARIANT_OVERLAY: Record<'auth' | 'citizen' | 'worker', string> = {
  auth: Overlay.auth,
  citizen: Overlay.citizenHero,
  worker: Overlay.workerHero,
};

export function CivicHero({
  title,
  subtitle,
  imageSource,
  overlay,
  minHeight = 200,
  children,
  showCedarStripe = true,
  rtl = false,
  variant = 'auth',
}: CivicHeroProps) {
  const overlayColor = overlay ?? VARIANT_OVERLAY[variant];

  const inner = (
    <>
      <View style={[styles.content, { minHeight }]}>
        {!imageSource ? (
          <View style={styles.placeholderMark}>
            <Ionicons name="business" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        ) : null}
        <Text style={[styles.title, textAlignStart(rtl)]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, textAlignStart(rtl)]}>{subtitle}</Text>
        ) : null}
        {children}
      </View>
      {showCedarStripe ? <View style={styles.cedarStripe} /> : null}
    </>
  );

  if (imageSource) {
    return (
      <ImageBackground source={imageSource} style={styles.wrap} resizeMode="cover">
        <View style={[styles.overlay, { backgroundColor: overlayColor }]}>{inner}</View>
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.wrap, styles.placeholderBg]}>
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>{inner}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  placeholderBg: { backgroundColor: Colors.navy[900] },
  overlay: { width: '100%' },
  content: {
    position: 'relative',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xxl,
    justifyContent: 'flex-end',
  },
  placeholderMark: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.white,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.88)',
    marginTop: Spacing.xs,
    lineHeight: 22,
    maxWidth: 340,
  },
  cedarStripe: {
    height: 4,
    backgroundColor: Colors.cedar[600],
  },
});
