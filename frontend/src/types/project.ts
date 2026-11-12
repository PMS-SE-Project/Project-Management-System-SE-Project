import type { UserSummary } from './user'

export type ProjectStatus = 'active' | 'on_hold' | 'completed'

export interface Project {
  id: string
  name: string
  description: string | null
  created_by?: string | null
  members: string[]
  status?: string | null
  project_lead?: string | null
  project_lead_user?: UserSummary | null
  start_date?: string | null
  target_end_date?: string | null
  created_at?: string | null
  updated_at?: string
}

export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  status: string | null
  project_lead: string | null
  project_lead_user?: UserSummary | null
  created_at: string | null
  target_end_date?: string | null
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

export interface ProjectDetailResponse {
  project: Project
  project_lead_user: UserSummary | null
  members: ProjectMember[]
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
