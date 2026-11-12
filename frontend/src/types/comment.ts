import type { UserSummary } from './user'

export interface TaskComment {
  id: string
  project_id: string
  task_id: string
  author_id: string
  author?: UserSummary | null
  content: string
  created_at: string | null
}

export interface TaskCommentCreate {
  content: string
}

export interface TaskCommentsResponse {
  comments: TaskComment[]
}

export interface TaskCommentResponse {
  comment: TaskComment
}
