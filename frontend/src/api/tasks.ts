import { ApiError, apiClient } from './client'
import type {
  Task,
  TaskCreate,
  TaskListResponse,
  TaskResponse,
  TaskStatusUpdate,
  TaskUpdate,
} from '../types/task'
import type {
  TaskComment,
  TaskCommentCreate,
  TaskCommentsResponse,
} from '../types/comment'

export async function getProjectTasks(
  projectId: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<Task[]> {
  const response = await apiClient.get<TaskListResponse>(
    `/projects/${projectId}/tasks`,
    { signal, sessionId },
  )

  if (!response || !Array.isArray(response.tasks)) {
    throw new ApiError(502, 'The tasks server returned an invalid response.')
  }

  return response.tasks
}

export async function createProjectTask(
  projectId: string,
  sessionId: string,
  task: TaskCreate,
): Promise<Task> {
  const response = await apiClient.post<TaskResponse, TaskCreate>(
    `/projects/${projectId}/tasks`,
    task,
    { sessionId },
  )
  return response.task
}

export async function updateProjectTask(
  projectId: string,
  taskId: string,
  sessionId: string,
  task: TaskUpdate,
): Promise<Task> {
  const response = await apiClient.put<TaskResponse, TaskUpdate>(
    `/projects/${projectId}/tasks/${taskId}`,
    task,
    { sessionId },
  )
  return response.task
}

export async function deleteProjectTask(
  projectId: string,
  taskId: string,
  sessionId: string,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/tasks/${taskId}`, { sessionId })
}

export async function updateProjectTaskStatus(
  projectId: string,
  taskId: string,
  sessionId: string,
  status: TaskStatusUpdate,
): Promise<Task> {
  const response = await apiClient.patch<TaskResponse, TaskStatusUpdate>(
    `/projects/${projectId}/tasks/${taskId}/status`,
    status,
    { sessionId },
  )
  return response.task
}

export async function getTaskComments(
  projectId: string,
  taskId: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<TaskComment[]> {
  const response = await apiClient.get<TaskCommentsResponse>(
    `/projects/${projectId}/tasks/${taskId}/comments`,
    { sessionId, signal },
  )
  if (!Array.isArray(response?.comments)) throw new ApiError(502, 'The server returned an invalid comment list.')
  return response.comments
}

export async function createTaskComment(
  projectId: string,
  taskId: string,
  sessionId: string,
  comment: TaskCommentCreate,
): Promise<TaskComment> {
  const response = await apiClient.post<
    { comment: TaskComment },
    TaskCommentCreate
  >(`/projects/${projectId}/tasks/${taskId}/comments`, comment, { sessionId })
  return response.comment
}
