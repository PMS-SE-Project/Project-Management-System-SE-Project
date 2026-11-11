import { Link, useParams } from 'react-router-dom'

export function ProjectDetailsPage() {
  const { projectId } = useParams()
  return (
    <section className="page">
      <p className="eyebrow">Project</p>
      <h2>Project details</h2>
      <p className="page-description">Details for project <strong>{projectId}</strong> will be implemented later.</p>
      <Link className="text-link" to={`/projects/${projectId}/tasks`}>View project tasks →</Link>
    </section>
  )
}
