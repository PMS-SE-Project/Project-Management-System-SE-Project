import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { getProjects } from '../api/projects'
import { getProjectTasks } from '../api/tasks'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import type { ProjectSummary } from '../types/project'
import type { Task } from '../types/task'
import { dashboardTasksForUser, summarizeDashboard } from '../utils/dashboard'

interface DashboardData {
  sessionId: string
  projects: ProjectSummary[]
  tasks: Task[]
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have access to this workspace overview.'
    if (error.status === 0) return 'Unable to reach the ProjectHub API. Check your connection and try again.'
    return error.backendMessage
  }
  return 'Could not load the workspace overview. Please try again.'
}

function displayDate(value: string | null | undefined) {
  if (!value) return 'No deadline'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'No deadline' : date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function DashboardPage() {
  const { session } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [weekday] = useState(() => new Date().toLocaleDateString(undefined, { weekday: 'long' }))

  useEffect(() => {
    if (!session) return
    const currentSession = session
    const controller = new AbortController()
    async function load() {
      try {
        const projects = await getProjects(currentSession.session_id, controller.signal)
        const taskLists = await Promise.all(projects.map((project) => getProjectTasks(project.id, currentSession.session_id, controller.signal)))
        if (controller.signal.aborted) return
        const tasks = taskLists.flat()
        setData({ sessionId: currentSession.session_id, projects, tasks })
        setError(null)
      } catch (reason) {
        if (!controller.signal.aborted) setError(errorMessage(reason))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [session, revision])

  if (!session) return <section className="page"><Alert tone="error">Sign in to view your dashboard.</Alert></section>
  if (loading || (!error && data?.sessionId !== session.session_id)) return (
    <section className="page"><div className="projects-status" role="status"><Spinner label="Loading dashboard" /><p>Loading your workspace…</p></div></section>
  )
  if (error || !data) return (
    <section className="page"><Alert tone="error">{error || 'Workspace data is unavailable.'}</Alert>
      <Button onClick={() => { setLoading(true); setError(null); setRevision((value) => value + 1) }}>Try again</Button>
    </section>
  )

  const { projects, tasks: accessibleTasks } = data
  const tasks = dashboardTasksForUser(accessibleTasks, session.user.role, session.user.email)
  const summary = summarizeDashboard(projects, tasks, session.user.email)
  const { completed, pending, progress } = summary
  const scope = session.user.role === 'admin' ? 'Workspace overview'
    : session.user.role === 'project_manager' ? 'Managed projects' : 'My projects and assigned tasks'
  const upcoming = [...pending].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).slice(0, 5)

  return (
    <section className="page">
      <div className="dashboard-intro">
        <div><p className="eyebrow">{weekday}, {scope.toLowerCase()}</p>
          <h2>Make room for good work<span className="heading-dot">.</span></h2>
          <p className="page-description">{session.user.role === 'team_member' ? 'Progress and deadlines for your assigned work.' : 'Project activity and task progress across your accessible projects.'}</p></div>
        <Badge tone="info">{scope}</Badge>
      </div>
      <div className="dashboard-grid">
        <Card className="welcome-panel pastel-pink">
          <div className="panel-kicker">Your project space</div>
          <h3>{projects.length ? `${projects.length} accessible project${projects.length === 1 ? '' : 's'}.` : 'No projects assigned yet.'}</h3>
          <p>{projects.length ? `${tasks.length} ${session.user.role === 'team_member' ? 'assigned tasks' : 'tasks'} across these projects.` : 'Projects will appear here when you have access to them.'}</p>
          <p>{summary.totalProjects} total projects · {summary.inProgress} tasks in progress · {summary.assigned.length} tasks assigned to you.</p>
          <Link className="text-link" to="/projects">View projects →</Link>
        </Card>
        <Card className="progress-panel pastel-yellow">
          <div className="panel-heading"><div><span className="panel-kicker">Task progress</span><h3>{completed} of {tasks.length} completed</h3></div>
            <span className="progress-ring">{progress}%</span></div>
          <div className="progress-track" role="progressbar" aria-label="Completed tasks" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
          <p className="panel-footnote">{tasks.length ? 'Based on completed tasks.' : 'No tasks available in this overview yet.'}</p>
        </Card>
        <Card className="metric-card pastel-blue"><span className="metric-label">Active projects</span><strong className="metric-value">{summary.activeProjects}</strong><Badge tone="info">Accessible to you</Badge></Card>
        <Card className="metric-card pastel-mint"><span className="metric-label">Pending tasks</span><strong className="metric-value">{pending.length}</strong><Badge tone="warning">To Do and In Progress</Badge></Card>
        <Card className="metric-card pastel-neutral"><span className="metric-label">Completed tasks</span><strong className="metric-value">{completed}</strong><Badge tone="success">Completed</Badge></Card>
        <Card className="activity-panel">
          <div className="section-heading"><div><span className="panel-kicker">Projects</span><h3>Project progress</h3></div></div>
          {projects.length ? <ul className="project-member-list">{projects.map((project) => {
            const projectTasks = accessibleTasks.filter((task) => task.project_id === project.id)
            const done = projectTasks.filter((task) => task.status === 'Completed').length
            return <li key={project.id}><span><Link className="text-link" to={`/projects/${project.id}`}>{project.name}</Link><small>{done} / {projectTasks.length} project tasks completed · Target: {displayDate(project.target_end_date)}</small></span><Badge tone="info">{projectTasks.length ? Math.round(done / projectTasks.length * 100) : 0}%</Badge></li>
          })}</ul> : <p>No accessible projects yet.</p>}
        </Card>
        <Card className="tasks-panel pastel-neutral">
          <div className="section-heading"><div><span className="panel-kicker">Focus list</span><h3>Tasks and deadlines</h3></div></div>
          {upcoming.length ? <ul className="project-member-list">{upcoming.map((task) => <li key={task.id}><span><Link className="text-link" to={`/projects/${task.project_id}/tasks/${task.id}`}>{task.title}</Link><small>{task.status} · {task.priority} priority · {displayDate(task.deadline)}</small></span></li>)}</ul> : <p>No pending tasks.</p>}
          <h4>Assigned to you</h4>
          {summary.assigned.length ? <ul className="project-member-list">{summary.assigned.map((task) => <li key={task.id}><span><Link className="text-link" to={`/projects/${task.project_id}/tasks/${task.id}`}>{task.title}</Link><small>{task.status} · {displayDate(task.deadline)}</small></span></li>)}</ul> : <p>No tasks assigned to you.</p>}
        </Card>
      </div>
    </section>
  )
}
