import type { UserSummary } from './user'

export type ProjectStatus = 'active' | 'on_hold' | 'completed'

export interface Project {
  id: string
  name: string
  description: string | null
  created_by: string
  members: string[]
  status: string
  project_lead?: string | null
  start_date?: string | null
  target_end_date?: string | null
  created_at: string
  updated_at?: string
}

export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  status: string | null
  project_lead: string | null
  created_at: string | null
  target_end_date?: string
}

export interface ProjectCreate {
  name: string
  description?: string | null
}

export interface ProjectUpdate {
  name?: string
  description?: string | null
  start_date?: string | null
  target_end_date?: string | null
  project_lead?: string | null
  status?: ProjectStatus
}

export interface ProjectMemberCreate {
  user_id: string
}

export interface ProjectMember extends UserSummary {
  is_active?: boolean
}

export interface ProjectListResponse {
  projects: ProjectSummary[]
}

export interface ProjectResponse {
  project: Project
  message?: string
}

export interface ProjectMembersResponse {
  members: ProjectMember[]
}

export interface EligibleMembersResponse {
  eligible_members: Omit<ProjectMember, 'role' | 'is_active'>[]
}

export interface EligibleLeadsResponse {
  eligible_leads: Omit<ProjectMember, 'role' | 'is_active'>[]
}
