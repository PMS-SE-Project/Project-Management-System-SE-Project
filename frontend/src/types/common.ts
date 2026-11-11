export interface ApiErrorResponse {
  detail: string | ValidationErrorDetail[]
}

export interface ValidationErrorDetail {
  loc: Array<string | number>
  msg: string
  type: string
}

export interface MessageResponse {
  message: string
}

export interface IdResponse {
  id: string
}
