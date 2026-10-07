export type MunicipalityResolutionStatus =
  | 'EXACT'
  | 'BUFFER'
  | 'AMBIGUOUS'
  | 'OUT_OF_COVERAGE';

/** Methods stored on new complaints. Legacy rows may still reference removed values. */
export type MunicipalityResolutionMethod =
  | 'BOUNDARY_EXACT'
  | 'BOUNDARY_BUFFER'
  | 'USER_SELECTED_AMBIGUOUS'
  | 'LEGACY_USER_MUNICIPALITY';

export type MunicipalityCandidate = {
  id: string;
  name: string;
  code: string;
  nameAr?: string | null;
  nameFr?: string | null;
};

export type MunicipalityResolutionResult = {
  status: MunicipalityResolutionStatus;
  municipalityId: string | null;
  method: MunicipalityResolutionMethod | null;
  candidates: MunicipalityCandidate[];
  confidence?: number;
  distanceMeters?: number;
};
