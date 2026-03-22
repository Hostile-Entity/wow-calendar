import { addDays, differenceInMinutes, format, startOfDay } from 'date-fns'
import { useMemo, useRef, type TouchEvent } from 'react'
import { colorHexById } from '../events/googleColors'
import type { CalendarEvent } from '../../lib/types/events'

const SLOT_MINUTES = 15
const TOTAL_MINUTES_PER_DAY = 24 * 60
const TOTAL_SLOTS = TOTAL_MINUTES_PER_DAY / SLOT_MINUTES
const MIN_SLOT_HEIGHT = 10
const MAX_SLOT_HEIGHT = 32

interface WeekCalendarProps {
  weekStart: Date
  events: CalendarEvent[]
  slotHeight: number
  calendarDefaultColorHex?: string
  onSlotHeightChange: (nextHeight: number) => void
  onCreateAt: (date: Date) => void
  onEditEvent: (event: CalendarEvent) => void
  onNavigateWeek: (direction: -1 | 1) => void
}

interface PinchSnapshot {
  distance: number
  initialSlotHeight: number
}

interface SwipeSnapshot {
  x: number
  y: number
  time: number
}

function clampSlotHeight(value: number): number {
  return Math.max(MIN_SLOT_HEIGHT, Math.min(MAX_SLOT_HEIGHT, value))
}

function getTouchDistance(event: TouchEvent<HTMLDivElement>): number {
  const first = event.touches.item(0)
  const second = event.touches.item(1)
  if (!first || !second) {
    return 0
  }
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
}

function toSlotMinute(value: number): number {
  return Math.max(0, Math.min(TOTAL_MINUTES_PER_DAY - SLOT_MINUTES, Math.floor(value / SLOT_MINUTES) * SLOT_MINUTES))
}

export function WeekCalendar({
  weekStart,
  events,
  slotHeight,
  calendarDefaultColorHex,
  onSlotHeightChange,
  onCreateAt,
  onEditEvent,
  onNavigateWeek,
}: WeekCalendarProps) {
  const pinchRef = useRef<PinchSnapshot | null>(null)
  const swipeRef = useRef<SwipeSnapshot | null>(null)
  const suppressClickRef = useRef(false)

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const dayHeight = TOTAL_SLOTS * slotHeight

  return (
    <section className="week-calendar" aria-label="Weekly calendar">
        <div className="day-header-grid">
        <div className="time-cell">Time</div>
        {days.map((day) => (
          <div key={day.toISOString()} className="day-header-cell">
            <p>{format(day, 'EEE')}</p>
            <strong>{format(day, 'd')}</strong>
            <div className="all-day-tabs">
              {events
                .filter((event) => {
                  if (!event.allDay) {
                    return false
                  }
                  const dayStart = startOfDay(day)
                  const dayEnd = addDays(dayStart, 1)
                  const eventStart = new Date(event.start)
                  const eventEnd = new Date(event.end)
                  return eventEnd > dayStart && eventStart < dayEnd
                })
                .slice(0, 2)
                .map((event) => (
                  <button
                    key={`${event.id}-allday`}
                    type="button"
                    className="all-day-tab"
                    style={{ background: colorHexById(event.colorId, event.calendarDefaultColorHex ?? calendarDefaultColorHex) }}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation()
                      onEditEvent(event)
                    }}
                    aria-label={`All day: ${event.title}`}
                  >
                    {event.title}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="calendar-scroll"
        onWheel={(event) => {
          if (!event.ctrlKey) {
            return
          }
          event.preventDefault()
          const next = clampSlotHeight(slotHeight + -event.deltaY * 0.02)
          onSlotHeightChange(next)
        }}
        onTouchStart={(event) => {
          if (event.touches.length === 1) {
            const firstTouch = event.touches.item(0)
            if (firstTouch) {
              swipeRef.current = {
                x: firstTouch.clientX,
                y: firstTouch.clientY,
                time: Date.now(),
              }
            }
          }

          if (event.touches.length !== 2) {
            return
          }

          swipeRef.current = null
          pinchRef.current = {
            distance: getTouchDistance(event),
            initialSlotHeight: slotHeight,
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length !== 2 || !pinchRef.current) {
            return
          }

          const nextDistance = getTouchDistance(event)
          const ratio = nextDistance / Math.max(1, pinchRef.current.distance)
          onSlotHeightChange(clampSlotHeight(pinchRef.current.initialSlotHeight * ratio))
          event.preventDefault()
        }}
        onTouchEnd={(event) => {
          const wasPinching = Boolean(pinchRef.current)
          if (event.touches.length < 2) {
            pinchRef.current = null
          }

          if (wasPinching || !swipeRef.current) {
            return
          }

          const touch = event.changedTouches.item(0)
          if (!touch) {
            return
          }

          const deltaX = touch.clientX - swipeRef.current.x
          const deltaY = touch.clientY - swipeRef.current.y
          const elapsed = Date.now() - swipeRef.current.time
          swipeRef.current = null

          const isHorizontalSwipe =
            Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1 && elapsed < 900

          if (!isHorizontalSwipe) {
            return
          }

          suppressClickRef.current = true
          onNavigateWeek(deltaX < 0 ? 1 : -1)
        }}
        onTouchCancel={() => {
          pinchRef.current = null
          swipeRef.current = null
        }}
      >
        <div className="calendar-grid" style={{ height: dayHeight }}>
          <div className="time-column">
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} style={{ top: hour * 4 * slotHeight }}>
                {format(new Date(2026, 0, 1, hour), 'HH:mm')}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="day-column"
              onClick={(event) => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false
                  return
                }

                const rect = event.currentTarget.getBoundingClientRect()
                const minutesFromTop = ((event.clientY - rect.top) / slotHeight) * SLOT_MINUTES
                const slotMinute = toSlotMinute(minutesFromTop)
                const start = startOfDay(day)
                start.setMinutes(slotMinute)
                onCreateAt(start)
              }}
            >
              {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                <span
                  key={slot}
                  className={`time-slot-line ${slot % 4 === 0 ? 'hour-line' : ''}`}
                  style={{ top: slot * slotHeight }}
                />
              ))}

              {(() => {
                const dayStart = startOfDay(day)
                const dayEnd = addDays(dayStart, 1)

                const dayEvents = events
                  .filter((event) => {
                    if (event.allDay) {
                      return false
                    }
                    const eventStart = new Date(event.start)
                    const eventEnd = new Date(event.end)
                    return eventEnd > dayStart && eventStart < dayEnd
                  })
                  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

                return dayEvents.map((event, index) => {
                  const eventStart = new Date(event.start)
                  const eventEnd = new Date(event.end)

                  const displayStart = eventStart > dayStart ? eventStart : dayStart
                  const displayEnd = eventEnd < dayEnd ? eventEnd : dayEnd

                  const startMinute = Math.max(0, differenceInMinutes(displayStart, dayStart))
                  const durationMinutes = Math.max(SLOT_MINUTES, differenceInMinutes(displayEnd, displayStart))
                  const eventHeight = Math.max(slotHeight, (durationMinutes / SLOT_MINUTES) * slotHeight)

                  const overlapsEarlier = dayEvents.slice(0, index).some((previous) => {
                    const previousStart = new Date(previous.start)
                    const previousEnd = new Date(previous.end)
                    return previousEnd > eventStart && previousStart < eventEnd
                  })

                  return (
                    <span
                      key={event.id}
                      className="calendar-event"
                      style={{
                        top: (startMinute / SLOT_MINUTES) * slotHeight,
                        height: Math.max(1, eventHeight - 1),
                        left: overlapsEarlier ? '50%' : '0',
                        right: '0',
                        background: colorHexById(event.colorId, event.calendarDefaultColorHex ?? calendarDefaultColorHex),
                        zIndex: overlapsEarlier ? 2 : 1,
                      }}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        onEditEvent(event)
                      }}
                    >
                      <span className="event-title">{event.title}</span>
                    </span>
                  )
                })
              })()}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
