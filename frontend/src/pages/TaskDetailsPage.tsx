import { useParams } from 'react-router-dom'

export function TaskDetailsPage() {
  const { projectId, taskId } = useParams()
  return (
    <section className="page">
      <p className="eyebrow">Project {projectId}</p>
      <h2>Task details</h2>
      <p className="page-description">Details for task <strong>{taskId}</strong> will be implemented later.</p>
    </section>
  )
}
