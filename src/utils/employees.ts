import type { Employee } from '@/types/models'

export function employeeLabel(employee: Pick<Employee, 'title' | 'name'>): string {
  return `${employee.title} ${employee.name}`
}
