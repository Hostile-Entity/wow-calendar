import type { CalendarEvent } from '../../lib/types/events'

const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3'

interface GoogleEventDateTime {
  dateTime?: string
  date?: string
  timeZone?: string
}

interface GoogleEventItem {
  id: string
  etag?: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  summary?: string
  description?: string
  colorId?: string
  updated?: string
  start?: GoogleEventDateTime
  end?: GoogleEventDateTime
}

interface GoogleEventListResponse {
  items?: GoogleEventItem[]
  nextPageToken?: string
}

export interface SyncPreview {
  creates: number
  updates: number
  deletes: number
}

export interface GoogleSyncResult {
  events: CalendarEvent[]
  primaryCalendarColorHex?: string
}

interface GooglePrimaryCalendarResponse {
  id: string
  backgroundColor?: string
}

function toGoogleDateTime(iso: string) {
  return { dateTime: iso }
}

function toLocalDateStringFromIso(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toGoogleAllDayDate(iso: string) {
  return { date: toLocalDateStringFromIso(iso) }
}

function isGoogleAllDayEvent(item: GoogleEventItem): boolean {
  return Boolean(item.start?.date && item.end?.date)
}

function fromGoogleDateTime(value: GoogleEventDateTime | undefined): string | null {
  if (!value) {
    return null
  }
  if (value.dateTime) {
    return new Date(value.dateTime).toISOString()
  }
  if (value.date) {
    return new Date(`${value.date}T00:00:00`).toISOString()
  }
  return null
}

function buildGooglePayload(event: CalendarEvent, options?: { clearColorToDefault?: boolean }) {
  const payload: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? '',
  }

  if (event.colorId === '12') {
    if (options?.clearColorToDefault) {
      payload.colorId = null
    }
  } else {
    payload.colorId = event.colorId
  }

  if (event.allDay) {
    payload.start = toGoogleAllDayDate(event.start)
    payload.end = toGoogleAllDayDate(event.end)
    return payload
  }

  payload.start = toGoogleDateTime(event.start)
  payload.end = toGoogleDateTime(event.end)
  return payload
}

async function googleFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${GOOGLE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Google Calendar request failed: ${response.status} ${details}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function fetchAllPrimaryEvents(accessToken: string): Promise<GoogleEventItem[]> {
  let pageToken = ''
  const all: GoogleEventItem[] = []

  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      showDeleted: 'true',
      maxResults: '2500',
      orderBy: 'updated',
    })
    if (pageToken) {
      params.set('pageToken', pageToken)
    }

    const response = await googleFetch<GoogleEventListResponse>(
      accessToken,
      `/calendars/primary/events?${params.toString()}`,
      { method: 'GET' },
    )
    all.push(...(response.items ?? []))
    pageToken = response.nextPageToken ?? ''
  } while (pageToken)

  return all
}

export async function fetchPrimaryCalendarColor(accessToken: string): Promise<string | undefined> {
  const response = await fetch(`${GOOGLE_API_BASE}/users/me/calendarList/primary`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    return undefined
  }

  const body = (await response.json()) as GooglePrimaryCalendarResponse
  return body.backgroundColor
}

function mergeRemoteEvents(
  localEvents: CalendarEvent[],
  remoteItems: GoogleEventItem[],
  primaryCalendarColorHex?: string,
): CalendarEvent[] {
  const merged = [...localEvents]
  const indexByGoogleId = new Map<string, number>()

  for (let index = 0; index < merged.length; index += 1) {
    const googleId = merged[index].googleEventId
    if (googleId) {
      indexByGoogleId.set(googleId, index)
    }
  }

  for (const remote of remoteItems) {
    const remoteId = remote.id
    const localIndex = indexByGoogleId.get(remoteId)

    if (localIndex === undefined) {
      if (remote.status === 'cancelled') {
        continue
      }

      const start = fromGoogleDateTime(remote.start)
      const end = fromGoogleDateTime(remote.end)
      if (!start || !end) {
        continue
      }

      merged.push({
        id: crypto.randomUUID(),
        title: remote.summary ?? 'Untitled event',
        description: remote.description ?? '',
        start,
        end,
        allDay: isGoogleAllDayEvent(remote),
        calendarDefaultColorHex:
          ((remote.colorId as CalendarEvent['colorId']) ?? '12') === '12' ? primaryCalendarColorHex : undefined,
        colorId: (remote.colorId as CalendarEvent['colorId']) ?? '12',
        source: 'google',
        syncStatus: 'synced',
        updatedAt: remote.updated ? new Date(remote.updated).toISOString() : new Date().toISOString(),
        googleEventId: remote.id,
        googleEtag: remote.etag,
      })
      continue
    }

    const local = merged[localIndex]
    if (local.syncStatus.startsWith('pending')) {
      continue
    }

    if (remote.status === 'cancelled') {
      merged[localIndex] = {
        ...local,
        deletedAt: remote.updated ? new Date(remote.updated).toISOString() : new Date().toISOString(),
        syncStatus: 'synced',
        updatedAt: remote.updated ? new Date(remote.updated).toISOString() : new Date().toISOString(),
        googleEtag: remote.etag,
      }
      continue
    }

    const start = fromGoogleDateTime(remote.start)
    const end = fromGoogleDateTime(remote.end)
    if (!start || !end) {
      continue
    }

    merged[localIndex] = {
      ...local,
      title: remote.summary ?? local.title,
      description: remote.description ?? '',
      start,
      end,
      allDay: isGoogleAllDayEvent(remote),
      calendarDefaultColorHex:
        ((remote.colorId as CalendarEvent['colorId']) ?? '12') === '12'
          ? primaryCalendarColorHex ?? local.calendarDefaultColorHex
          : undefined,
      colorId: (remote.colorId as CalendarEvent['colorId']) ?? '12',
      source: 'google',
      syncStatus: 'synced',
      updatedAt: remote.updated ? new Date(remote.updated).toISOString() : new Date().toISOString(),
      deletedAt: undefined,
      googleEtag: remote.etag,
    }
  }

  return merged
}

export function buildSyncPreview(pendingEvents: CalendarEvent[]): SyncPreview {
  return pendingEvents.reduce(
    (acc, event) => {
      if (event.syncStatus === 'pending_create') {
        acc.creates += 1
      } else if (event.syncStatus === 'pending_update') {
        acc.updates += 1
      } else if (event.syncStatus === 'pending_delete') {
        acc.deletes += 1
      }
      return acc
    },
    { creates: 0, updates: 0, deletes: 0 },
  )
}

export async function syncWithGoogleCalendar(
  accessToken: string,
  localEvents: CalendarEvent[],
): Promise<GoogleSyncResult> {
  const primaryCalendarColorHex = await fetchPrimaryCalendarColor(accessToken)
  const nextEvents = [...localEvents]

  for (let index = 0; index < nextEvents.length; index += 1) {
    const event = nextEvents[index]

    if (event.syncStatus === 'pending_create') {
      const created = await googleFetch<GoogleEventItem>(accessToken, '/calendars/primary/events', {
        method: 'POST',
        body: JSON.stringify(buildGooglePayload(event)),
      })

      nextEvents[index] = {
        ...event,
        source: 'google',
        syncStatus: 'synced',
        updatedAt: created.updated ? new Date(created.updated).toISOString() : new Date().toISOString(),
        googleEventId: created.id,
        googleEtag: created.etag,
      }
      continue
    }

    if (event.syncStatus === 'pending_update') {
      if (!event.googleEventId) {
        const created = await googleFetch<GoogleEventItem>(accessToken, '/calendars/primary/events', {
          method: 'POST',
          body: JSON.stringify(buildGooglePayload(event)),
        })
        nextEvents[index] = {
          ...event,
          source: 'google',
          syncStatus: 'synced',
          updatedAt: created.updated ? new Date(created.updated).toISOString() : new Date().toISOString(),
          googleEventId: created.id,
          googleEtag: created.etag,
        }
      } else {
        const updated = await googleFetch<GoogleEventItem>(
          accessToken,
          `/calendars/primary/events/${event.googleEventId}`,
          {
            method: 'PATCH',
            body: JSON.stringify(
              buildGooglePayload(event, {
                clearColorToDefault: event.colorId === '12',
              }),
            ),
          },
        )
        nextEvents[index] = {
          ...event,
          source: 'google',
          syncStatus: 'synced',
          updatedAt: updated.updated ? new Date(updated.updated).toISOString() : new Date().toISOString(),
          googleEtag: updated.etag,
        }
      }
      continue
    }

    if (event.syncStatus === 'pending_delete') {
      if (event.googleEventId) {
        await googleFetch<void>(accessToken, `/calendars/primary/events/${event.googleEventId}`, {
          method: 'DELETE',
        })
      }

      nextEvents[index] = {
        ...event,
        syncStatus: 'synced',
        updatedAt: new Date().toISOString(),
      }
    }
  }

  const remote = await fetchAllPrimaryEvents(accessToken)
  const merged = mergeRemoteEvents(nextEvents, remote, primaryCalendarColorHex)

  return { events: merged, primaryCalendarColorHex }
}
