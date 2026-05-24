import { get, patch, postFormData } from '../client';
import type { Municipality } from '@shared/types/municipality';

export interface MunicipalityPublic {
  id: string;
  name: string;
  nameAr?: string | null;
  nameFr?: string | null;
  code: string;
  logoUrl?: string | null;
  isActive?: boolean;
  createdAt?: string;
  bannerImageUrl?: string | null;
  bannerOverlayColor?: string | null;
  bannerOverlayOpacity?: number | null;
  primaryColor?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  descriptionFr?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsApp?: string | null;
  address?: string | null;
  addressAr?: string | null;
  addressFr?: string | null;
  openingHours?: string | null;
  openingHoursAr?: string | null;
  openingHoursFr?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  departments?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameFr?: string | null;
    categories: { id: string; name: string; nameAr?: string | null; nameFr?: string | null }[];
  }[];
}

export interface MunicipalityWithAdmin extends MunicipalityPublic {
  adminUserId?: string | null;
  admin?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
}

export interface MunicipalityBrandingUpdate {
  name?: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  logoUrl?: string;
  bannerImageUrl?: string;
  bannerOverlayColor?: string;
  bannerOverlayOpacity?: number;
  primaryColor?: string;
  email?: string;
  phone?: string;
  whatsApp?: string;
  address?: string;
  addressAr?: string;
  addressFr?: string;
  openingHours?: string;
  openingHoursAr?: string;
  openingHoursFr?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
}

export const municipalitiesApi = {
  // The global response interceptor wraps the controller payload `{ data: [...] }`
  // into `{ success, data: { data: [...] } }`, then the API client unwraps the
  // `success` envelope AND the inner `{ data: [] }` indirection, so what we
  // receive here is the array itself. Type the function accordingly so callers
  // can iterate directly.
  list: () => get<MunicipalityPublic[]>('/municipalities', { skipAuth: true }),
  getByCode: (code: string) =>
    get<MunicipalityPublic>(`/municipalities/by-code/${code}`, { skipAuth: true }),
  getCurrent: () => get<MunicipalityWithAdmin>('/municipalities/me'),
  updateBranding: (data: MunicipalityBrandingUpdate) =>
    patch<MunicipalityWithAdmin>('/municipalities/me/branding', data),
  updateBrandingById: (id: string, data: MunicipalityBrandingUpdate) =>
    patch<MunicipalityWithAdmin>(`/municipalities/${id}/branding`, data),
  uploadLogo: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return postFormData<MunicipalityWithAdmin>('/municipalities/me/logo', fd);
  },
  uploadBanner: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return postFormData<MunicipalityWithAdmin>('/municipalities/me/banner', fd);
  },
  uploadLogoById: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return postFormData<MunicipalityWithAdmin>(`/municipalities/${id}/logo`, fd);
  },
  uploadBannerById: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return postFormData<MunicipalityWithAdmin>(`/municipalities/${id}/banner`, fd);
  },
};
