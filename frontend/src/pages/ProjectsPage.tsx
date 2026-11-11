import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'

export function ProjectsPage() {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  return (
    <section className="page">
      <p className="eyebrow">Workspace</p>
      <h2>Projects</h2>
      <p className="page-description">Project listing and creation will be available here.</p>
      <EmptyState
        icon="▦"
        title="No projects to display yet"
        description="Project management features are coming soon."
        action={
          <Button variant="secondary" type="button" onClick={() => setIsPreviewOpen(true)}>
            View workspace guide
          </Button>
        }
      />
      <Modal
        open={isPreviewOpen}
        title="Project workspace"
        onClose={() => setIsPreviewOpen(false)}
      >
        <p className="page-description">
          Project creation, members and task tracking will be added in later commits.
        </p>
        <Button type="button" onClick={() => setIsPreviewOpen(false)}>
          Got it
        </Button>
      </Modal>
    </section>
  )
}
