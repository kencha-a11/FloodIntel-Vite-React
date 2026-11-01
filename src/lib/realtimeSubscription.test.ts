import { describe, expect, it, vi } from 'vitest'
import {
  openRealtimeSubscription,
  type RealtimeChannelLike,
  type RealtimeClientLike,
} from './realtimeSubscription'

interface FakeChannel extends RealtimeChannelLike {
  topic: string
  options: { config: { private: boolean } }
  handlers: Map<string, (message: { payload: unknown }) => void>
  notify(status: string): void
}

function createFakeClient() {
  const channels: FakeChannel[] = []
  const removed: RealtimeChannelLike[] = []

  const client: RealtimeClientLike = {
    channel(topic, options) {
      let statusCallback: ((status: string) => void) | null = null

      const channel: FakeChannel = {
        topic,
        options,
        handlers: new Map(),
        on(type, filter, callback) {
          expect(type).toBe('broadcast')
          channel.handlers.set(filter.event, callback)
          return channel
        },
        subscribe(callback) {
          statusCallback = callback
          return channel
        },
        notify(status) {
          statusCallback?.(status)
        },
      }

      channels.push(channel)

      return channel
    },
    removeChannel(channel) {
      removed.push(channel)
      return Promise.resolve('ok')
    },
  }

  return { client, channels, removed }
}

const payload = {
  id: 42,
  barangay_id: 3,
  status: 'submitted',
  changed: [],
}

describe('openRealtimeSubscription', () => {
  it('subscribes each topic once on a private channel with both events', () => {
    const { client, channels } = createFakeClient()

    openRealtimeSubscription(
      client,
      ['reports:all', 'reports:user:7', 'reports:all'],
      () => {},
      () => {},
    )

    expect(channels.map((channel) => channel.topic)).toEqual([
      'reports:all',
      'reports:user:7',
    ])
    expect(channels[0].options.config.private).toBe(true)
    expect([...channels[0].handlers.keys()]).toEqual([
      'report.created',
      'report.status_changed',
    ])
  })

  it('delivers a valid payload and drops one the contract refuses', () => {
    const { client, channels } = createFakeClient()
    const updates = vi.fn()

    openRealtimeSubscription(client, ['reports:all'], updates, () => {})

    const handler = channels[0].handlers.get('report.created')

    handler?.({ payload })
    handler?.({ payload: { ...payload, notes: 'leaked' } })

    expect(updates).toHaveBeenCalledTimes(1)
    expect(updates).toHaveBeenCalledWith({
      event: 'report.created',
      reportId: 42,
      barangayId: 3,
      status: 'submitted',
      changed: [],
    })
  })

  it('reports live after subscribing and failed on every terminal state', () => {
    const { client, channels } = createFakeClient()
    const statuses: string[] = []

    openRealtimeSubscription(
      client,
      ['reports:all', 'reports:user:7'],
      () => {},
      (status) => statuses.push(status),
    )

    channels[0].notify('SUBSCRIBED')
    channels[1].notify('CHANNEL_ERROR')
    channels[0].notify('TIMED_OUT')
    channels[1].notify('CLOSED')

    expect(statuses).toEqual(['live', 'failed', 'failed', 'failed'])
  })

  it('removes every channel when it closes', () => {
    const { client, channels, removed } = createFakeClient()

    const subscription = openRealtimeSubscription(
      client,
      ['reports:all', 'reports:barangay:3'],
      () => {},
      () => {},
    )

    subscription.close()

    expect(removed).toEqual(channels)
  })

  it('fails closed without a server-derived topic', () => {
    const { client, channels } = createFakeClient()
    const statuses: string[] = []

    openRealtimeSubscription(client, [], () => {}, (status) => statuses.push(status))

    expect(channels).toHaveLength(0)
    expect(statuses).toEqual(['failed'])
  })
})
