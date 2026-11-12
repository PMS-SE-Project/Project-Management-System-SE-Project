import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteProject, getProject } from '../api/projects'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/ui/Alert'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { ProjectMembership } from '../components/tasks/ProjectMembership'
import { EditProjectModal } from '../components/projects/EditProjectModal'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import type { ProjectDetailResponse } from '../types/project'
import './Management.css'

function formatStatus(status: string | null | undefined) {
  return status?.replaceAll('_', ' ') || 'Not specified'
}

function getStatusTone(status: string | null | undefined): BadgeTone {
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
  const navigate = useNavigate()
  const { session } = useAuth()
  const [details, setDetails] = useState<ProjectDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!projectId || !session) return

    const controller = new AbortController()

    getProject(projectId, session.session_id, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setDetails(response)
        setErrorMessage(null)
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
  const canManage = session?.user.role === 'project_manager' && projectLead?.email === session.user.email

  async function handleDelete() {
    if (!session || deleting) return
    setDeleting(true)
    setActionError(null)
    try {
      await deleteProject(project.id, session.session_id)
      navigate('/projects', { replace: true, state: { notice: `Project “${project.name}” deleted.` } })
    } catch (reason) { setActionError(getErrorMessage(reason)); setDeleting(false) }
  }

  return (
    <section className="page">
      <div className="project-details-heading">
        <div>
          <Link className="text-link project-back-link" to="/projects">← All projects</Link>
          <p className="eyebrow">Project overview</p>
          <h2>{project.name}<span className="heading-dot">.</span></h2>
          <Badge tone={getStatusTone(project.status)}>{formatStatus(project.status)}</Badge>
        </div>
        <div className="task-detail-actions">
          {canManage && <><Button type="button" variant="secondary" onClick={() => setEditing(true)}>Edit Project</Button><Button type="button" variant="danger" onClick={() => { setActionError(null); setConfirmDelete(true) }}>Delete Project</Button></>}
        <Link className="ui-button ui-button-primary" to={`/projects/${project.id}/tasks`}>
          View tasks →
        </Link>
        </div>
      </div>

      {success && <Alert tone="success">{success}</Alert>}

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
                  <span><strong>{member.name || member.email}</strong><small>{member.email} · {member.role.replaceAll('_', ' ')}</small></span>
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
          {session?.user.role === 'project_manager' && projectLead?.email === session.user.email && (
            <ProjectMembership key={project.id} projectId={project.id} sessionId={session.session_id} members={members}
              onChanged={async () => setDetails(await getProject(project.id, session.session_id))} />
          )}
        </article>
      </div>
      {editing && canManage && session && <EditProjectModal key={project.id} project={project} sessionId={session.session_id}
        onClose={() => setEditing(false)} onSaved={(saved) => {
          setEditing(false)
          if (saved.project_lead !== project.project_lead) {
            navigate('/projects', { replace: true, state: { notice: `Project “${saved.name}” updated. Access now follows the selected project lead.` } })
          } else { setDetails({ ...details, project: saved }); setSuccess('Project updated successfully.') }
        }} />}
      <Modal open={confirmDelete} title="Delete project?" onClose={() => { if (!deleting) setConfirmDelete(false) }}>
        <p>Delete <strong>{project.name}</strong>? This permanently deletes this project, its tasks, task comments and project memberships. User accounts and other projects are preserved.</p>
        {actionError && <Alert tone="error">{actionError}</Alert>}
        <div className="admin-form-actions"><Button type="button" variant="secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</Button><Button type="button" variant="danger" loading={deleting} onClick={handleDelete}>Delete project</Button></div>
      </Modal>
    </section>
  )
}
