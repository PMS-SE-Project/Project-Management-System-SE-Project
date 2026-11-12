import { ApiError, apiClient } from './client'
import type {
  ProjectDetailResponse,
  ProjectListResponse,
  ProjectSummary,
} from '../types/project'

export async function getProjects(
  sessionId: string,
  signal?: AbortSignal,
): Promise<ProjectSummary[]> {
  const response = await apiClient.get<ProjectListResponse>('/projects/my-projects', {
    signal,
    sessionId,
  })

  if (!response || !Array.isArray(response.projects)) {
    throw new ApiError(502, 'The projects server returned an invalid response.')
  }

  return response.projects
}

export function getProject(
  projectId: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<ProjectDetailResponse> {
  return apiClient.get<ProjectDetailResponse>(`/projects/${projectId}`, {
    signal,
    sessionId,
  })
}
