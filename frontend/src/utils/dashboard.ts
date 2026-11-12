import type { ProjectSummary } from '../types/project'
import type { Task } from '../types/task'

export function dashboardTasksForUser(tasks: Task[], role: string, email: string) {
  return role === 'team_member' ? tasks.filter((task) => task.assigned_to_user?.email === email) : tasks
}

export function summarizeDashboard(projects: ProjectSummary[], tasks: Task[], email: string) {
  const completed = tasks.filter((task) => task.status === 'Completed').length
  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.status === 'active').length,
    pending: tasks.filter((task) => task.status === 'To Do' || task.status === 'In Progress'),
    inProgress: tasks.filter((task) => task.status === 'In Progress').length,
    completed,
    progress: tasks.length ? Math.round(completed / tasks.length * 100) : 0,
    assigned: tasks.filter((task) => task.assigned_to_user?.email === email),
  }
}
