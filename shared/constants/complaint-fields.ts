/** Unified complaint title/description limits (create + submit flows). */
export const COMPLAINT_TITLE_MIN = 5;
export const COMPLAINT_TITLE_MAX = 120;
export const COMPLAINT_DESCRIPTION_MIN = 20;
export const COMPLAINT_DESCRIPTION_MAX = 1000;

export const COMPLAINT_FIELD_LIMITS = {
  title: { min: COMPLAINT_TITLE_MIN, max: COMPLAINT_TITLE_MAX },
  description: { min: COMPLAINT_DESCRIPTION_MIN, max: COMPLAINT_DESCRIPTION_MAX },
} as const;

export function trimComplaintField(value: string): string {
  return value.trim();
}

export function isComplaintTitleValid(value: string): boolean {
  const trimmed = trimComplaintField(value);
  return (
    trimmed.length >= COMPLAINT_TITLE_MIN && trimmed.length <= COMPLAINT_TITLE_MAX
  );
}

export function isComplaintDescriptionValid(value: string): boolean {
  const trimmed = trimComplaintField(value);
  return (
    trimmed.length >= COMPLAINT_DESCRIPTION_MIN &&
    trimmed.length <= COMPLAINT_DESCRIPTION_MAX
  );
}
