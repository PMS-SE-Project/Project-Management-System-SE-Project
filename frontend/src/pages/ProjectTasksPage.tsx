import { Link, useParams } from 'react-router-dom'

export function ProjectTasksPage() {
  const { projectId } = useParams()
  return (
    <section className="page">
      <p className="eyebrow">Project {projectId}</p>
      <h2>Tasks</h2>
      <p className="page-description">Task tracking for this project will be implemented later.</p>
      <Link className="text-link" to={`/projects/${projectId}/tasks/example-task`}>Open example task →</Link>
    </section>
  )
}
