import { Link } from 'react-router-dom'

export function TaskDetailsPage() {
  return (
    <section className="page">
      <p className="eyebrow">Task workspace</p>
      <h2>Task details</h2>
      <p className="page-description">Task detail actions will be implemented in a later commit.</p>
      <Link className="text-link" to="/projects">Back to projects →</Link>
    </section>
  )
}
