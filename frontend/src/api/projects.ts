import { ApiError, apiClient } from './client'
import type {
  ProjectDetailResponse,
  ProjectMember,
  ProjectMembersResponse,
  ProjectListResponse,
  ProjectSummary,
  EligibleMembersResponse,
  ProjectCreate,
  ProjectResponse,
  ProjectUpdate,
  EligibleLeadsResponse,
} from '../types/project'

export async function getEligibleProjectLeads(sessionId: string, signal?: AbortSignal) {
  const response = await apiClient.get<EligibleLeadsResponse>('/projects/eligible-leads', { sessionId, signal })
  if (!Array.isArray(response?.eligible_leads)) throw new ApiError(502, 'The server returned an invalid project lead list.')
  return response.eligible_leads
}

export async function updateProject(projectId: string, sessionId: string, changes: ProjectUpdate) {
  const response = await apiClient.put<ProjectResponse, ProjectUpdate>(`/projects/${projectId}`, changes, { sessionId })
  if (!response?.project?.id) throw new ApiError(502, 'The server returned an invalid project update response. Reload to check the saved project.')
  return response.project
}

export function deleteProject(projectId: string, sessionId: string) {
  return apiClient.delete(`/projects/${projectId}`, { sessionId })
}

export async function createProject(sessionId: string, project: ProjectCreate) {
  const response = await apiClient.post<ProjectResponse, ProjectCreate>('/projects/', project, { sessionId })
  if (!response?.project?.id || !response.project.name) {
    throw new ApiError(502, 'The project server returned an invalid creation response. Reload projects before trying again.')
  }
  return response.project
}

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

export async function getProject(
  projectId: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<ProjectDetailResponse> {
  const response = await apiClient.get<ProjectDetailResponse>(`/projects/${projectId}`, {
    signal,
    sessionId,
  })
  if (!response?.project || response.project.id !== projectId || !Array.isArray(response.members)) {
    throw new ApiError(502, 'The project server returned an invalid response.')
  }
  return response
}

export async function getEligibleProjectMembers(projectId: string, sessionId: string, signal?: AbortSignal) {
  const response = await apiClient.get<EligibleMembersResponse>(`/projects/${projectId}/eligible-members`, { sessionId, signal })
  if (!Array.isArray(response?.eligible_members)) throw new ApiError(502, 'The project members server returned an invalid response.')
  return response.eligible_members
}

export function addProjectMember(projectId: string, sessionId: string, userId: string) {
  return apiClient.post(`/projects/${projectId}/members`, { user_id: userId }, { sessionId })
}

export function removeProjectMember(projectId: string, sessionId: string, userId: string) {
  return apiClient.delete(`/projects/${projectId}/members/${userId}`, { sessionId })
}

export async function getProjectMembers(
  projectId: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<ProjectMember[]> {
  const response = await apiClient.get<ProjectMembersResponse>(
    `/projects/${projectId}/members`,
    {
      query: { active_team_members_only: true },
      signal,
      sessionId,
    },
  )

  if (!response || !Array.isArray(response.members)) {
    throw new ApiError(502, 'The project members server returned an invalid response.')
  }

  if (response.members.some((member) => !member
    || typeof member.id !== 'string' || !member.id
    || typeof member.email !== 'string' || !member.email
    || member.role !== 'team_member' || member.is_active === false)) {
    throw new ApiError(502, 'The project members server returned an invalid eligible-member response.')
  }
  return response.members
}
