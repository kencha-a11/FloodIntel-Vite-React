import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { AuthApiError, getStoredToken } from '../lib/http'
import { listRoles } from '../lib/rolesApi'
import { listUsers, updateUserRole } from '../lib/userApi'
import type { RoleAccessRow, User, UserRole } from '../types/auth'
import { Alert, Badge, Button, EmptyState, Field, Select, Spinner } from './ui'

/*
 * Role assignment from the command center (FR-103, AUTHZ-11). The write stays
 * on the existing `/users/{user}` endpoint and sends only the role, so this
 * screen adds no authority the server does not already grant: it is gated by
 * the same ability the matrix is, and the server still refuses a change to
 * the caller's own account and enforces the barangay rule.
 *
 * FR-102's security log is deferred (AUTHZ-10), so the interface says a change
 * is not recorded anywhere else rather than implying an audit trail exists.
 */

export function UsersView() {
  const { user, logout } = useAuth()
  const [users, setUsers] = useState<User[] | null>(null)
  const [roles, setRoles] = useState<RoleAccessRow[] | null>(null)
  const [drafts, setDrafts] = useState<Record<number, UserRole>>({})
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const token = getStoredToken()

      if (token === null) {
        return
      }

      try {
        const [accounts, catalogue] = await Promise.all([
          listUsers(token, page),
          listRoles(token),
        ])

        if (cancelled) {
          return
        }

        setUsers(accounts.data)
        setPage(accounts.meta.current_page)
        setLastPage(accounts.meta.last_page)
        setTotal(accounts.meta.total)
        setRoles(catalogue)
        setError(null)
      } catch (err) {
        if (cancelled) {
          return
        }

        if (err instanceof AuthApiError && err.status === 401) {
          await logout()
          return
        }

        setUsers(null)
        setError(
          err instanceof AuthApiError
            ? err.message
            : 'Unable to connect to the server.',
        )
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [logout, page, reloadKey])

  async function saveRole(account: User): Promise<void> {
    const role = drafts[account.id] ?? account.role

    if (role === account.role) {
      return
    }

    const token = getStoredToken()

    if (token === null) {
      return
    }

    setSavingId(account.id)
    setError(null)
    setNotice(null)

    try {
      const updated = await updateUserRole(token, account.id, role)

      setUsers(
        (current) =>
          current?.map((row) => (row.id === updated.id ? updated : row)) ??
          current,
      )
      setDrafts((current) => ({ ...current, [updated.id]: updated.role }))
      setNotice(`Role updated for ${updated.full_name}.`)
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 401) {
        await logout()
        return
      }

      setError(
        err instanceof AuthApiError
          ? (err.errors.barangay_id?.[0] ?? err.message)
          : 'Unable to connect to the server.',
      )
    } finally {
      setSavingId(null)
    }
  }

  function retry(): void {
    setUsers(null)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const isLoading = users === null && error === null

  return (
    <div className="users-view">
      <h2>Users</h2>
      <p className="muted">
        One role per account. Your own role cannot be changed here, and a
        barangay-scoped role needs the account to have a barangay first; this
        screen assigns the role and no other field.
      </p>

      <Alert tone="warning">
        Role changes are not yet written to a security log (FR-102 is
        deferred). Record who was changed and when until it lands.
      </Alert>

      {notice !== null && <Alert tone="success">{notice}</Alert>}
      {error !== null && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <Spinner label="Loading accounts…" />
      ) : error !== null && users === null ? (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      ) : users !== null && users.length === 0 ? (
        <EmptyState
          title="No accounts were returned."
          description="The server returned no accounts for this page."
        />
      ) : (
        <ul className="user-items">
          {(users ?? []).map((account) => {
            const isSelf = account.id === user?.id
            const selected = drafts[account.id] ?? account.role
            const isSaving = savingId === account.id

            return (
              <li key={account.id} className="user-row">
                <div className="user-row-header">
                  <span className="user-row-name">{account.full_name}</span>
                  <Badge tone="neutral">{account.role_label}</Badge>
                  {isSelf && <Badge tone="info">Your account</Badge>}
                </div>
                <p className="user-row-meta">
                  {account.email} ·{' '}
                  {account.barangay?.name ?? 'No barangay assigned'}
                </p>

                {isSelf ? (
                  <p className="user-row-meta">
                    Your own role is refused by the server, so this screen
                    offers no control for it.
                  </p>
                ) : (
                  <div className="user-row-actions">
                    <Field
                      id={`user-role-${account.id}`}
                      label={`Role for ${account.full_name}`}
                    >
                      <Select
                        value={selected}
                        disabled={isSaving || roles === null}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [account.id]: event.target.value as UserRole,
                          }))
                        }
                      >
                        {(roles ?? []).map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button
                      size="compact"
                      disabled={
                        isSaving ||
                        roles === null ||
                        selected === account.role
                      }
                      aria-label={`Save role for ${account.full_name}`}
                      onClick={() => void saveRole(account)}
                    >
                      {isSaving ? 'Saving…' : 'Save role'}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {total > 0 && (
        <div className="pagination">
          <Button
            variant="secondary"
            size="compact"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </Button>
          <span className="muted">
            Page {page} of {lastPage} · {total} accounts
          </span>
          <Button
            variant="secondary"
            size="compact"
            disabled={page >= lastPage || isLoading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
