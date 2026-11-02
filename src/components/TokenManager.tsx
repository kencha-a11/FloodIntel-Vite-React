import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Alert,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Spinner,
  TextInput,
} from './ui'
import { useAuth } from '../context/useAuth'
import * as authApi from '../lib/authApi'
import { isBlank } from '../lib/validation'
import type { ApiToken, FieldErrors, Session } from '../types/auth'

const SESSION_TOKEN_NAME = 'auth_token'
const MAX_ABILITIES = 20

function parseAbilities(input: string): string[] {
  return input
    .split(',')
    .map((ability) => ability.trim())
    .filter((ability) => ability !== '')
    .slice(0, MAX_ABILITIES)
}

function formatDate(value: string | null): string {
  if (value === null) {
    return 'Never'
  }

  return new Date(value).toLocaleString()
}

export function TokenManager({ onBack }: { onBack: () => void }) {
  const { logout } = useAuth()
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [abilities, setAbilities] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverFieldErrors, setServerFieldErrors] =
    useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isRevokingAll, setIsRevokingAll] = useState(false)
  const [isConfirmingRevokeAll, setIsConfirmingRevokeAll] = useState(false)

  useEffect(() => {
    async function loadAll() {
      const token = authApi.getStoredToken()

      if (token === null) {
        setIsLoading(false)
        return
      }

      try {
        const [tokenList, sessionList] = await Promise.all([
          authApi.listTokens(token),
          authApi.fetchSessions(token),
        ])
        setTokens(tokenList)
        setSessions(sessionList)
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

    void loadAll()
  }, [logout])

  async function reloadTokens(): Promise<void> {
    const token = authApi.getStoredToken()

    if (token === null) {
      return
    }

    const response = await authApi.listTokens(token)
    setTokens(response)
  }

  async function reloadSessions(): Promise<void> {
    const token = authApi.getStoredToken()

    if (token === null) {
      return
    }

    const response = await authApi.fetchSessions(token)
    setSessions(response)
  }

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (isBlank(name)) {
      next.name = 'The name field is required.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting || !validate()) {
      return
    }

    const token = authApi.getStoredToken()

    if (token === null) {
      return
    }

    const abilityList = parseAbilities(abilities)
    setIsSubmitting(true)
    setError(null)
    setServerFieldErrors({})
    setCreatedToken(null)

    try {
      const response = await authApi.createToken(
        token,
        name.trim(),
        abilityList,
      )
      setCreatedToken(response.token)
      setCopied(false)
      setName('')
      setAbilities('')
      await reloadTokens()
    } catch (err) {
      if (err instanceof authApi.AuthApiError) {
        if (err.status === 401) {
          await logout()
          return
        }

        setError(err.message)
        setServerFieldErrors(err.errors)
      } else {
        setError('Unable to connect to the server.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: number, tokenName: string) {
    const token = authApi.getStoredToken()

    if (token === null || deletingId !== null) {
      return
    }

    setDeletingId(id)
    setError(null)

    try {
      await authApi.deleteToken(token, id)

      if (tokenName === SESSION_TOKEN_NAME) {
        await logout()
        return
      }

      await reloadTokens()
    } catch (err) {
      if (err instanceof authApi.AuthApiError) {
        if (err.status === 401) {
          await logout()
          return
        }

        setError(
          err.status === 404
            ? 'Token not found or already revoked.'
            : err.message,
        )
      } else {
        setError('Unable to connect to the server.')
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRevokeSession(session: Session) {
    const token = authApi.getStoredToken()

    if (token === null || deletingId !== null) {
      return
    }

    setDeletingId(session.id)
    setError(null)

    try {
      await authApi.deleteToken(token, session.id)

      if (session.is_current) {
        await logout()
        return
      }

      await reloadSessions()
    } catch (err) {
      if (err instanceof authApi.AuthApiError) {
        if (err.status === 401) {
          await logout()
          return
        }

        setError(
          err.status === 404
            ? 'Session not found or already revoked.'
            : err.message,
        )
      } else {
        setError('Unable to connect to the server.')
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRevokeAll() {
    const token = authApi.getStoredToken()

    if (token === null || isRevokingAll) {
      return
    }

    setIsConfirmingRevokeAll(false)
    setIsRevokingAll(true)
    setError(null)

    try {
      await authApi.deleteAllTokens(token)
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
      setIsRevokingAll(false)
      return
    }

    await logout()
  }

  async function handleCopy() {
    if (createdToken === null) {
      return
    }

    try {
      await navigator.clipboard.writeText(createdToken)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable; the token stays visible for manual copy.
    }
  }

  const nameError = errors.name ?? serverFieldErrors.name?.[0]
  const abilitiesError = serverFieldErrors.abilities?.[0]

  return (
    <div className="token-manager">
      <h2>Active sessions</h2>

      {error && <Alert tone="danger">{error}</Alert>}

      {createdToken !== null && (
        <Alert tone="success" role="status" className="token-created">
          <span>Copy this token now. It will not be shown again:</span>
          <code className="token-value">{createdToken}</code>
          <span>
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy token'}
            </Button>
          </span>
        </Alert>
      )}

      {isLoading ? (
        <Spinner label="Loading tokens…" />
      ) : (
        <>
          {sessions.length === 0 ? (
            <EmptyState
              title="No active sessions."
              description="No sessions to show."
            />
          ) : (
            <ul className="session-list">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  aria-current={session.is_current ? 'true' : undefined}
                >
                  <Card
                    className={
                      session.is_current
                        ? 'session-item session-current'
                        : 'session-item'
                    }
                  >
                    <div className="session-header">
                      <p className="session-name">
                        {session.name}
                        {session.is_current && (
                          <span className="session-current">Current session</span>
                        )}
                      </p>
                      <Button
                        variant="danger"
                        disabled={deletingId !== null}
                        onClick={() => void handleRevokeSession(session)}
                      >
                        {deletingId === session.id ? 'Revoking…' : 'Revoke'}
                      </Button>
                    </div>
                    <p className="session-meta">
                      ID: {session.id} · IP: {session.ip_address ?? 'Unknown'}
                    </p>
                    <p className="session-meta">
                      User agent: {session.user_agent ?? 'Unknown'}
                    </p>
                    <p className="session-meta">
                      Logged in {formatDate(session.logged_in_at)} · Last used{' '}
                      {formatDate(session.last_used_at)}
                    </p>
                    <p className="session-meta">
                      Current: {String(session.is_current)}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <hr className="token-divider" />

          <h2>API tokens</h2>

          {tokens.length === 0 ? (
            <EmptyState
              title="No API tokens yet."
              description="Create a token below to allow a device or script to call the API."
            />
          ) : (
            <ul className="token-list">
              {tokens.map((token) => (
                <li key={token.id}>
                  <Card className="token-item">
                    <div className="token-header">
                      <p className="token-name">{token.name}</p>
                      <Button
                        variant="danger"
                        disabled={deletingId !== null}
                        onClick={() => void handleDelete(token.id, token.name)}
                      >
                        {deletingId === token.id ? 'Revoking…' : 'Revoke'}
                      </Button>
                    </div>
                    <p className="token-meta">
                      {token.abilities.length > 0
                        ? token.abilities.join(', ')
                        : 'All abilities'}
                    </p>
                    <p className="token-meta">
                      Created {formatDate(token.created_at)} · Last used{' '}
                      {formatDate(token.last_used_at)}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <hr className="token-divider" />

      <form className="ui-form" onSubmit={handleCreate} noValidate>
        <h3>Create a token</h3>

        <Field id="token-name" label="Name" error={nameError}>
          <TextInput
            type="text"
            value={name}
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field
          id="token-abilities"
          label="Abilities (comma-separated, optional)"
          error={abilitiesError}
        >
          <TextInput
            type="text"
            value={abilities}
            placeholder="server:update, reports:read"
            onChange={(event) => setAbilities(event.target.value)}
          />
        </Field>

        <p className="muted">
          Leave abilities blank to grant full access. Up to {MAX_ABILITIES}{' '}
          abilities per token.
        </p>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create token'}
        </Button>
      </form>

      <hr className="token-divider" />

      <div className="token-footer">
        <Button
          variant="danger"
          disabled={isRevokingAll}
          onClick={() => setIsConfirmingRevokeAll(true)}
        >
          {isRevokingAll ? 'Revoking…' : 'Revoke all tokens'}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>

      <Dialog
        open={isConfirmingRevokeAll}
        title="Revoke all API tokens?"
        onClose={() => setIsConfirmingRevokeAll(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsConfirmingRevokeAll(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleRevokeAll()}>
              Revoke all and sign out
            </Button>
          </>
        }
      >
        <p className="muted">
          This revokes every token on your account, including the session you
          are using now, and signs you out.
        </p>
      </Dialog>
    </div>
  )
}
