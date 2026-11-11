export type UserRole = 'admin' | 'project_manager' | 'team_member'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  is_active: boolean
}

export type UserSummary = Pick<User, 'id' | 'name' | 'email' | 'role'>

export interface AdminUserCreate {
  name: string
  email: string
  password: string
  role: UserRole
}

export interface AdminUserUpdate {
  name?: string
  email?: string
  role?: UserRole
}

export interface UserStatusUpdate {
  is_active: boolean
}
