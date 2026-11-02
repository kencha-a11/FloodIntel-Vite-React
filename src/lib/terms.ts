// Terms and conditions acceptance for the signed-out sign-in flow.
//
// The acceptance is a client-side gate only: no server surface, no schema, and
// no requirement text owns it (AUTH-15). The instant is kept in the browser
// store so a reload does not re-prompt a holder who has already affirmed.

const TERMS_ACCEPTED_KEY = 'auth_terms_accepted'

export const TERMS_KEY = TERMS_ACCEPTED_KEY
export const AUTH_TERMS_ACCEPTED_KEY = TERMS_ACCEPTED_KEY

// --- terms copy (plain English, short sentences; Q-10) ---

export const TERMS_TITLE = 'Terms and conditions'

export const TERMS_INTRO =
  'These terms apply to the FloodIntel MDRRMO system. By signing in, you agree to them.'

export const TERMS_SECTIONS: ReadonlyArray<{ heading: string; body: string }> = [
  {
    heading: 'What we collect',
    body:
      'We collect your name, email address or contact number, password, role, and barangay. ' +
      'We also collect the flood reports you file, including photos, locations, and notes. ' +
      'We record sign-in details such as your device and network address.',
  },
  {
    heading: 'How we use it',
    body:
      'We use this data to run flood reporting and response for your municipality. ' +
      'We do not sell your data.',
  },
  {
    heading: 'Service providers',
    body:
      'We use a small number of service providers to host and run the system: ' +
      'Supabase (database and realtime), Nominatim (address lookup), Meteosource (weather data), ' +
      'Brevo (email), Netlify (web hosting), and Render (application hosting). ' +
      'They receive only the data needed for their service.',
  },
  {
    heading: 'Your rights',
    body:
      'You may ask the MDRRMO administrator to view, correct, or remove your account data.',
  },
  {
    heading: 'Retention',
    body:
      'Retention periods follow the LGU records policy. They are not fixed in this notice.',
  },
  {
    heading: 'Security',
    body:
      'Keep your password and device secure. Report a lost device to your administrator.',
  },
]

export const TERMS_BODY = TERMS_SECTIONS.map(
  (section) => `${section.heading}. ${section.body}`,
).join(' ')

export const TERMS_TEXT = `${TERMS_TITLE}. ${TERMS_INTRO} ${TERMS_BODY}`

export const TERMS_COPY = TERMS_TEXT

export const TERMS_STATEMENT = TERMS_TEXT

export const TERMS_AND_CONDITIONS = TERMS_TEXT

export const TERMS_CONTENT = TERMS_TEXT

export const TERMS = {
  title: TERMS_TITLE,
  intro: TERMS_INTRO,
  sections: TERMS_SECTIONS,
  body: TERMS_BODY,
  text: TERMS_TEXT,
} as const

// --- acceptance storage ---

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined' || localStorage === null) {
      return null
    }

    const candidate = localStorage as Storage

    if (
      typeof candidate.getItem !== 'function' ||
      typeof candidate.setItem !== 'function' ||
      typeof candidate.removeItem !== 'function'
    ) {
      return null
    }

    return candidate
  } catch {
    return null
  }
}

export function hasAcceptedTerms(): boolean {
  const raw = storage()?.getItem(TERMS_ACCEPTED_KEY)

  if (raw === null || raw === undefined) {
    return false
  }

  const value = Number(raw)

  return Number.isFinite(value)
}

export function markTermsAccepted(at: number = Date.now()): void {
  const instant = Number.isFinite(at) ? at : Date.now()

  storage()?.setItem(TERMS_ACCEPTED_KEY, String(instant))
}

export function clearTermsAcceptance(): void {
  storage()?.removeItem(TERMS_ACCEPTED_KEY)
}
