// ============================================================
// Category types
// ============================================================

export interface Category {
  id: string;
  name: string;
  nameAr?: string | null;
  nameFr?: string | null;
  icon?: string | null;
  isActive: boolean;
  department?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameFr?: string | null;
  } | null;
  createdAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  nameAr?: string;
  nameFr?: string;
  icon?: string;
  departmentId?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  nameAr?: string;
  nameFr?: string;
  icon?: string;
  departmentId?: string;
  isActive?: boolean;
}
