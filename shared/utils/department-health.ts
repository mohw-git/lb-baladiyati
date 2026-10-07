export type DepartmentHealth = 'healthy' | 'elevated' | 'overloaded';

/** Weighted operational load: active complaints + 3× overdue. */
export function computeDepartmentHealthScore(
  activeComplaints: number,
  overdueComplaints: number,
): number {
  return activeComplaints + overdueComplaints * 3;
}

export function classifyDepartmentHealth(score: number): DepartmentHealth {
  if (score <= 5) return 'healthy';
  if (score <= 10) return 'elevated';
  return 'overloaded';
}

export function deriveDepartmentHealth(
  activeComplaints: number,
  overdueComplaints: number,
): { healthScore: number; health: DepartmentHealth } {
  const healthScore = computeDepartmentHealthScore(
    activeComplaints,
    overdueComplaints,
  );
  return { healthScore, health: classifyDepartmentHealth(healthScore) };
}
