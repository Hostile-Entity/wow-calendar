import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAllEvents, saveEvent, saveEvents } from '../../lib/storage/db'
import type { CalendarEvent, EventColorId } from '../../lib/types/events'

interface CreateEventInput {
  title: string
  description: string
  start: string
  end: string
  colorId: EventColorId
}

interface UseEventsResult {
  allEvents: CalendarEvent[]
  visibleEvents: CalendarEvent[]
  loading: boolean
  createEvent: (input: CreateEventInput) => Promise<void>
  updateEvent: (event: CalendarEvent) => Promise<void>
  softDeleteEvent: (eventId: string) => Promise<void>
  replaceAllEvents: (events: CalendarEvent[]) => Promise<void>
}

function sortByStart(a: CalendarEvent, b: CalendarEvent): number {
  return new Date(a.start).getTime() - new Date(b.start).getTime()
}

export function useEvents(): UseEventsResult {
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void getAllEvents()
      .then((storedEvents) => setAllEvents(storedEvents.sort(sortByStart)))
      .finally(() => setLoading(false))
  }, [])

  const createEvent = useCallback(async (input: CreateEventInput) => {
    const now = new Date().toISOString()
    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      start: input.start,
      end: input.end,
      colorId: input.colorId,
      source: 'local',
      syncStatus: 'pending_create',
      updatedAt: now,
    }

    setAllEvents((events) => [...events, event].sort(sortByStart))
    await saveEvent(event)
  }, [])

  const updateEvent = useCallback(async (event: CalendarEvent) => {
    const updatedEvent: CalendarEvent = {
      ...event,
      syncStatus: event.syncStatus === 'pending_create' ? 'pending_create' : 'pending_update',
      updatedAt: new Date().toISOString(),
    }

    setAllEvents((events) =>
      events.map((existing) => (existing.id === updatedEvent.id ? updatedEvent : existing)).sort(sortByStart),
    )
    await saveEvent(updatedEvent)
  }, [])

  const softDeleteEvent = useCallback(async (eventId: string) => {
    const now = new Date().toISOString()
    const existing = allEvents.find((event) => event.id === eventId)
    if (!existing) {
      return
    }

    const deletedEvent: CalendarEvent = {
      ...existing,
      updatedAt: now,
      deletedAt: now,
      syncStatus: existing.syncStatus === 'pending_create' ? 'pending_delete' : 'pending_delete',
    }

    setAllEvents((events) =>
      events.map((event) => (event.id === eventId ? deletedEvent : event)).sort(sortByStart),
    )
    await saveEvent(deletedEvent)
  }, [allEvents])

  const replaceAllEvents = useCallback(async (events: CalendarEvent[]) => {
    const sorted = [...events].sort(sortByStart)
    setAllEvents(sorted)
    await saveEvents(sorted)
  }, [])

  const visibleEvents = useMemo(
    () => allEvents.filter((event) => !event.deletedAt).sort(sortByStart),
    [allEvents],
  )

  return {
    allEvents,
    visibleEvents,
    loading,
    createEvent,
    updateEvent,
    softDeleteEvent,
    replaceAllEvents,
  }
}
