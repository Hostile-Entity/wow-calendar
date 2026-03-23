import { addDays, addMinutes, addWeeks, format, startOfDay, startOfWeek } from 'date-fns'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AccountMenu } from './features/auth/AccountMenu'
import { useGoogleAuth } from './features/auth/useGoogleAuth'
import { WeekCalendar } from './features/calendar/WeekCalendar'
import { EventModal, type EventFormValues } from './features/events/EventModal'
import { useEvents } from './features/events/useEvents'
import { SearchView } from './features/search/SearchView'
import { SettingsMenu } from './features/settings/SettingsMenu'
import { fetchPrimaryCalendarColor, syncWithGoogleCalendar } from './features/sync/googleSync'
import { SyncPanel } from './features/sync/SyncPanel'
import { clearLocalDatabase, getAllEvents, getMeta, setMeta } from './lib/storage/db'
import type { CalendarEvent } from './lib/types/events'
import searchIcon from './assets/icons/search.svg'

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
  const { isReady, isConnected, ensureAccessToken, authenticate, disconnect, clearLocalAuthData, error, profile } =
    useGoogleAuth()
  const [currentWeek, setCurrentWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))
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
  const [jumpDateValue, setJumpDateValue] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [searchViewOpen, setSearchViewOpen] = useState(false)
  const [searchInputValue, setSearchInputValue] = useState('')
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('')
  const [focusTimestamp, setFocusTimestamp] = useState<number | null>(null)
  const autoSyncBootstrapRef = useRef(false)
  const syncInFlightRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const dateJumpInputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

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

  const calendarRenderWindowEvents = useMemo(() => {
    const windowStart = startOfDay(addWeeks(currentWeek, -1))
    const windowEndExclusive = startOfDay(addWeeks(currentWeek, 2))

    return visibleEvents.filter((event) => {
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)
      return eventEnd > windowStart && eventStart < windowEndExclusive
    })
  }, [currentWeek, visibleEvents])

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

  const handleCreateAt = useCallback((start: Date) => {
    const end = addMinutes(start, 30)
    setEditingEvent(null)
    setFormValues(buildFormValues(start, end))
    setEventModalOpen(true)
  }, [])

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    setEditingEvent(event)
    setFormValues({
      title: event.title,
      description: event.description ?? '',
      start: toLocalInputValue(event.start),
      end: toLocalInputValue(event.end),
      colorId: event.colorId,
    })
    setEventModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setEventModalOpen(false)
    setEditingEvent(null)
    setFormValues(null)
  }, [])

  const handleSubmitEvent = useCallback(async (values: EventFormValues) => {
    if (saveInFlightRef.current) {
      return
    }

    saveInFlightRef.current = true
    const eventToUpdate = editingEvent
    closeModal()

    try {
      if (eventToUpdate) {
        await updateEvent({
          ...eventToUpdate,
          title: values.title,
          description: values.description,
          colorId: values.colorId,
          start: fromLocalInputValue(values.start),
          end: fromLocalInputValue(values.end),
        })
      } else {
        await createEvent({
          title: values.title,
          description: values.description,
          colorId: values.colorId,
          start: fromLocalInputValue(values.start),
          end: fromLocalInputValue(values.end),
        })
      }

      if (autoSync) {
        void handleGoogleSync()
      }
    } finally {
      saveInFlightRef.current = false
    }
  }, [autoSync, closeModal, createEvent, editingEvent, handleGoogleSync, updateEvent])

  const handleDelete = useCallback(async () => {
    if (!editingEvent) {
      return
    }
    await softDeleteEvent(editingEvent.id)
    closeModal()
    if (autoSync) {
      void handleGoogleSync()
    }
  }, [autoSync, editingEvent, handleGoogleSync, softDeleteEvent, closeModal])

  const handleNavigateWeek = useCallback((direction: -1 | 1) => {
    setCurrentWeek((date) => addWeeks(date, direction))
  }, [])

  const currentWeekMonthLabel = useMemo(() => format(addDays(currentWeek, 3), 'MMM yyyy'), [currentWeek])
  const todayDateLabel = format(new Date(), 'd')

  const handleJumpToToday = useCallback(() => {
    const now = new Date()
    setCurrentWeek(startOfWeek(now, { weekStartsOn: 0 }))
    setJumpDateValue(format(now, 'yyyy-MM-dd'))
    setFocusTimestamp(now.getTime())
  }, [])

  const handleOpenDatePicker = useCallback(() => {
    const input = dateJumpInputRef.current
    if (!input) {
      return
    }

    setJumpDateValue(format(addDays(currentWeek, 3), 'yyyy-MM-dd'))

    const inputWithPicker = input as HTMLInputElement & { showPicker?: () => void }
    if (typeof inputWithPicker.showPicker === 'function') {
      inputWithPicker.showPicker()
      return
    }

    input.click()
  }, [currentWeek])

  const handleJumpDateSelect = useCallback((nextDateValue: string) => {
    if (!nextDateValue) {
      return
    }

    const selectedDate = new Date(`${nextDateValue}T12:00:00`)
    if (Number.isNaN(selectedDate.getTime())) {
      return
    }

    setJumpDateValue(nextDateValue)
    setCurrentWeek(startOfWeek(selectedDate, { weekStartsOn: 0 }))
  }, [])

  const handleClearLocalData = useCallback(async () => {
    const keysToRemove: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key) {
        continue
      }
      if (key.startsWith('wow-calendar') || key === THEME_LOCAL_STORAGE_KEY) {
        keysToRemove.push(key)
      }
    }

    await clearLocalDatabase()
    clearLocalAuthData()
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }

    window.location.reload()
  }, [clearLocalAuthData])

  const openSearchView = useCallback(() => {
    setSearchViewOpen(true)
  }, [])

  const closeSearchView = useCallback(() => {
    setSearchViewOpen(false)
  }, [])

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmittedSearchQuery(searchInputValue.trim())
    },
    [searchInputValue],
  )

  useEffect(() => {
    if (!searchViewOpen) {
      return
    }
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [searchViewOpen])

  const handleSelectSearchEvent = useCallback((event: CalendarEvent) => {
    const startDate = new Date(event.start)
    if (Number.isNaN(startDate.getTime())) {
      return
    }

    setCurrentWeek(startOfWeek(startDate, { weekStartsOn: 0 }))
    setFocusTimestamp(startDate.getTime())
    setSearchViewOpen(false)
  }, [])

  return (
    <main className="app-shell">
      {searchViewOpen ? (
        <header className="top-bar top-bar-search">
          <button type="button" className="search-back-button" onClick={closeSearchView} aria-label="Back to calendar">
            ←
          </button>
          <form className="search-header-form" onSubmit={handleSearchSubmit}>
            <input
              ref={searchInputRef}
              className="search-header-input"
              value={searchInputValue}
              onChange={(event) => setSearchInputValue(event.target.value)}
              placeholder="Search events"
            />
          </form>
        </header>
      ) : (
        <header className="top-bar">
          <div className="top-bar-left">
            <div className="top-bar-left-controls">
              <AccountMenu
                isReady={isReady}
                isConnected={isConnected}
                profile={profile}
                authError={error}
                onAuthenticate={handleAuthenticate}
                onDisconnect={disconnect}
              />

              <div className="date-jump">
                <button type="button" className="date-jump-button" onClick={handleOpenDatePicker}>
                  {currentWeekMonthLabel}
                </button>
                <input
                  ref={dateJumpInputRef}
                  className="date-jump-native-input"
                  type="date"
                  tabIndex={-1}
                  aria-hidden="true"
                  value={jumpDateValue}
                  onChange={(jumpEvent) => handleJumpDateSelect(jumpEvent.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="top-bar-actions">
            <button type="button" className="search-button" onClick={openSearchView} aria-label="Search events">
              <img src={searchIcon} alt="" aria-hidden="true" />
            </button>
            <button type="button" className="today-date-button" onClick={handleJumpToToday} aria-label="Go to today">
              {todayDateLabel}
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
            onClearLocalData={handleClearLocalData}
          />
          </div>
        </header>
      )}

      {!searchViewOpen && debugMode && (
        <SyncPanel
          pendingEvents={pendingEvents}
          isConnected={isConnected}
          authError={error}
          onSync={handleGoogleSync}
        />
      )}

      {searchViewOpen ? (
        <SearchView events={visibleEvents} query={submittedSearchQuery} onSelectEvent={handleSelectSearchEvent} />
      ) : loading ? (
        <section className="week-calendar loading-state">Loading local calendar...</section>
      ) : (
        <WeekCalendar
          weekStart={currentWeek}
          events={calendarRenderWindowEvents}
          slotHeight={slotHeight}
          focusTimestamp={focusTimestamp}
          calendarDefaultColorHex={calendarDefaultColorHex}
          onSlotHeightChange={setSlotHeight}
          onCreateAt={handleCreateAt}
          onEditEvent={handleEditEvent}
          onNavigateWeek={handleNavigateWeek}
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
