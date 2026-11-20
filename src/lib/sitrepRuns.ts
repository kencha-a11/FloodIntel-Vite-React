import type { BadgeTone } from '../components/ui'
import type { SitrepRunState } from '../types/sitrep'

/*
 * How a cutoff's preparation state reads in the strip (D-44). `not_run` is a
 * derived state — a cutoff that passed with no recorded attempt — so a missed
 * run is visible without a backdated row. The labels and tones are presentation
 * only; the server owns the state.
 */

export function runStateTone(state: SitrepRunState): BadgeTone {
  switch (state) {
    case 'prepared':
      return 'success'
    case 'failed':
      return 'danger'
    case 'pending':
      return 'info'
    case 'not_run':
      return 'warning'
  }
}

export function runStateLabel(state: SitrepRunState): string {
  switch (state) {
    case 'prepared':
      return 'Prepared'
    case 'failed':
      return 'Failed'
    case 'pending':
      return 'Pending'
    case 'not_run':
      return 'Missed'
  }
}