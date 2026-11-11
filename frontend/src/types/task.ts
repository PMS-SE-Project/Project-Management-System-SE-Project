export type TaskStatus = 'To Do' | 'In Progress' | 'Completed'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  assigned_to: string | null
  priority: TaskPriority
  status: TaskStatus
  deadline: string | null
  created_by: string
  created_at: string
  updated_at?: string
}

export interface TaskCreate {
  title: string
  description?: string | null
  assigned_to?: string | null
  priority?: TaskPriority
  deadline?: string | null
}

export interface TaskUpdate {
  title?: string
  description?: string | null
  assigned_to?: string | null
  priority?: TaskPriority
  deadline?: string | null
}

export interface TaskStatusUpdate {
  status: TaskStatus
}

export interface TaskListResponse {
  tasks: Task[]
}

export interface TaskResponse {
  task: Task
}
