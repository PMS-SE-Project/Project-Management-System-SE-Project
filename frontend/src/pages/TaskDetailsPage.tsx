import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getProject } from '../api/projects'
import {
  createTaskComment,
  deleteProjectTask,
  getProjectTasks,
  getTaskComments,
  updateProjectTaskStatus,
} from '../api/tasks'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { TaskFormModal } from '../components/tasks/TaskFormModal'
import { Alert } from '../components/ui/Alert'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Spinner } from '../components/ui/Spinner'
import type { ProjectDetailResponse } from '../types/project'
import type { Task, TaskPriority, TaskStatus } from '../types/task'
import { TASK_STATUS_OPTIONS } from '../types/task'
import type { TaskComment } from '../types/comment'

const statusOptions = TASK_STATUS_OPTIONS

function formatTimestamp(value: string | null) {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function getPriorityTone(priority: TaskPriority): BadgeTone {
  if (priority === 'high') return 'danger'
  if (priority === 'medium') return 'warning'
  return 'success'
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have permission to perform this task action.'
    if (error.status === 404) return 'The task could not be found.'
    if (error.status === 0) return 'The ProjectHub API is unavailable. Try again.'
    return error.backendMessage
  }
  return 'We could not load this task. Please try again.'
}

export function TaskDetailsPage() {
  const { projectId, taskId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [project, setProject] = useState<ProjectDetailResponse | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [comments, setComments] = useState<TaskComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  useEffect(() => {
    if (!projectId || !taskId || !session) return

    const controller = new AbortController()
    Promise.all([
      getProject(projectId, session.session_id, controller.signal),
      getProjectTasks(projectId, session.session_id, controller.signal),
    ])
      .then(async ([loadedProject, loadedTasks]) => {
        if (controller.signal.aborted) return
        const selectedTask = loadedTasks.find((item) => item.id === taskId)
        if (!selectedTask) throw new ApiError(404, 'The task could not be found.')

        setProject(loadedProject)
        setLoadError(null)
        setErrorMessage(null)
        setCommentError(null)
        setComments([])
        setTask(selectedTask)
        setLoadedTaskId(taskId)
        const canComment = session.user.role === 'team_member'
          || loadedProject.project_lead_user?.email === session.user.email
        if (canComment) {
          setIsLoadingComments(true)
          try {
            const loadedComments = await getTaskComments(projectId, taskId, session.session_id, controller.signal)
            if (!controller.signal.aborted) setComments(loadedComments)
          } catch (error) {
            if (!controller.signal.aborted) setCommentError(getErrorMessage(error))
          } finally {
            if (!controller.signal.aborted) setIsLoadingComments(false)
          }
        }
        if (!controller.signal.aborted) setIsLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(getErrorMessage(error))
        setLoadedTaskId(taskId)
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [projectId, session, taskId])

  if (isLoading || loadedTaskId !== taskId) {
    return (
      <section className="page">
        <div className="projects-status" role="status">
          <Spinner label="Loading task" size="large" />
          <p>Loading task details…</p>
        </div>
      </section>
    )
  }

  if (loadError || !projectId || !taskId || !project || !task || !session) {
    return (
      <section className="page">
        <Alert tone="error">{loadError || 'Task details are unavailable.'}</Alert>
        <Link className="text-link" to={projectId ? `/projects/${projectId}/tasks` : '/projects'}>
          Back to tasks
        </Link>
      </section>
    )
  }

  const canManageTasks = session.user.role === 'project_manager'
    && project.project_lead_user?.email === session.user.email
  const canComment = canManageTasks || session.user.role === 'team_member'
  const currentProjectId = projectId
  const currentTask = task
  const currentSession = session

  async function handleStatusChange(status: TaskStatus) {
    setIsUpdatingStatus(true)
    setErrorMessage(null)
    try {
      const updatedTask = await updateProjectTaskStatus(
        currentProjectId,
        currentTask.id,
        currentSession.session_id,
        { status },
      )
      setTask(updatedTask)
      setSuccessMessage('Task status updated successfully.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    setErrorMessage(null)
    try {
      await deleteProjectTask(currentProjectId, currentTask.id, currentSession.session_id)
      navigate(`/projects/${currentProjectId}/tasks`, { replace: true })
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setIsDeleting(false)
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = commentText.trim()
    if (!content) {
      setCommentError('Comment cannot be empty.')
      return
    }

    setIsPostingComment(true)
    setCommentError(null)
    try {
      const comment = await createTaskComment(
        currentProjectId,
        currentTask.id,
        currentSession.session_id,
        { content },
      )
      setComments((current) => [...current, comment])
      setCommentText('')
      setSuccessMessage('Comment posted successfully.')
    } catch (error) {
      setCommentError(getErrorMessage(error))
    } finally {
      setIsPostingComment(false)
    }
  }

  return (
    <section className="page">
      <div className="project-details-heading">
        <div>
          <Link className="text-link project-back-link" to={`/projects/${projectId}/tasks`}>← Task board</Link>
          <p className="eyebrow">{project.project.name}</p>
          <h2>{task.title}<span className="heading-dot">.</span></h2>
        </div>
        {canManageTasks && (
          <div className="task-detail-actions">
            <Button type="button" variant="secondary" onClick={() => setIsEditOpen(true)}>Edit task</Button>
            <Button type="button" variant="danger" onClick={() => setIsDeleteOpen(true)}>Delete task</Button>
          </div>
        )}
      </div>

      {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
      {successMessage && <Alert tone="success">{successMessage}</Alert>}

      <div className="task-detail-grid">
        <article className="task-detail-card task-detail-description pastel-pink">
          <span className="panel-kicker">Task brief</span>
          <h3>Description</h3>
          <p>{task.description || 'No description provided.'}</p>
        </article>

        <article className="task-detail-card pastel-blue">
          <span className="panel-kicker">Progress</span>
          <h3>Status</h3>
          {canComment ? (
            <Select
              label="Task status"
              onChange={(value) => handleStatusChange(value)}
              options={statusOptions}
              value={task.status}
              disabled={isUpdatingStatus}
            />
          ) : (
            <Badge tone="info">{task.status}</Badge>
          )}
        </article>

        <article className="task-detail-card pastel-yellow">
          <span className="panel-kicker">Planning</span>
          <div className="task-detail-metadata">
            <div><span>Priority</span><Badge tone={getPriorityTone(task.priority)}>{task.priority}</Badge></div>
            <div><span>Deadline</span><strong>{formatDate(task.deadline)}</strong></div>
            <div><span>Assignee</span><strong>{task.assigned_to_user?.name || task.assigned_to_user?.email || (task.assigned_to ? 'Former member' : 'Unassigned')}{task.assigned_to_user && <small> · {task.assigned_to_user.email}</small>}</strong></div>
          </div>
        </article>

        <article className="task-detail-card pastel-mint task-comments-card">
          <div className="task-comments-heading">
            <div><span className="panel-kicker">Conversation</span><h3>Comments</h3></div>
            <Badge tone="success">{comments.length}</Badge>
          </div>
          {commentError && <Alert tone="error">{commentError}</Alert>}
          {canComment ? (
            <>
              {isLoadingComments ? (
                <div className="projects-status compact-status" role="status">
                  <Spinner label="Loading comments" />
                  <p>Loading comments…</p>
                </div>
              ) : comments.length > 0 ? (
                <ul className="task-comment-list">
                  {comments.map((comment) => (
                    <li key={comment.id}>
                      <p>{comment.content}</p>
                      <small>{comment.author?.name || comment.author?.email || 'Former member'}{comment.author?.email && ` (${comment.author.email})`} · {formatTimestamp(comment.created_at)}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon="○" title="No comments yet" description="Start the conversation about this task." />
              )}
              <form className="comment-form" onSubmit={handleCommentSubmit}>
                <label className="form-label" htmlFor="task-comment">Add a comment</label>
                <textarea
                  className="ui-textarea"
                  id="task-comment"
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="Share an update or question"
                  rows={3}
                  value={commentText}
                />
                <Button loading={isPostingComment} type="submit">Post comment</Button>
              </form>
            </>
          ) : (
            <p className="task-detail-muted">Comments are available to project members.</p>
          )}
        </article>
      </div>

      {session && (
        <TaskFormModal
          key={isEditOpen ? `edit-open-${task.id}` : `edit-closed-${task.id}`}
          onClose={() => setIsEditOpen(false)}
          onSaved={(updatedTask) => {
            setTask(updatedTask)
            setSuccessMessage('Task updated successfully.')
            setIsEditOpen(false)
          }}
          open={isEditOpen}
          projectId={projectId}
          sessionId={session.session_id}
          task={task}
        />
      )}

      <Modal open={isDeleteOpen} title="Delete task?" onClose={() => !isDeleting && setIsDeleteOpen(false)}>
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
        <p className="page-description">
          Delete <strong>{task.title}</strong> and its comments? This action cannot be undone.
        </p>
        <div className="admin-form-actions">
          <Button disabled={isDeleting} type="button" variant="secondary" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button loading={isDeleting} type="button" variant="danger" onClick={handleDelete}>Delete task</Button>
        </div>
      </Modal>
    </section>
  )
}
