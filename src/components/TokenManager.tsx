import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import * as authApi from '../lib/authApi'
import { isBlank } from '../lib/validation'
import type { ApiToken, FieldErrors } from '../types/auth'

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

  useEffect(() => {
    async function loadTokens() {
      const token = authApi.getStoredToken()

      if (token === null) {
        setIsLoading(false)
        return
      }

      try {
        const response = await authApi.listTokens(token)
        setTokens(response)
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

    void loadTokens()
  }, [logout])

  async function reloadTokens(): Promise<void> {
    const token = authApi.getStoredToken()

    if (token === null) {
      return
    }

    const response = await authApi.listTokens(token)
    setTokens(response)
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

  async function handleRevokeAll() {
    const token = authApi.getStoredToken()

    if (token === null || isRevokingAll) {
      return
    }

    if (
      !window.confirm(
        'Revoke all API tokens? This revokes your current session and will sign you out.',
      )
    ) {
      return
    }

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
      <h2>API tokens</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {createdToken !== null && (
        <div className="form-success token-created" role="status">
          <p className="muted">
            Copy this token now. It will not be shown again:
          </p>
          <code className="token-value">{createdToken}</code>
          <button type="button" className="counter" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy token'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="muted">Loading tokens…</p>
      ) : tokens.length === 0 ? (
        <p className="muted">No API tokens yet.</p>
      ) : (
        <ul className="token-list">
          {tokens.map((token) => (
            <li className="token-item" key={token.id}>
              <div className="token-header">
                <p className="token-name">{token.name}</p>
                <button
                  type="button"
                  className="token-delete"
                  disabled={deletingId !== null}
                  onClick={() => void handleDelete(token.id, token.name)}
                >
                  {deletingId === token.id ? 'Revoking…' : 'Revoke'}
                </button>
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
            </li>
          ))}
        </ul>
      )}

      <hr className="token-divider" />

      <form className="auth-form" onSubmit={handleCreate} noValidate>
        <h3>Create a token</h3>

        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
          />
          {nameError && <small className="field-error">{nameError}</small>}
        </label>

        <label className="field">
          <span>Abilities (comma-separated, optional)</span>
          <input
            type="text"
            value={abilities}
            placeholder="server:update, reports:read"
            onChange={(event) => setAbilities(event.target.value)}
          />
          {abilitiesError && (
            <small className="field-error">{abilitiesError}</small>
          )}
        </label>

        <p className="muted">
          Leave abilities blank to grant full access. Up to {MAX_ABILITIES}{' '}
          abilities per token.
        </p>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create token'}
        </button>
      </form>

      <hr className="token-divider" />

      <div className="token-footer">
        <button
          type="button"
          className="token-delete"
          disabled={isRevokingAll}
          onClick={() => void handleRevokeAll()}
        >
          {isRevokingAll ? 'Revoking…' : 'Revoke all tokens'}
        </button>
        <button type="button" className="counter" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
