import { useEffect, useRef, useState } from 'react'
import { addProjectMember, getEligibleProjectMembers, removeProjectMember } from '../../api/projects'
import { ApiError } from '../../api/client'
import type { EligibleMembersResponse, ProjectMember } from '../../types/project'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import './ProjectMembership.css'

export function ProjectMembership({ projectId, sessionId, members, onChanged }: {
  projectId: string
  sessionId: string
  members: ProjectMember[]
  onChanged: () => Promise<void>
}) {
  const [eligible, setEligible] = useState<EligibleMembersResponse['eligible_members']>([])
  const [selected, setSelected] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<ProjectMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const busy = useRef(false)
  const message = (reason: unknown) => reason instanceof ApiError ? reason.backendMessage : 'Could not update project members. Please refresh the member list.'

  useEffect(() => {
    if (!adding) return
    const controller = new AbortController()
    getEligibleProjectMembers(projectId, sessionId, controller.signal)
      .then((users) => { if (!controller.signal.aborted) { setEligible(users); setLoadError(null) } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setLoadError(message(reason)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [adding, projectId, sessionId, revision])

  async function refresh() {
    await onChanged()
    setRevision((value) => value + 1)
  }

  async function addSelected() {
    if (busy.current || !selected.length) return
    busy.current = true
    setSaving(true)
    setError(null)
    let completed = 0
    try {
      for (const id of selected) {
        await addProjectMember(projectId, sessionId, id)
        completed += 1
        setSelected((current) => current.filter((value) => value !== id))
      }
      setAdding(false)
    } catch (reason) { setError(message(reason)) }
    finally {
      if (completed) {
        setSuccess(`${completed} team member${completed === 1 ? '' : 's'} added.`)
        try { await refresh() } catch { setError('Membership changes were saved, but the member list could not be refreshed. Please refresh members.') }
      }
      busy.current = false
      setSaving(false)
    }
  }

  async function confirmRemoval() {
    if (busy.current || !removing) return
    busy.current = true
    setSaving(true)
    setError(null)
    try {
      await removeProjectMember(projectId, sessionId, removing.id)
      setRemoving(null)
      setSuccess('Team member removed. Existing task assignments were retained for explicit reassignment or unassignment.')
      try { await refresh() } catch { setError('The member was removed, but the list could not be refreshed. Please refresh members.') }
    } catch (reason) { setError(message(reason)) }
    finally { busy.current = false; setSaving(false) }
  }

  return <div className="task-form">
    <h4>Manage project members</h4>
    {success && <Alert tone="success">{success}</Alert>}
    {error && !adding && !removing && <Alert tone="error">{error}</Alert>}
    <div className="task-detail-actions">
      <Button type="button" disabled={saving} onClick={() => { setSelected([]); setError(null); setLoading(true); setAdding(true) }}>Add Team Member</Button>
      <Button type="button" variant="secondary" disabled={saving} onClick={() => { setError(null); void refresh().catch((reason) => setError(message(reason))) }}>Refresh members</Button>
    </div>
    {members.map((member) => <div className="project-team-heading" key={member.id}>
      <span>{member.name || member.email} ({member.email}) · {member.role.replaceAll('_', ' ')}</span>
      <Button type="button" variant="secondary" disabled={saving} onClick={() => { setError(null); setRemoving(member) }}>Remove</Button>
    </div>)}
    <Modal open={adding} title="Add team members" onClose={() => { if (!busy.current) setAdding(false) }}>
      <div className="task-form">
        {error && <Alert tone="error">{error}</Alert>}
        {loadError && <><Alert tone="error">{loadError}</Alert><Button type="button" variant="secondary" onClick={() => { setLoading(true); setRevision((value) => value + 1) }}>Retry eligible members</Button></>}
        {loading ? <Spinner label="Loading eligible members" /> : !loadError && (eligible.length ? <fieldset className="member-selection"><legend>Select active team members</legend>
          {eligible.map((user) => <label className="member-selection-option" key={user.id}>
            <input type="checkbox" disabled={saving} checked={selected.includes(user.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} />
            <span><strong>{user.name || user.email}</strong><small>{user.email}</small></span>
          </label>)}
        </fieldset> : <p>No additional active team members are available.</p>)}
        <div className="admin-form-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => setAdding(false)}>Cancel</Button><Button type="button" disabled={loading || Boolean(loadError) || !selected.length} loading={saving} onClick={addSelected}>Add selected members</Button></div>
      </div>
    </Modal>
    <Modal open={Boolean(removing)} title="Remove team member?" onClose={() => { if (!busy.current) setRemoving(null) }}>
      <p>Remove <strong>{removing?.name || removing?.email}</strong> ({removing?.email}) from this project? They will lose project access. Existing task assignments remain until explicitly reassigned or unassigned.</p>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="admin-form-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => setRemoving(null)}>Cancel</Button><Button type="button" variant="danger" loading={saving} onClick={confirmRemoval}>Remove member</Button></div>
    </Modal>
  </div>
}
