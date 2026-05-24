export interface JwtPayload {
  sub: string; // userId
  email: string;
  municipalityId: string; // empty string '' for super admins not bound to a municipality
  isSuperAdmin?: boolean;
}

export interface CurrentUserData {
  id: string;
  email: string;
  municipalityId: string; // empty string '' for super admins
  isSuperAdmin: boolean;
}
