import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getEligibleProjectLeads, updateProject } from '../../api/projects'
import { ApiError } from '../../api/client'
import type { EligibleLeadsResponse, Project, ProjectStatus, ProjectUpdate } from '../../types/project'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'

export function EditProjectModal({ project, sessionId, onClose, onSaved }: {
  project: Project
  sessionId: string
  onClose: () => void
  onSaved: (project: Project) => void
}) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description || '')
  const [target, setTarget] = useState(project.target_end_date?.slice(0, 10) || '')
  const [status, setStatus] = useState(project.status || 'active')
  const [lead, setLead] = useState(project.project_lead || '')
  const [leads, setLeads] = useState<EligibleLeadsResponse['eligible_leads']>([])
  const [loading, setLoading] = useState(true)
  const [leadError, setLeadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const submitting = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    getEligibleProjectLeads(sessionId, controller.signal)
      .then((users) => { if (!controller.signal.aborted) { setLeads(users); setLeadError(null) } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setLeadError(reason instanceof ApiError ? reason.backendMessage : 'Could not load project leads.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [sessionId, revision])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    if (name.trim().length < 2 || name.trim().length > 100) { setError('Project name must contain 2–100 characters.'); return }
    if (description.length > 500) { setError('Description must contain no more than 500 characters.'); return }
    if (target && project.start_date && target <= project.start_date.slice(0, 10)) { setError('Target end date must be later than the project start date.'); return }
    const changes: ProjectUpdate = { name: name.trim(), description: description.trim() || null, status: status as ProjectStatus }
    if (target !== (project.target_end_date?.slice(0, 10) || '')) changes.target_end_date = target || null
    if (lead !== (project.project_lead || '')) changes.project_lead = lead || null
    submitting.current = true
    setSaving(true)
    setError(null)
    try { onSaved(await updateProject(project.id, sessionId, changes)) }
    catch (reason) { setError(reason instanceof ApiError ? reason.backendMessage : 'Could not save the project. Please try again.') }
    finally { submitting.current = false; setSaving(false) }
  }

  return <Modal open title="Edit project" onClose={() => { if (!submitting.current) onClose() }}>
    <form className="task-form" onSubmit={submit}>
      {error && <Alert tone="error">{error}</Alert>}
      <Input label="Project name" required minLength={2} maxLength={100} value={name} disabled={saving} onChange={(event) => setName(event.target.value)} />
      <div className="form-field"><label className="form-label" htmlFor="edit-project-description">Description</label>
        <textarea id="edit-project-description" className="ui-textarea" rows={4} maxLength={500} value={description} disabled={saving} onChange={(event) => setDescription(event.target.value)} /></div>
      <Input label="Target date" type="date" value={target} disabled={saving} onChange={(event) => setTarget(event.target.value)} />
      <Select label="Status" value={status} disabled={saving} onChange={setStatus} options={[
        { value: 'active', label: 'Active' }, { value: 'on_hold', label: 'On hold' }, { value: 'completed', label: 'Completed' },
      ]} />
      <Select label="Project lead" value={lead} disabled={saving || loading || Boolean(leadError)} onChange={setLead} options={[
        { value: '', label: loading ? 'Loading leads…' : 'No lead assigned' },
        ...(project.project_lead && !leads.some((user) => user.id === project.project_lead) ? [{ value: project.project_lead, label: 'Current lead (unavailable)', disabled: true }] : []),
        ...leads.map((user) => ({ value: user.id, label: `${user.name || user.email} (${user.email})` })),
      ]} />
      {leadError && <><Alert tone="error">{leadError}</Alert><Button type="button" variant="secondary" onClick={() => { setLoading(true); setRevision((value) => value + 1) }}>Retry lead list</Button></>}
      {lead !== (project.project_lead || '') && <Alert tone="warning">Changing or clearing the project lead may remove your access to this project. Existing memberships remain unchanged.</Alert>}
      <div className="admin-form-actions"><Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button loading={saving} type="submit">Save changes</Button></div>
    </form>
  </Modal>
}
