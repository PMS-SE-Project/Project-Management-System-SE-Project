export interface TaskComment {
  id: string
  project_id: string
  task_id: string
  author_id: string
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
