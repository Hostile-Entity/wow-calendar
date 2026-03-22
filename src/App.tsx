import { addMinutes, addWeeks, startOfWeek } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountMenu } from './features/auth/AccountMenu'
import { useGoogleAuth } from './features/auth/useGoogleAuth'
import { WeekCalendar } from './features/calendar/WeekCalendar'
import { EventModal, type EventFormValues } from './features/events/EventModal'
import { useEvents } from './features/events/useEvents'
import { SettingsMenu } from './features/settings/SettingsMenu'
import { fetchPrimaryCalendarColor, syncWithGoogleCalendar } from './features/sync/googleSync'
import { SyncPanel } from './features/sync/SyncPanel'
import { getAllEvents, getMeta, setMeta } from './lib/storage/db'
import type { CalendarEvent } from './lib/types/events'

const ZOOM_META_KEY = 'calendar:zoom'
const GOOGLE_PRIMARY_COLOR_META_KEY = 'google:primaryColorHex'
const DEBUG_MODE_META_KEY = 'app:debugMode'
const AUTO_SYNC_META_KEY = 'app:autoSync'
const THEME_META_KEY = 'app:theme'
const THEME_LOCAL_STORAGE_KEY = 'wow-calendar-theme'
const DEFAULT_SLOT_HEIGHT = 16

function initialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(THEME_LOCAL_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  const domTheme = document.documentElement.dataset.theme
  return domTheme === 'dark' ? 'dark' : 'light'
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  const timezoneOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function fromLocalInputValue(localValue: string): string {
  return new Date(localValue).toISOString()
}

function buildFormValues(start: Date, end: Date): EventFormValues {
  return {
    title: '',
    description: '',
    start: toLocalInputValue(start.toISOString()),
    end: toLocalInputValue(end.toISOString()),
    colorId: '12',
  }
}

function applyCalendarDefaultColorToEvents(
  events: CalendarEvent[],
  nextColor: string,
  previousColor?: string,
): CalendarEvent[] {
  if (!nextColor || nextColor === previousColor) {
    return events
  }

  let changed = false
  const updated = events.map((event) => {
    if (event.colorId !== '12' || event.calendarDefaultColorHex === nextColor) {
      return event
    }

    changed = true
    return {
      ...event,
      calendarDefaultColorHex: nextColor,
    }
  })

  return changed ? updated : events
}

function App() {
  const { allEvents, visibleEvents, loading, createEvent, updateEvent, softDeleteEvent, replaceAllEvents } =
    useEvents()
  const { isReady, isConnected, ensureAccessToken, authenticate, disconnect, error, profile } =
    useGoogleAuth()
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [slotHeight, setSlotHeight] = useState(DEFAULT_SLOT_HEIGHT)
  const [calendarDefaultColorHex, setCalendarDefaultColorHex] = useState<string | undefined>(undefined)
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme)
  const [autoSync, setAutoSync] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugReady, setDebugReady] = useState(false)
  const [autoSyncReady, setAutoSyncReady] = useState(false)
  const [themeReady, setThemeReady] = useState(false)
  const [zoomReady, setZoomReady] = useState(false)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [formValues, setFormValues] = useState<EventFormValues | null>(null)
  const autoSyncBootstrapRef = useRef(false)
  const syncInFlightRef = useRef(false)

  useEffect(() => {
    void getMeta<number>(ZOOM_META_KEY)
      .then((storedZoom) => {
        if (typeof storedZoom === 'number') {
          setSlotHeight(storedZoom)
        }
      })
      .finally(() => setZoomReady(true))

    void getMeta<string>(GOOGLE_PRIMARY_COLOR_META_KEY).then((storedColor) => {
      if (storedColor) {
        setCalendarDefaultColorHex(storedColor)
      }
    })

    void getMeta<boolean>(DEBUG_MODE_META_KEY)
      .then((storedDebug) => {
        if (typeof storedDebug === 'boolean') {
          setDebugMode(storedDebug)
        }
      })
      .finally(() => setDebugReady(true))

    void getMeta<boolean>(AUTO_SYNC_META_KEY)
      .then((storedAutoSync) => {
        if (typeof storedAutoSync === 'boolean') {
          setAutoSync(storedAutoSync)
        }
      })
      .finally(() => setAutoSyncReady(true))

    void getMeta<'light' | 'dark'>(THEME_META_KEY)
      .then((storedTheme) => {
        if (storedTheme === 'light' || storedTheme === 'dark') {
          setTheme(storedTheme)
        }
      })
      .finally(() => setThemeReady(true))
  }, [])

  useEffect(() => {
    if (!zoomReady) {
      return
    }
    void setMeta(ZOOM_META_KEY, slotHeight)
  }, [slotHeight, zoomReady])

  useEffect(() => {
    if (!debugReady) {
      return
    }
    void setMeta(DEBUG_MODE_META_KEY, debugMode)
  }, [debugMode, debugReady])

  useEffect(() => {
    if (!autoSyncReady) {
      return
    }
    void setMeta(AUTO_SYNC_META_KEY, autoSync)
  }, [autoSync, autoSyncReady])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_LOCAL_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!themeReady) {
      return
    }
    void setMeta(THEME_META_KEY, theme)
  }, [theme, themeReady])

  useEffect(() => {
    if (!isConnected || calendarDefaultColorHex) {
      return
    }

    void ensureAccessToken()
      .then((token) => fetchPrimaryCalendarColor(token))
      .then((primaryColor) => {
        if (!primaryColor) {
          return
        }

        if (primaryColor === calendarDefaultColorHex) {
          return
        }

        setCalendarDefaultColorHex(primaryColor)
        void setMeta(GOOGLE_PRIMARY_COLOR_META_KEY, primaryColor)

        const updatedEvents = applyCalendarDefaultColorToEvents(allEvents, primaryColor, calendarDefaultColorHex)
        if (updatedEvents !== allEvents) {
          void replaceAllEvents(updatedEvents)
        }
      })
      .catch(() => {
        return
      })
  }, [allEvents, calendarDefaultColorHex, ensureAccessToken, isConnected, replaceAllEvents])

  const pendingEvents = useMemo(
    () =>
      allEvents.filter((event) => {
        return event.syncStatus.startsWith('pending')
      }),
    [allEvents],
  )

  const handleGoogleSync = useCallback(async () => {
    if (!isConnected || syncInFlightRef.current) {
      return
    }

    syncInFlightRef.current = true
    try {
      const accessToken = await ensureAccessToken()
      const localEvents = await getAllEvents()
      const { events, primaryCalendarColorHex } = await syncWithGoogleCalendar(accessToken, localEvents)
      const eventsWithColor =
        primaryCalendarColorHex && primaryCalendarColorHex !== calendarDefaultColorHex
          ? applyCalendarDefaultColorToEvents(events, primaryCalendarColorHex, calendarDefaultColorHex)
          : events

      await replaceAllEvents(eventsWithColor)

      if (primaryCalendarColorHex && primaryCalendarColorHex !== calendarDefaultColorHex) {
        setCalendarDefaultColorHex(primaryCalendarColorHex)
        await setMeta(GOOGLE_PRIMARY_COLOR_META_KEY, primaryCalendarColorHex)
      }
    } finally {
      syncInFlightRef.current = false
    }
  }, [calendarDefaultColorHex, ensureAccessToken, isConnected, replaceAllEvents])

  useEffect(() => {
    if (!autoSync) {
      autoSyncBootstrapRef.current = false
    }
  }, [autoSync])

  useEffect(() => {
    if (!autoSync || !isConnected || loading || autoSyncBootstrapRef.current) {
      return
    }

    autoSyncBootstrapRef.current = true
    void handleGoogleSync()
  }, [autoSync, handleGoogleSync, isConnected, loading])

  const handleAuthenticate = async () => {
    const accessToken = await authenticate()
    const primaryColor = await fetchPrimaryCalendarColor(accessToken)
    if (primaryColor && primaryColor !== calendarDefaultColorHex) {
      setCalendarDefaultColorHex(primaryColor)
      await setMeta(GOOGLE_PRIMARY_COLOR_META_KEY, primaryColor)

      const updatedEvents = applyCalendarDefaultColorToEvents(allEvents, primaryColor, calendarDefaultColorHex)
      if (updatedEvents !== allEvents) {
        await replaceAllEvents(updatedEvents)
      }
    }
  }

  const handleCreateAt = (start: Date) => {
    const end = addMinutes(start, 30)
    setEditingEvent(null)
    setFormValues(buildFormValues(start, end))
    setEventModalOpen(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event)
    setFormValues({
      title: event.title,
      description: event.description ?? '',
      start: toLocalInputValue(event.start),
      end: toLocalInputValue(event.end),
      colorId: event.colorId,
    })
    setEventModalOpen(true)
  }

  const closeModal = () => {
    setEventModalOpen(false)
    setEditingEvent(null)
    setFormValues(null)
  }

  const handleSubmitEvent = async (values: EventFormValues) => {
    if (editingEvent) {
      await updateEvent({
        ...editingEvent,
        title: values.title,
        description: values.description,
        colorId: values.colorId,
        start: fromLocalInputValue(values.start),
        end: fromLocalInputValue(values.end),
      })
      closeModal()
      if (autoSync) {
        void handleGoogleSync()
      }
      return
    }

    await createEvent({
      title: values.title,
      description: values.description,
      colorId: values.colorId,
      start: fromLocalInputValue(values.start),
      end: fromLocalInputValue(values.end),
    })
    closeModal()
    if (autoSync) {
      void handleGoogleSync()
    }
  }

  const handleDelete = async () => {
    if (!editingEvent) {
      return
    }
    await softDeleteEvent(editingEvent.id)
    closeModal()
    if (autoSync) {
      void handleGoogleSync()
    }
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="top-bar-left">
          <AccountMenu
            isReady={isReady}
            isConnected={isConnected}
            profile={profile}
            authError={error}
            onAuthenticate={handleAuthenticate}
            onDisconnect={disconnect}
          />
        </div>

        <div className="top-bar-actions">
          <button type="button" onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </button>
        </div>

        <div className="top-bar-right">
          <SettingsMenu
            theme={theme}
            onThemeChange={setTheme}
            autoSync={autoSync}
            onAutoSyncChange={setAutoSync}
            debugMode={debugMode}
            onDebugModeChange={setDebugMode}
          />
        </div>
      </header>

      {debugMode && (
        <SyncPanel
          pendingEvents={pendingEvents}
          isConnected={isConnected}
          authError={error}
          onSync={handleGoogleSync}
        />
      )}

      {loading ? (
        <section className="week-calendar loading-state">Loading local calendar...</section>
      ) : (
        <WeekCalendar
          weekStart={currentWeek}
          events={visibleEvents}
          slotHeight={slotHeight}
          calendarDefaultColorHex={calendarDefaultColorHex}
          onSlotHeightChange={setSlotHeight}
          onCreateAt={handleCreateAt}
          onEditEvent={handleEditEvent}
          onNavigateWeek={(direction) => setCurrentWeek((date) => addWeeks(date, direction))}
        />
      )}

      <EventModal
        key={editingEvent?.id ?? formValues?.start ?? 'event-modal'}
        open={eventModalOpen}
        initialValues={formValues}
        editMode={Boolean(editingEvent)}
        calendarDefaultColorHex={calendarDefaultColorHex}
        onClose={closeModal}
        onDelete={editingEvent ? handleDelete : undefined}
        onSave={handleSubmitEvent}
      />
    </main>
  )
}

export default App
