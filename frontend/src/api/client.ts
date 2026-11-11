const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'

export type QueryValue = string | number | boolean | null | undefined

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, QueryValue>
  sessionId?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly backendMessage: string

  constructor(status: number, backendMessage: string) {
    super(backendMessage)
    this.name = 'ApiError'
    this.status = status
    this.backendMessage = backendMessage
  }
}

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
    /\/+$/,
    '',
  )
}

function buildUrl(path: string, query?: ApiRequestOptions['query'], sessionId?: string) {
  const url = new URL(`${getApiBaseUrl()}/${path.replace(/^\/+/, '')}`)
  const params = { ...query, session_id: sessionId }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  })

  return url
}

function getErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
    const detail = payload.detail
    if (typeof detail === 'string') {
      return detail
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === 'object' && item !== null && 'msg' in item) {
            return String(item.msg)
          }
          return String(item)
        })
        .join('; ')
    }
  }

  if (typeof payload === 'string' && payload.length > 0) {
    return payload
  }

  const statusMessages: Record<number, string> = {
    400: 'The request could not be understood.',
    401: 'Authentication is required.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    422: 'The submitted data is invalid.',
    500: 'The server encountered an unexpected error.',
  }
  return statusMessages[status] || `Request failed with status ${status}.`
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined
  }

  const text = await response.text()
  if (!text) {
    return undefined
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }
  return text
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { query, sessionId, headers: requestHeaders, ...fetchOptions } = options
  const headers = new Headers(requestHeaders)
  headers.set('Accept', 'application/json')

  let requestBody: BodyInit | undefined
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query, sessionId), {
      ...fetchOptions,
      body: requestBody,
      credentials: 'include',
      headers,
      method,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(0, 'Unable to reach the API server.')
  }

  const payload = await readResponseBody(response)
  if (!response.ok) {
    throw new ApiError(response.status, getErrorMessage(payload, response.status))
  }

  return payload as T
}

export const apiClient = {
  delete<T = undefined>(path: string, options?: ApiRequestOptions) {
    return request<T>('DELETE', path, undefined, options)
  },
  get<T>(path: string, options?: ApiRequestOptions) {
    return request<T>('GET', path, undefined, options)
  },
  patch<T, B = unknown>(
    path: string,
    body?: B,
    options?: ApiRequestOptions,
  ) {
    return request<T>('PATCH', path, body, options)
  },
  post<T, B = unknown>(
    path: string,
    body?: B,
    options?: ApiRequestOptions,
  ) {
    return request<T>('POST', path, body, options)
  },
  put<T, B = unknown>(
    path: string,
    body?: B,
    options?: ApiRequestOptions,
  ) {
    return request<T>('PUT', path, body, options)
  },
}
