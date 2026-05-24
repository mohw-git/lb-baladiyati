// ============================================================
// Municipality types
// ============================================================

export interface Municipality {
  id: string;
  name: string;
  nameAr?: string | null;
  nameFr?: string | null;
  code: string;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}
