import type { ImageSourcePropType } from 'react-native';

/** Municipal branding — static requires for Metro. */
export const BrandingImages = {
  authBg: require('../../assets/branding/auth-bg-saida-waterfront.png') as ImageSourcePropType,
  homeCitizenBg: require('../../assets/branding/home-bg-lebanon-coast.png') as ImageSourcePropType,
  workerBg: require('../../assets/branding/worker-bg-municipal-work.png') as ImageSourcePropType,
  announcement: require('../../assets/branding/announcement-saida-waterfront.png') as ImageSourcePropType,
} as const;

export type BrandingImageKey = keyof typeof BrandingImages;
