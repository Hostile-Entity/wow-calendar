import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CalendarEvent } from '../types/events'

interface WowCalendarDb extends DBSchema {
  events: {
    key: string
    value: CalendarEvent
    indexes: {
      by_updatedAt: string
    }
  }
  meta: {
    key: string
    value: {
      key: string
      value: unknown
    }
  }
}

let dbPromise: Promise<IDBPDatabase<WowCalendarDb>> | undefined

function getDb(): Promise<IDBPDatabase<WowCalendarDb>> {
  if (!dbPromise) {
    dbPromise = openDB<WowCalendarDb>('wow-calendar', 1, {
      upgrade(db) {
        const eventsStore = db.createObjectStore('events', { keyPath: 'id' })
        eventsStore.createIndex('by_updatedAt', 'updatedAt')
        db.createObjectStore('meta', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

export async function getAllEvents(): Promise<CalendarEvent[]> {
  const db = await getDb()
  return db.getAll('events')
}

export async function saveEvent(event: CalendarEvent): Promise<void> {
  const db = await getDb()
  await db.put('events', event)
}

export async function saveEvents(events: CalendarEvent[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('events', 'readwrite')
  for (const event of events) {
    await tx.store.put(event)
  }
  await tx.done
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  const data = await db.get('meta', key)
  return data?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb()
  await db.put('meta', { key, value })
}
