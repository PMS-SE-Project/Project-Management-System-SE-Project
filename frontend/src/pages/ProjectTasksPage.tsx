import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProjectTasks } from '../api/tasks'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/ui/Alert'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import type { Task, TaskPriority, TaskStatus } from '../types/task'

const columns: TaskStatus[] = ['To Do', 'In Progress', 'Completed']

function getPriorityTone(priority: TaskPriority): BadgeTone {
  if (priority === 'high') return 'danger'
  if (priority === 'medium') return 'warning'
  return 'success'
}

function formatDate(value: string | null) {
  if (!value) return 'No deadline'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have access to tasks for this project.'
    if (error.status === 404) return 'This project could not be found.'
    if (error.status === 0) return 'The ProjectHub API is unavailable. Check your connection and try again.'
    return error.backendMessage
  }
  return 'We could not load the project tasks. Please try again.'
}

function TaskCard({ task }: { task: Task }) {
  const assignee = task.assigned_to_user
  return (
    <Link className="task-card" to={`/projects/${task.project_id}/tasks/${task.id}`}>
      <div className="task-card-heading">
        <Badge tone={getPriorityTone(task.priority)}>{task.priority} priority</Badge>
        <span className="task-deadline">{formatDate(task.deadline)}</span>
      </div>
      <h3>{task.title}</h3>
      <p>{task.description || 'No description provided.'}</p>
      <div className="task-assignee">
        <span className="member-avatar" aria-hidden="true">
          {assignee ? (assignee.name || assignee.email).charAt(0).toUpperCase() : '—'}
        </span>
        <span>{assignee?.name || assignee?.email || 'Unassigned'}</span>
      </div>
    </Link>
  )
}

export function ProjectTasksPage() {
  const { projectId } = useParams()
  const { session } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !session) return

    const controller = new AbortController()

    getProjectTasks(projectId, session.session_id, controller.signal)
      .then((loadedTasks) => {
        if (controller.signal.aborted) return
        setTasks(loadedTasks)
        setLoadedProjectId(projectId)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setErrorMessage(getErrorMessage(error))
        setLoadedProjectId(projectId)
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [projectId, session])

  if (isLoading || loadedProjectId !== projectId) {
    return (
      <section className="page">
        <div className="projects-status" role="status">
          <Spinner label="Loading tasks" size="large" />
          <p>Loading the task board…</p>
        </div>
      </section>
    )
  }

  if (errorMessage || !projectId) {
    return (
      <section className="page">
        <Alert tone="error">{errorMessage || 'Tasks are unavailable.'}</Alert>
        <Link className="text-link" to="/projects">Back to projects</Link>
      </section>
    )
  }

  return (
    <section className="page">
      <div className="project-details-heading">
        <div>
          <Link className="text-link project-back-link" to={`/projects/${projectId}`}>← Project overview</Link>
          <p className="eyebrow">Project workspace</p>
          <h2>Task board<span className="heading-dot">.</span></h2>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon="✓"
          title="No tasks yet"
          description="Tasks for this project will appear here when they are created."
        />
      ) : (
        <div className="kanban-board">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column)
            return (
              <section className={`kanban-column kanban-${column.toLowerCase().replace(' ', '-')}`} key={column}>
                <div className="kanban-column-heading">
                  <div><span className="panel-kicker">Status</span><h3>{column}</h3></div>
                  <Badge tone="neutral">{columnTasks.length}</Badge>
                </div>
                <div className="kanban-task-list">
                  {columnTasks.length > 0 ? columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  )) : (
                    <p className="kanban-empty">No tasks here yet.</p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </section>
  )
}
