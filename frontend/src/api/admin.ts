import { ApiError, apiClient } from './client'
import type {
  AdminUserCreate,
  AdminUserUpdate,
  User,
  UserStatusUpdate,
} from '../types/user'

interface AdminUserListResponse {
  users: User[]
}

interface AdminUserResponse {
  user: User
}

export async function listAdminUsers(
  sessionId: string,
  skip = 0,
  limit = 100,
  signal?: AbortSignal,
): Promise<User[]> {
  const response = await apiClient.get<AdminUserListResponse>('/admin/users', {
    query: { skip, limit },
    sessionId,
    signal,
  })

  if (!response || !Array.isArray(response.users)) {
    throw new ApiError(502, 'The administration server returned an invalid user list.')
  }

  return response.users
}

export async function listAllAdminUsers(
  sessionId: string,
  signal?: AbortSignal,
): Promise<User[]> {
  const users: User[] = []
  let skip = 0
  const limit = 100
  let pageUsers: User[]

  do {
    pageUsers = await listAdminUsers(sessionId, skip, limit, signal)
    users.push(...pageUsers)
    skip += limit
  } while (pageUsers.length === limit && !signal?.aborted)

  return users
}

export async function createAdminUser(
  sessionId: string,
  user: AdminUserCreate,
): Promise<User> {
  const response = await apiClient.post<AdminUserResponse, AdminUserCreate>(
    '/admin/users',
    user,
    { sessionId },
  )
  return response.user
}

export async function updateAdminUser(
  sessionId: string,
  userId: string,
  changes: AdminUserUpdate,
): Promise<User> {
  const response = await apiClient.put<AdminUserResponse, AdminUserUpdate>(
    `/admin/users/${userId}`,
    changes,
    { sessionId },
  )
  return response.user
}

export async function updateAdminUserStatus(
  sessionId: string,
  userId: string,
  status: UserStatusUpdate,
): Promise<User> {
  const response = await apiClient.patch<AdminUserResponse, UserStatusUpdate>(
    `/admin/users/${userId}/status`,
    status,
    { sessionId },
  )
  return response.user
}
