import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createAdminUser,
  listAllAdminUsers,
  updateAdminUser,
  updateAdminUserStatus,
} from '../api/admin'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/ui/Alert'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Select'
import { Spinner } from '../components/ui/Spinner'
import type {
  AdminUserCreate,
  AdminUserUpdate,
  User,
  UserRole,
} from '../types/user'

const PAGE_SIZE = 10
const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'project_manager', label: 'Project manager' },
  { value: 'team_member', label: 'Team member' },
] as const

type ModalMode = 'create' | 'edit' | null

interface FormValues {
  name: string
  email: string
  password: string
  role: UserRole
}

interface FormErrors {
  name?: string
  email?: string
  password?: string
  role?: string
}

function roleLabel(role: UserRole) {
  return roleOptions.find((option) => option.value === role)?.label || role
}

function roleTone(role: UserRole): BadgeTone {
  if (role === 'admin') return 'danger'
  if (role === 'project_manager') return 'info'
  return 'success'
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your admin session has expired. Please sign in again.'
    if (error.status === 403) return 'You do not have permission to manage users.'
    if (error.status === 404) return 'That user could not be found.'
    if (error.status === 409) return error.backendMessage
    if (error.status === 0) return 'The ProjectHub API is unavailable. Check your connection and try again.'
    return error.backendMessage
  }
  return 'Something went wrong while managing users. Please try again.'
}

function validateForm(values: FormValues, isCreate: boolean): FormErrors {
  const errors: FormErrors = {}
  if (!values.name.trim()) errors.name = 'Name is required.'
  if (!values.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (isCreate && !values.password) errors.password = 'Password is required.'
  return errors
}

function initialValues(user?: User): FormValues {
  return {
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'team_member',
  }
}

function UserStatus({ active }: { active: boolean }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const { session, signOut } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingUser, setEditingUser] = useState<User | undefined>()
  const [formValues, setFormValues] = useState<FormValues>(initialValues())
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [statusUser, setStatusUser] = useState<User | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    listAllAdminUsers(session.session_id, controller.signal)
      .then((loadedUsers) => {
        if (controller.signal.aborted) return
        setUsers(loadedUsers)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setErrorMessage(getErrorMessage(error))
        setIsLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey, session])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users
    return users.filter((user) =>
      [user.name, user.email, user.role].some((value) => value.toLowerCase().includes(query)),
    )
  }, [search, users])

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const visibleUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeUsers = users.filter((user) => user.is_active).length
  const roleCounts = {
    admin: users.filter((user) => user.role === 'admin').length,
    project_manager: users.filter((user) => user.role === 'project_manager').length,
    team_member: users.filter((user) => user.role === 'team_member').length,
  }

  function openCreateModal() {
    setEditingUser(undefined)
    setFormValues(initialValues())
    setFormErrors({})
    setModalMode('create')
  }

  function openEditModal(user: User) {
    setEditingUser(user)
    setFormValues(initialValues(user))
    setFormErrors({})
    setModalMode('edit')
  }

  function closeFormModal() {
    if (isSaving) return
    setModalMode(null)
  }

  function updateField(field: keyof FormValues, value: string) {
    setFormValues((current) => ({ ...current, [field]: value }))
    setFormErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const isCreate = modalMode === 'create'
    const errors = validateForm(formValues, isCreate)
    setFormErrors(errors)
    setErrorMessage(null)
    if (Object.keys(errors).length > 0 || !session) return

    setIsSaving(true)
    try {
      const savedUser = isCreate
        ? await createAdminUser(session.session_id, formValues as AdminUserCreate)
        : await updateAdminUser(session.session_id, editingUser!.id, {
            name: formValues.name.trim(),
            email: formValues.email.trim(),
            role: formValues.role,
          } satisfies AdminUserUpdate)
      setModalMode(null)
      setSuccessMessage(`${savedUser.name} was ${isCreate ? 'created' : 'updated'} successfully.`)
      setReloadKey((key) => key + 1)

      const currentAdminSessionInvalidated = editingUser?.email === session.user.email
        && (formValues.role !== 'admin' || formValues.email.trim() !== editingUser.email)
      if (currentAdminSessionInvalidated) {
        await signOut()
        navigate('/login', { replace: true })
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmStatusChange() {
    if (!session || !statusUser) return
    const user = statusUser
    setIsUpdatingStatus(true)
    setErrorMessage(null)
    try {
      const updatedUser = await updateAdminUserStatus(session.session_id, user.id, {
        is_active: !user.is_active,
      })
      setStatusUser(null)
      setSuccessMessage(`${updatedUser.name} is now ${updatedUser.is_active ? 'active' : 'inactive'}.`)
      setReloadKey((key) => key + 1)
      if (user.email === session.user.email && !updatedUser.is_active) {
        await signOut()
        navigate('/login', { replace: true })
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  function changePage(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), pageCount))
  }

  function retryLoading() {
    setErrorMessage(null)
    setIsLoading(true)
    setReloadKey((key) => key + 1)
  }

  return (
    <section className="page admin-page">
      <div className="dashboard-intro">
        <div>
          <p className="eyebrow">Administration</p>
          <h2>User management<span className="heading-dot">.</span></h2>
          <p className="page-description">Keep the ProjectHub workspace and its people in good shape.</p>
        </div>
        <Button type="button" onClick={openCreateModal}>Create user</Button>
      </div>

      {successMessage && <Alert tone="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}
      {errorMessage && (
        <div className="admin-error-state">
          <Alert className="admin-page-alert" tone="error">{errorMessage}</Alert>
          <Button type="button" variant="secondary" onClick={retryLoading}>Try again</Button>
        </div>
      )}

      <div className="admin-summary-grid">
        <div className="admin-summary-card pastel-pink"><span>Total users</span><strong>{users.length}</strong></div>
        <div className="admin-summary-card pastel-mint"><span>Active users</span><strong>{activeUsers}</strong></div>
        <div className="admin-summary-card pastel-neutral"><span>Inactive users</span><strong>{users.length - activeUsers}</strong></div>
        <div className="admin-summary-card pastel-blue"><span>Roles</span><strong>{roleCounts.admin} / {roleCounts.project_manager} / {roleCounts.team_member}</strong><small>Admins / managers / members</small></div>
      </div>

      <div className="admin-toolbar">
        <Input
          aria-label="Search users"
          label="Search users"
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder="Name, email or role"
          type="search"
          value={search}
        />
        <span className="admin-result-count">{filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'} shown</span>
      </div>

      {isLoading ? (
        <div className="projects-status" role="status">
          <Spinner label="Loading users" size="large" />
          <p>Loading workspace users…</p>
        </div>
      ) : visibleUsers.length === 0 ? (
        <EmptyState
          icon="♙"
          title={search ? 'No matching users' : 'No users yet'}
          description={search ? 'Try a different search.' : 'Create the first workspace user to get started.'}
        />
      ) : (
        <>
          <div className="admin-user-table-wrap">
            <table className="admin-user-table">
              <thead>
                <tr><th>User</th><th>Role</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td><span className="admin-user-cell"><span className="member-avatar">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></span></td>
                    <td><Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge></td>
                    <td><UserStatus active={user.is_active} /></td>
                    <td><span className="admin-actions"><Button type="button" variant="secondary" onClick={() => openEditModal(user)}>Edit</Button><Button type="button" variant="secondary" onClick={() => setStatusUser(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</Button></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <Button disabled={page === 1} type="button" variant="secondary" onClick={() => changePage(page - 1)}>Previous</Button>
            <span>Page {page} of {pageCount}</span>
            <Button disabled={page === pageCount} type="button" variant="secondary" onClick={() => changePage(page + 1)}>Next</Button>
          </div>
        </>
      )}

      <Modal
        open={modalMode !== null}
        title={modalMode === 'create' ? 'Create workspace user' : 'Edit workspace user'}
        onClose={closeFormModal}
      >
        <form className="admin-user-form" onSubmit={handleSubmit} noValidate>
          <Input label="Name" onChange={(event) => updateField('name', event.target.value)} value={formValues.name} error={formErrors.name} required />
          <Input label="Email address" onChange={(event) => updateField('email', event.target.value)} type="email" value={formValues.email} error={formErrors.email} required />
          {modalMode === 'create' && <Input label="Temporary password" onChange={(event) => updateField('password', event.target.value)} type="password" value={formValues.password} error={formErrors.password} required />}
          <Select label="Role" onChange={(value) => updateField('role', value)} options={roleOptions} value={formValues.role} />
          <div className="admin-form-actions"><Button type="button" variant="secondary" onClick={closeFormModal}>Cancel</Button><Button loading={isSaving} type="submit">{modalMode === 'create' ? 'Create user' : 'Save changes'}</Button></div>
        </form>
      </Modal>

      <Modal open={statusUser !== null} title={`${statusUser?.is_active ? 'Deactivate' : 'Activate'} user?`} onClose={() => !isUpdatingStatus && setStatusUser(null)}>
        <p className="page-description">
          {statusUser?.is_active
            ? `Deactivate ${statusUser.name}? They will no longer be able to use the workspace.`
            : `Activate ${statusUser?.name}? They will be able to sign in again.`}
        </p>
        <div className="admin-form-actions">
          <Button disabled={isUpdatingStatus} type="button" variant="secondary" onClick={() => setStatusUser(null)}>Cancel</Button>
          <Button loading={isUpdatingStatus} type="button" variant={statusUser?.is_active ? 'danger' : 'primary'} onClick={confirmStatusChange}>
            {statusUser?.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </Modal>
    </section>
  )
}
