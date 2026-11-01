import { parseRealtimePayload } from './realtimeFeed'
import { REALTIME_EVENT_NAMES } from '../types/realtime'
import type { RealtimeUpdate } from '../types/realtime'

export type RealtimeSubscriptionStatus = 'live' | 'failed'

export interface RealtimeChannelLike {
  on(
    type: 'broadcast',
    filter: { event: string },
    callback: (message: { payload: unknown }) => void,
  ): RealtimeChannelLike
  subscribe(callback: (status: string) => void): unknown
}

export interface RealtimeClientLike {
  channel(
    topic: string,
    options: { config: { private: boolean } },
  ): RealtimeChannelLike
  removeChannel(channel: RealtimeChannelLike): unknown
}

const FAILED_STATES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])

/**
 * Subscribes to each server-derived topic on a private channel (D-65).
 * A payload that fails the contract check is dropped rather than trusted;
 * the polling substitute catches up.
 */
export function openRealtimeSubscription(
  client: RealtimeClientLike,
  topics: string[],
  onUpdate: (update: RealtimeUpdate) => void,
  onStatus: (status: RealtimeSubscriptionStatus) => void,
): { close(): void } {
  const uniqueTopics = [...new Set(topics)]

  if (uniqueTopics.length === 0) {
    onStatus('failed')
    return { close() {} }
  }

  const channels = uniqueTopics.map((topic) => {
    let channel = client.channel(topic, { config: { private: true } })

    for (const event of REALTIME_EVENT_NAMES) {
      channel = channel.on(
        'broadcast',
        { event },
        (message) => {
          const update = parseRealtimePayload(event, message.payload)

          if (update !== null) {
            onUpdate(update)
          }
        },
      )
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        onStatus('live')
      } else if (FAILED_STATES.has(status)) {
        onStatus('failed')
      }
    })

    return channel
  })

  return {
    close() {
      for (const channel of channels) {
        client.removeChannel(channel)
      }
    },
  }
}
