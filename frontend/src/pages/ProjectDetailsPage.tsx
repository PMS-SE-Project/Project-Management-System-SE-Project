import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProject } from '../api/projects'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/ui/Alert'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import type { ProjectDetailResponse } from '../types/project'

function formatStatus(status: string) {
  return status.replaceAll('_', ' ')
}

function getStatusTone(status: string): BadgeTone {
  if (status === 'active') return 'success'
  if (status === 'on_hold') return 'warning'
  if (status === 'completed') return 'info'
  return 'neutral'
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have access to this project.'
    if (error.status === 404) return 'This project could not be found.'
    if (error.status === 0) return 'The ProjectHub API is unavailable. Check your connection and try again.'
    return error.backendMessage
  }
  return 'We could not load this project. Please try again.'
}

export function ProjectDetailsPage() {
  const { projectId } = useParams()
  const { session } = useAuth()
  const [details, setDetails] = useState<ProjectDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !session) return

    const controller = new AbortController()

    getProject(projectId, session.session_id, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setDetails(response)
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
          <Spinner label="Loading project" size="large" />
          <p>Loading project details…</p>
        </div>
      </section>
    )
  }

  if (errorMessage || !details) {
    return (
      <section className="page">
        <Alert tone="error">{errorMessage || 'Project details are unavailable.'}</Alert>
        <Link className="ui-button ui-button-secondary project-back-link" to="/projects">
          Back to projects
        </Link>
      </section>
    )
  }

  const { project, project_lead_user: projectLead, members } = details

  return (
    <section className="page">
      <div className="project-details-heading">
        <div>
          <Link className="text-link project-back-link" to="/projects">← All projects</Link>
          <p className="eyebrow">Project overview</p>
          <h2>{project.name}<span className="heading-dot">.</span></h2>
          <Badge tone={getStatusTone(project.status)}>{formatStatus(project.status)}</Badge>
        </div>
        <Link className="ui-button ui-button-primary" to={`/projects/${project.id}/tasks`}>
          View tasks →
        </Link>
      </div>

      <div className="project-details-grid">
        <article className="project-detail-card project-detail-overview pastel-pink">
          <span className="panel-kicker">About this project</span>
          <h3>Project brief</h3>
          <p>{project.description || 'No description provided for this project.'}</p>
        </article>

        <article className="project-detail-card pastel-blue">
          <span className="panel-kicker">Project lead</span>
          {projectLead ? (
            <>
              <h3>{projectLead.name || projectLead.email}</h3>
              <p>{projectLead.email}</p>
              <Badge tone="info">Project manager</Badge>
            </>
          ) : (
            <p className="project-detail-muted">No project lead assigned.</p>
          )}
        </article>

        <article className="project-detail-card pastel-yellow">
          <span className="panel-kicker">Timeline</span>
          <div className="project-date-list">
            <div><span>Created</span><strong>{formatDate(project.created_at)}</strong></div>
            <div><span>Start date</span><strong>{formatDate(project.start_date)}</strong></div>
            <div><span>Target end</span><strong>{formatDate(project.target_end_date)}</strong></div>
          </div>
        </article>

        <article className="project-detail-card pastel-mint project-team-card">
          <div className="project-team-heading">
            <div>
              <span className="panel-kicker">People</span>
              <h3>Team members</h3>
            </div>
            <Badge tone="success">{members.length}</Badge>
          </div>
          {members.length > 0 ? (
            <ul className="project-member-list">
              {members.map((member) => (
                <li key={member.id}>
                  <span className="member-avatar" aria-hidden="true">
                    {(member.name || member.email).charAt(0).toUpperCase()}
                  </span>
                  <span><strong>{member.name || member.email}</strong><small>{member.email}</small></span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="○"
              title="No team members yet"
              description="Team members assigned to this project will appear here."
            />
          )}
        </article>
      </div>
    </section>
  )
}
