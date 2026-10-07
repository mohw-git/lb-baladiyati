import type { DepartmentHealth, DepartmentWorkloadRow } from '@shared/types/department';

export type { DepartmentHealth, DepartmentWorkloadRow };

export function healthRowClass(health: DepartmentHealth): string {
  switch (health) {
    case 'healthy':
      return 'border-s-success-500 bg-success-50/40';
    case 'elevated':
      return 'border-s-warn-500 bg-warn-50/40';
    case 'overloaded':
      return 'border-s-alert-500 bg-alert-50/40';
  }
}

export function healthBadgeClass(health: DepartmentHealth): string {
  switch (health) {
    case 'healthy':
      return 'bg-success-100 text-success-800';
    case 'elevated':
      return 'bg-warn-100 text-warn-800';
    case 'overloaded':
      return 'bg-alert-100 text-alert-800';
  }
}

export function healthScoreTextClass(health: DepartmentHealth): string {
  switch (health) {
    case 'healthy':
      return 'text-success-800';
    case 'elevated':
      return 'text-warn-800';
    case 'overloaded':
      return 'text-alert-800';
  }
}
