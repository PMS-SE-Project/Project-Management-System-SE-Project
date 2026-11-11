import { ApiError, apiClient } from './client'
import type { LoginRequest, LoginResponse } from '../types/auth'
import type { CurrentUserResponse } from '../types/auth'
import type { UserRole } from '../types/user'

function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'project_manager' || value === 'team_member'
}

function parseLoginResponse(response: LoginResponse): LoginResponse {
  if (
    !response ||
    typeof response.session_id !== 'string' ||
    response.session_id.length === 0 ||
    !response.user ||
    typeof response.user.email !== 'string' ||
    !isUserRole(response.user.role)
  ) {
    throw new ApiError(502, 'The authentication server returned an invalid response.')
  }

  return response
}

export async function login(
  credentials: LoginRequest,
  signal?: AbortSignal,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse, LoginRequest>(
    '/auth/login',
    credentials,
    { signal },
  )
  return parseLoginResponse(response)
}

export function getCurrentUser(sessionId: string): Promise<CurrentUserResponse> {
  return apiClient.get<CurrentUserResponse>('/auth/me', { sessionId })
}

export function logout(sessionId: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/logout', undefined, { sessionId })
}
