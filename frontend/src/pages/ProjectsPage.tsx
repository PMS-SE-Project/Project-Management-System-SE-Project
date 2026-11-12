import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getProjects } from '../api/projects'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/ui/Alert'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { CreateProjectModal } from '../components/projects/CreateProjectModal'
import type { Project, ProjectSummary } from '../types/project'
import './ProjectsPage.css'

type ProjectsStatus = 'loading' | 'success' | 'error'

function formatStatus(status: string | null) {
  return status ? status.replaceAll('_', ' ') : 'Not specified'
}

function getStatusTone(status: string | null): BadgeTone {
  if (status === 'active') return 'success'
  if (status === 'on_hold') return 'warning'
  if (status === 'completed') return 'info'
  return 'neutral'
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date)
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have permission to view these projects.'
    if (error.status === 0) return 'The ProjectHub API is unavailable. Check your connection and try again.'
    return error.backendMessage
  }

  return 'We could not load your projects. Please try again.'
}

function ProjectCard({ project, index }: { project: ProjectSummary; index: number }) {
  const accents = ['pastel-pink', 'pastel-blue', 'pastel-mint', 'pastel-yellow']
  const projectLead = project.project_lead_user

  return (
    <Link
      className={`project-card ${accents[index % accents.length]}`}
      to={`/projects/${project.id}`}
    >
      <div className="project-card-topline">
        <span className="panel-kicker">Project</span>
        <Badge tone={getStatusTone(project.status)}>
          {formatStatus(project.status)}
        </Badge>
      </div>
      <h3>{project.name}</h3>
      <p className="project-card-description">
        {project.description || 'No description provided.'}
      </p>
      <div className="project-card-meta">
        <div>
          <span>Project lead</span>
          <strong>{projectLead?.name || projectLead?.email || 'Not assigned'}</strong>
          {projectLead?.name && <small>{projectLead.email}</small>}
        </div>
        <div>
          <span>Target date</span>
          <strong>{formatDate(project.target_end_date)}</strong>
        </div>
      </div>
      <span className="project-card-created">
        Created {formatDate(project.created_at)}
      </span>
    </Link>
  )
}

export function ProjectsPage() {
  const location = useLocation()
  const notice = typeof location.state?.notice === 'string' ? location.state.notice : null
  const { session } = useAuth()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [status, setStatus] = useState<ProjectsStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createdProject, setCreatedProject] = useState<Project | null>(null)
  const canCreate = session?.user.role === 'project_manager'

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    getProjects(session.session_id, controller.signal)
      .then((loadedProjects) => {
        if (controller.signal.aborted) return
        setProjects(loadedProjects)
        setErrorMessage(null)
        setStatus('success')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setErrorMessage(getErrorMessage(error))
        setStatus('error')
      })

    return () => controller.abort()
  }, [retryCount, session])

  function retry() {
    setErrorMessage(null)
    setStatus('loading')
    setRetryCount((count) => count + 1)
  }

  return (
    <section className="page">
      <div className="dashboard-intro projects-intro">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Projects<span className="heading-dot">.</span></h2>
          <p className="page-description">
            A clear view of the projects you are helping move forward.
          </p>
        </div>
        <div className="projects-create-actions">
          <span className="projects-count">
            {status === 'success' ? `${projects.length} project${projects.length === 1 ? '' : 's'}` : 'Your workspace'}
          </span>
          {canCreate && <Button type="button" onClick={() => setIsCreateOpen(true)}>+ Create Project</Button>}
        </div>
      </div>

      {createdProject && <Alert tone="success">Project “{createdProject.name}” created successfully. <Link className="text-link" to={`/projects/${createdProject.id}`}>Open project →</Link></Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {status === 'loading' && (
        <div className="projects-status" role="status">
          <Spinner label="Loading projects" size="large" />
          <p>Loading your projects…</p>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="projects-error">
          <Alert tone="error">{errorMessage}</Alert>
          <Button type="button" variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {status === 'success' && projects.length === 0 && (
        <EmptyState
          icon="▦"
          title="No projects to display"
          description="Projects assigned to your workspace will appear here."
        />
      )}

      {status === 'success' && projects.length > 0 && (
        <div className="projects-grid">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} index={index} project={project} />
          ))}
        </div>
      )}
      {isCreateOpen && canCreate && session && <CreateProjectModal sessionId={session.session_id}
        onClose={() => setIsCreateOpen(false)} onCreated={(project) => {
          setIsCreateOpen(false)
          setCreatedProject(project)
          retry()
        }} />}
    </section>
  )
}
