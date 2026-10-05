import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/useAuth'
import { isBlank, isContactNumber, isEmail } from '../lib/validation'

const PASSWORD_MIN_LENGTH = 8
const NAME_MAX_LENGTH = 255

export function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const { register, error, fieldErrors, clearError } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (isBlank(firstName)) {
      next.first_name = 'The first name field is required.'
    } else if (firstName.length > NAME_MAX_LENGTH) {
      next.first_name = 'The first name must not exceed 255 characters.'
    }

    if (isBlank(lastName)) {
      next.last_name = 'The last name field is required.'
    } else if (lastName.length > NAME_MAX_LENGTH) {
      next.last_name = 'The last name must not exceed 255 characters.'
    }

    if (isBlank(contactNumber)) {
      next.contact_number = 'The contact number field is required.'
    } else if (!isContactNumber(contactNumber)) {
      next.contact_number = 'The contact number must be a valid phone number.'
    }

    if (isBlank(email)) {
      next.email = 'The email field is required.'
    } else if (!isEmail(email)) {
      next.email = 'The email must be a valid email address.'
    }

    if (isBlank(password)) {
      next.password = 'The password field is required.'
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      next.password = `The password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    }

    if (isBlank(passwordConfirmation)) {
      next.password_confirmation =
        'The password confirmation field is required.'
    } else if (password !== passwordConfirmation) {
      next.password_confirmation = 'The password confirmation does not match.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()

    if (isSubmitting || !validate()) {
      return
    }

    setIsSubmitting(true)
    await register(
      firstName.trim(),
      lastName.trim(),
      contactNumber.trim(),
      email.trim(),
      password,
      passwordConfirmation,
    )
    setIsSubmitting(false)
  }

  const firstNameError = errors.first_name ?? fieldErrors.first_name?.[0]
  const lastNameError = errors.last_name ?? fieldErrors.last_name?.[0]
  const contactNumberError =
    errors.contact_number ?? fieldErrors.contact_number?.[0]
  const emailError = errors.email ?? fieldErrors.email?.[0]
  const passwordError = errors.password ?? fieldErrors.password?.[0]
  const confirmationError =
    errors.password_confirmation ?? fieldErrors.password_confirmation?.[0]

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <h2>Create account</h2>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <label className="field">
        <span>First name</span>
        <input
          type="text"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoComplete="given-name"
        />
        {firstNameError && (
          <small className="field-error">{firstNameError}</small>
        )}
      </label>

      <label className="field">
        <span>Last name</span>
        <input
          type="text"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          autoComplete="family-name"
        />
        {lastNameError && (
          <small className="field-error">{lastNameError}</small>
        )}
      </label>

      <label className="field">
        <span>Contact number</span>
        <input
          type="tel"
          value={contactNumber}
          onChange={(event) => setContactNumber(event.target.value)}
          autoComplete="tel"
        />
        {contactNumberError && (
          <small className="field-error">{contactNumberError}</small>
        )}
      </label>

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        {emailError && <small className="field-error">{emailError}</small>}
      </label>

      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
        {passwordError && (
          <small className="field-error">{passwordError}</small>
        )}
      </label>

      <label className="field">
        <span>Confirm password</span>
        <input
          type="password"
          value={passwordConfirmation}
          onChange={(event) => setPasswordConfirmation(event.target.value)}
          autoComplete="new-password"
        />
        {confirmationError && (
          <small className="field-error">{confirmationError}</small>
        )}
      </label>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>

      <p className="switch">
        Already have an account?{' '}
        <button type="button" className="link" onClick={onSwitch}>
          Sign in
        </button>
      </p>
    </form>
  )
}
