import { MunicipalityCandidate } from './municipality-resolution.types';

export type MunicipalityResolutionErrorCode =
  | 'LOCATION_REQUIRED'
  | 'OUT_OF_COVERAGE'
  | 'MUNICIPALITY_AMBIGUOUS'
  | 'INVALID_MUNICIPALITY_SELECTION';

export const MUNICIPALITY_RESOLUTION_MESSAGES: Record<
  MunicipalityResolutionErrorCode,
  string
> = {
  LOCATION_REQUIRED:
    'Please select the incident location so we can route the report to the correct municipality.',
  OUT_OF_COVERAGE:
    'No municipality coverage was found for this location. We cannot process this report for the selected area.',
  MUNICIPALITY_AMBIGUOUS:
    'Multiple municipalities match this location. Please select which municipality should receive the report.',
  INVALID_MUNICIPALITY_SELECTION:
    'The selected municipality is not valid for this location.',
};

export class MunicipalityResolutionError extends Error {
  constructor(
    public readonly code: MunicipalityResolutionErrorCode,
    message?: string,
    public readonly candidates: MunicipalityCandidate[] = [],
  ) {
    super(message ?? MUNICIPALITY_RESOLUTION_MESSAGES[code]);
    this.name = 'MunicipalityResolutionError';
  }
}
