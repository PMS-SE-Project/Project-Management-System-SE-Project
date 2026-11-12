import { useRef, useState, type FormEvent } from 'react'
import { createProject } from '../../api/projects'
import { ApiError } from '../../api/client'
import type { Project } from '../../types/project'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

export function CreateProjectModal({ sessionId, onClose, onCreated }: {
  sessionId: string
  onClose: () => void
  onCreated: (project: Project) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState<string>()
  const [descriptionError, setDescriptionError] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const trimmedName = name.trim()
    const invalidName = trimmedName.length < 2 || trimmedName.length > 100
    const invalidDescription = description.length > 500
    setNameError(invalidName ? 'Use a project name between 2 and 100 characters.' : undefined)
    setDescriptionError(invalidDescription ? 'Use no more than 500 characters.' : undefined)
    if (invalidName || invalidDescription) return
    submitting.current = true
    setSaving(true)
    setError(null)
    try {
      const project = await createProject(sessionId, { name: trimmedName, description: description.trim() || null })
      onCreated(project)
    } catch (reason) {
      if (reason instanceof ApiError) {
        if (reason.status === 409) setNameError(reason.backendMessage)
        else if (reason.status === 401) setError('Your session has expired. Please sign in again.')
        else if (reason.status === 403) setError('Only project managers can create projects.')
        else if (reason.status === 0) setError('Unable to reach the ProjectHub API. Check your connection and try again.')
        else setError(reason.backendMessage)
      } else setError('Could not create the project. Please try again.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <Modal open title="Create project" onClose={() => { if (!submitting.current) onClose() }}>
      <form className="task-form" onSubmit={submit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Input label="Project name" value={name} required minLength={2} maxLength={100} error={nameError}
          disabled={saving} onChange={(event) => { setName(event.target.value); setNameError(undefined); setError(null) }} />
        <div className="form-field">
          <label className="form-label" htmlFor="project-description">Description</label>
          <textarea id="project-description" className="ui-textarea" rows={4} maxLength={500} value={description}
            disabled={saving} aria-invalid={Boolean(descriptionError)} aria-describedby={descriptionError ? 'project-description-error' : undefined}
            onChange={(event) => { setDescription(event.target.value); setDescriptionError(undefined); setError(null) }} />
          {descriptionError && <span className="field-error" id="project-description-error">{descriptionError}</span>}
        </div>
        <p className="panel-footnote">You will be assigned as this project’s lead.</p>
        <div className="admin-form-actions">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create project</Button>
        </div>
      </form>
    </Modal>
  )
}
