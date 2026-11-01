import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, Spinner } from './ui'
import { useAuth } from '../context/useAuth'
import * as authApi from '../lib/authApi'
import { listRoles } from '../lib/rolesApi'
import type { RoleAccessRow } from '../types/auth'

export function RoleMatrixView() {
  const { logout } = useAuth()
  const [roles, setRoles] = useState<RoleAccessRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    async function loadRoles() {
      const token = authApi.getStoredToken()

      if (token === null) {
        setIsLoading(false)
        return
      }

      try {
        setRoles(await listRoles(token))
      } catch (err) {
        if (err instanceof authApi.AuthApiError && err.status === 401) {
          await logout()
          return
        }

        setError(
          err instanceof authApi.AuthApiError
            ? err.message
            : 'Unable to connect to the server.',
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadRoles()
  }, [logout, reloadKey])

  function retry(): void {
    setIsLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="role-matrix">
      <h2>Roles &amp; permissions</h2>
      <p className="muted">
        Read-only reference. Every ability is granted by role, and a change to
        the catalogue is a recorded decision rather than a setting here.
      </p>

      {error !== null && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <Spinner label="Loading roles…" />
      ) : error !== null ? (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      ) : roles.length === 0 ? (
        <EmptyState
          title="No roles were published."
          description="The server returned an empty matrix; report this rather than assuming grants exist."
        />
      ) : (
        <ul className="role-matrix-list">
          {roles.map((role) => (
            <li key={role.value}>
              <Card className="role-card">
                <h3 className="role-card-title">{role.label}</h3>
                <div className="role-card-meta">
                  <Badge tone="info">{role.interface.label}</Badge>
                  <Badge tone="neutral">
                    {role.barangay_scoped
                      ? 'Barangay-scoped'
                      : 'Not barangay-scoped'}
                  </Badge>
                </div>
                <ul className="role-abilities">
                  {role.abilities.map((ability) => (
                    <li key={ability.value} className="role-ability">
                      {ability.label}
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
