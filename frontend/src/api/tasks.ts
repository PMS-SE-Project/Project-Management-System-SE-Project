import { ApiError, apiClient } from './client'
import type { Task, TaskListResponse } from '../types/task'

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
