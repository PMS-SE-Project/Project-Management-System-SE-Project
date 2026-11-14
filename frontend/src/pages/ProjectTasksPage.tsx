import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProject } from '../api/projects'
import { getProjectTasks, updateProjectTaskStatus } from '../api/tasks'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { TaskFormModal } from '../components/tasks/TaskFormModal'
import { Alert } from '../components/ui/Alert'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import type { ProjectDetailResponse } from '../types/project'
import type { Task, TaskPriority, TaskStatus } from '../types/task'
import { TASK_STATUSES } from '../types/task'

const columns = TASK_STATUSES

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

function TaskCard({
  isUpdating,
  canUpdateStatus,
  onStatusChange,
  task,
}: {
  task: Task
  isUpdating: boolean
  canUpdateStatus: boolean
  onStatusChange: (status: TaskStatus) => void
}) {
  const assignee = task.assigned_to_user
  return (
    <article className="task-card-shell" draggable={canUpdateStatus && !isUpdating}
      onDragStart={(event) => { event.dataTransfer.setData('text/plain', task.id); event.dataTransfer.effectAllowed = 'move' }}>
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
          <span>{assignee?.name || assignee?.email || (task.assigned_to ? 'Former member' : 'Unassigned')}{assignee && <small> · {assignee.email}</small>}</span>
        </div>
      </Link>
      {canUpdateStatus && (
        <select
          aria-label={`Update status for ${task.title}`}
          className="ui-select task-card-status"
          disabled={isUpdating}
          onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
          value={task.status}
        >
          {columns.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      )}
    </article>
  )
}

export function ProjectTasksPage() {
  const { projectId } = useParams()
  const { session } = useAuth()
  const [project, setProject] = useState<ProjectDetailResponse | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !session) return

    const controller = new AbortController()
    Promise.all([
      getProject(projectId, session.session_id, controller.signal),
      getProjectTasks(projectId, session.session_id, controller.signal),
    ])
      .then(([loadedProject, loadedTasks]) => {
        if (controller.signal.aborted) return
        setProject(loadedProject)
        setLoadError(null)
        setErrorMessage(null)
        setTasks(loadedTasks)
        setLoadedProjectId(projectId)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(getErrorMessage(error))
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

  if (loadError || !projectId || !project) {
    return (
      <section className="page">
        <Alert tone="error">{loadError || 'Tasks are unavailable.'}</Alert>
        <Link className="text-link" to="/projects">Back to projects</Link>
      </section>
    )
  }

  const canManageTasks = session?.user.role === 'project_manager'
    && project.project_lead_user?.email === session.user.email
  const canUpdateStatus = session?.user.role === 'team_member' || canManageTasks

  function handleCreated(task: Task) {
    setTasks((current) => [...current, task])
    setSuccessMessage('Task created successfully.')
    setIsCreateOpen(false)
  }

  async function handleStatusChange(task: Task, status: TaskStatus) {
    if (!session || updatingTaskId || task.status === status) return
    setUpdatingTaskId(task.id)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const updatedTask = await updateProjectTaskStatus(
        task.project_id,
        task.id,
        session.session_id,
        { status },
      )
      setTasks((current) => current.map((item) => item.id === updatedTask.id ? updatedTask : item))
      setSuccessMessage('Task status updated successfully.')
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setUpdatingTaskId(null)
    }
  }

  return (
    <section className="page">
      <div className="project-details-heading">
        <div>
          <Link className="text-link project-back-link" to={`/projects/${projectId}`}>← {project.project.name}</Link>
          <p className="eyebrow">Project workspace</p>
          <h2>Task board<span className="heading-dot">.</span></h2>
        </div>
        {canManageTasks && (
          <Button type="button" onClick={() => setIsCreateOpen(true)}>Create task</Button>
        )}
      </div>

      {successMessage && <Alert tone="success">{successMessage}</Alert>}
      {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
      {canUpdateStatus && tasks.length > 0 && <p className="panel-footnote">Drag tasks between columns, or use each task’s status selector.</p>}

      {tasks.length === 0 ? (
        <EmptyState
          icon="✓"
          title="No tasks yet"
          description={canManageTasks ? 'Create the first task for this project.' : 'Tasks for this project will appear here when they are created.'}
          action={canManageTasks ? <Button type="button" onClick={() => setIsCreateOpen(true)}>Create task</Button> : undefined}
        />
      ) : (
        <div className="kanban-board">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column)
            return (
              <section className={`kanban-column kanban-${column.toLowerCase().replace(' ', '-')}`} key={column}
                onDragOver={(event) => { if (canUpdateStatus && !updatingTaskId) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!canUpdateStatus || updatingTaskId) return
                  const task = tasks.find((item) => item.id === event.dataTransfer.getData('text/plain'))
                  if (task) void handleStatusChange(task, column)
                }}>
                <div className="kanban-column-heading">
                  <div><span className="panel-kicker">Status</span><h3>{column}</h3></div>
                  <Badge tone="neutral">{columnTasks.length}</Badge>
                </div>
                <div className="kanban-task-list">
                  {columnTasks.length > 0 ? columnTasks.map((task) => (
                    <TaskCard
                      canUpdateStatus={canUpdateStatus}
                      isUpdating={Boolean(updatingTaskId)}
                      key={task.id}
                      onStatusChange={(status) => handleStatusChange(task, status)}
                      task={task}
                    />
                  )) : (
                    <p className="kanban-empty">No tasks here yet.</p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {session && (
        <TaskFormModal
          key={`${projectId}-${isCreateOpen ? 'create-open' : 'create-closed'}`}
          onClose={() => setIsCreateOpen(false)}
          onSaved={handleCreated}
          open={isCreateOpen}
          projectId={projectId}
          sessionId={session.session_id}
        />
      )}
    </section>
  )
}
