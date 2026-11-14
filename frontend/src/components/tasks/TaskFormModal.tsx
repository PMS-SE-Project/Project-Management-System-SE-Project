import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getProjectMembers } from '../../api/projects'
import { createProjectTask, updateProjectTask } from '../../api/tasks'
import { ApiError } from '../../api/client'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { TASK_STATUS_OPTIONS, type Task, type TaskCreate, type TaskPriority, type TaskStatus } from '../../types/task'

interface TaskFormValues {
  title: string
  description: string
  assignedTo: string
  priority: TaskPriority
  deadline: string
  status: TaskStatus
}

interface TaskFormModalProps {
  open: boolean
  projectId: string
  sessionId: string
  task?: Task
  onClose: () => void
  onSaved: (task: Task) => void
}

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const

function getInitialValues(task?: Task): TaskFormValues {
  return {
    title: task?.title || '',
    description: task?.description || '',
    assignedTo: task?.assigned_to || '',
    priority: task?.priority || 'medium',
    deadline: task?.deadline || '',
    status: task?.status || 'To Do',
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have permission to manage this task.'
    if (error.status === 404) return 'The task or assignee could not be found.'
    if (error.status === 409) return error.backendMessage
    if (error.status === 0) return 'The ProjectHub API is unavailable. Try again.'
    return error.backendMessage
  }
  return 'We could not save this task. Please try again.'
}

function getMemberErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have permission to view project members.'
    if (error.status === 404) return 'This project could not be found.'
    if (error.status === 0) return 'The ProjectHub API is unavailable. Try again.'
    return error.backendMessage
  }
  return 'We could not load eligible project members. Try again.'
}

export function TaskFormModal({
  onClose,
  onSaved,
  open,
  projectId,
  sessionId,
  task,
}: TaskFormModalProps) {
  const [values, setValues] = useState(() => getInitialValues(task))
  const [titleError, setTitleError] = useState<string | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [members, setMembers] = useState<Awaited<ReturnType<typeof getProjectMembers>>>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(open)
  const [membersError, setMembersError] = useState<string | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    getProjectMembers(projectId, sessionId, controller.signal)
      .then((loadedMembers) => {
        if (!controller.signal.aborted) setMembers(loadedMembers)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setMembersError(getMemberErrorMessage(error))
        setMembers([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingMembers(false)
      })

    return () => controller.abort()
  }, [open, projectId, sessionId])

  function updateValue(field: keyof TaskFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    if (field === 'title') setTitleError(undefined)
    setErrorMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const title = values.title.trim()
    if (!title || title.length > 200) {
      setTitleError('Task title must contain 1–200 characters.')
      return
    }
    if (values.description.length > 2000) { setErrorMessage('Description cannot exceed 2000 characters.'); return }
    if (values.deadline && values.deadline !== task?.deadline && values.deadline < new Date().toISOString().slice(0, 10)) {
      setErrorMessage('Deadline cannot be earlier than today (UTC).'); return
    }

    submitting.current = true
    setIsSaving(true)
    setErrorMessage(null)
    const payload: TaskCreate = {
      title,
      description: values.description.trim() || null,
      assigned_to: values.assignedTo || null,
      priority: values.priority,
      deadline: values.deadline || null,
      status: values.status,
    }
    // Omitted fields stay unchanged. Revalidating an old deadline or a former
    // project member would otherwise prevent editing an unrelated field.
    if (task) {
      if (payload.assigned_to === task.assigned_to) delete payload.assigned_to
      if (payload.deadline === task.deadline) delete payload.deadline
    }

    try {
      const savedTask = task
        ? await updateProjectTask(projectId, task.id, sessionId, payload)
        : await createProjectTask(projectId, sessionId, payload)
      onSaved(savedTask)
      onClose()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      submitting.current = false
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={task ? 'Edit task' : 'Create task'}
      onClose={() => !submitting.current && onClose()}
    >
      <form className="task-form" onSubmit={handleSubmit} noValidate>
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
        <Input
          error={titleError}
          label="Task title"
          onChange={(event) => updateValue('title', event.target.value)}
          value={values.title}
          maxLength={200}
          disabled={isSaving}
          required
        />
        <div className="form-field">
          <label className="form-label" htmlFor="task-description">Description</label>
          <textarea
            className="ui-textarea"
            id="task-description"
            onChange={(event) => updateValue('description', event.target.value)}
            rows={4}
            value={values.description}
            maxLength={2000}
            disabled={isSaving}
          />
        </div>
        <Select
          label="Assignee"
          onChange={(value) => updateValue('assignedTo', value)}
          options={isLoadingMembers
            ? [{ value: '', label: 'Loading members…', disabled: true }]
            : membersError
              ? [{ value: '', label: 'Unable to load members', disabled: true }]
              : [
                  {
                    value: '',
                    label: 'Unassigned',
                  },
                  ...(task?.assigned_to && !members.some((member) => member.id === task.assigned_to)
                    ? [{ value: task.assigned_to, label: `${task.assigned_to_user?.name || task.assigned_to_user?.email || 'Previous assignee'} (no longer eligible)`, disabled: true }]
                    : []),
                  ...members.map((member) => ({
                    value: member.id,
                    label: `${member.name || member.email} (${member.email})`,
                  })),
                ]}
          value={values.assignedTo}
          disabled={isSaving || isLoadingMembers || Boolean(membersError)}
        />
        {membersError && <Alert tone="error">{membersError}</Alert>}
        {!isLoadingMembers && !membersError && members.length === 0 && (
          <p className="panel-footnote">No eligible active team members are assigned to this project. The assigned project manager can add members from the project overview.</p>
        )}
        <div className="task-form-row">
          <Select label={task ? 'Status' : 'Initial status'} value={values.status} onChange={(value) => updateValue('status', value)} options={TASK_STATUS_OPTIONS} disabled={isSaving} />
          <Select
            label="Priority"
            onChange={(value) => updateValue('priority', value)}
            options={priorityOptions}
            value={values.priority}
            disabled={isSaving}
          />
          <Input
            label="Deadline"
            onChange={(event) => updateValue('deadline', event.target.value)}
            type="date"
            value={values.deadline}
            disabled={isSaving}
          />
        </div>
        <div className="admin-form-actions">
          <Button type="button" variant="secondary" disabled={isSaving} onClick={onClose}>Cancel</Button>
          <Button loading={isSaving} type="submit">{task ? 'Save changes' : 'Create task'}</Button>
        </div>
      </form>
    </Modal>
  )
}
