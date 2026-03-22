import { addDays, addWeeks, differenceInMinutes, format, startOfDay } from 'date-fns'
import { useEffect, useRef, useState, type CSSProperties, type TouchEvent as ReactTouchEvent } from 'react'
import { colorHexById } from '../events/googleColors'
import type { CalendarEvent } from '../../lib/types/events'

const SLOT_MINUTES = 15
const TOTAL_MINUTES_PER_DAY = 24 * 60
const TOTAL_SLOTS = TOTAL_MINUTES_PER_DAY / SLOT_MINUTES
const MIN_SLOT_HEIGHT = 10
const MAX_SLOT_HEIGHT = 32
const CENTER_TRACK_OFFSET = -33.333333
const PREV_TRACK_OFFSET = 0
const NEXT_TRACK_OFFSET = -66.666667

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

function getTouchDistance(event: ReactTouchEvent<HTMLDivElement>): number {
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
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pendingSlideRef = useRef<-1 | 1 | null>(null)
  const [slideOffset, setSlideOffset] = useState(CENTER_TRACK_OFFSET)
  const [slideAnimating, setSlideAnimating] = useState(false)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }

    const preventBrowserPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault()
      }
    }

    const preventGestureZoom = (event: Event) => {
      event.preventDefault()
    }

    element.addEventListener('touchmove', preventBrowserPinch, { passive: false })
    element.addEventListener('gesturestart', preventGestureZoom)
    element.addEventListener('gesturechange', preventGestureZoom)
    element.addEventListener('gestureend', preventGestureZoom)

    return () => {
      element.removeEventListener('touchmove', preventBrowserPinch)
      element.removeEventListener('gesturestart', preventGestureZoom)
      element.removeEventListener('gesturechange', preventGestureZoom)
      element.removeEventListener('gestureend', preventGestureZoom)
    }
  }, [])

  const dayHeight = TOTAL_SLOTS * slotHeight
  const calendarGridStyle = {
    height: dayHeight,
    '--slot-height': `${slotHeight}px`,
  } as CSSProperties

  const startSlide = (direction: -1 | 1) => {
    if (slideAnimating) {
      return
    }

    pendingSlideRef.current = direction
    setSlideAnimating(true)
    setSlideOffset(direction > 0 ? NEXT_TRACK_OFFSET : PREV_TRACK_OFFSET)
  }

  const renderWeekPane = (paneWeekStart: Date, interactive: boolean) => {
    const days = Array.from({ length: 7 }, (_, index) => addDays(paneWeekStart, index))

    return (
      <>
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
                      style={{
                        background: colorHexById(
                          event.colorId,
                          event.calendarDefaultColorHex ?? calendarDefaultColorHex,
                        ),
                      }}
                      onClick={(clickEvent) => {
                        if (!interactive) {
                          return
                        }
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
          ref={interactive ? scrollRef : undefined}
          onWheel={
            interactive
              ? (event) => {
                  if (!event.ctrlKey) {
                    return
                  }
                  event.preventDefault()
                  const next = clampSlotHeight(slotHeight + -event.deltaY * 0.02)
                  onSlotHeightChange(next)
                }
              : undefined
          }
          onTouchStart={
            interactive
              ? (event) => {
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
                }
              : undefined
          }
          onTouchMove={
            interactive
              ? (event) => {
                  if (event.touches.length !== 2 || !pinchRef.current) {
                    return
                  }

                  const nextDistance = getTouchDistance(event)
                  const ratio = nextDistance / Math.max(1, pinchRef.current.distance)
                  onSlotHeightChange(clampSlotHeight(pinchRef.current.initialSlotHeight * ratio))
                  event.preventDefault()
                }
              : undefined
          }
          onTouchEnd={
            interactive
              ? (event) => {
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
                  startSlide(deltaX < 0 ? 1 : -1)
                }
              : undefined
          }
          onTouchCancel={
            interactive
              ? () => {
                  pinchRef.current = null
                  swipeRef.current = null
                }
              : undefined
          }
        >
          <div className="calendar-grid" style={calendarGridStyle}>
            <div className="time-column">
              {Array.from({ length: 23 }, (_, index) => {
                const hour = index + 1
                return (
                <span key={hour} style={{ top: hour * 4 * slotHeight }}>
                  {format(new Date(2026, 0, 1, hour), 'HH:mm')}
                </span>
                )
              })}
            </div>

            {days.map((day) => (
              <div
                key={day.toISOString()}
                className="day-column"
                onClick={
                  interactive
                    ? (event) => {
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
                      }
                    : undefined
                }
              >
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
                          background: colorHexById(
                            event.colorId,
                            event.calendarDefaultColorHex ?? calendarDefaultColorHex,
                          ),
                          zIndex: overlapsEarlier ? 2 : 1,
                        }}
                        onClick={(clickEvent) => {
                          if (!interactive) {
                            return
                          }
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
      </>
    )
  }

  return (
    <section className="week-calendar" aria-label="Weekly calendar">
      <div
        className={`week-track ${slideAnimating ? 'animating' : ''}`}
        style={{ transform: `translateX(${slideOffset}%)` }}
        onTransitionEnd={() => {
          const direction = pendingSlideRef.current
          if (!direction) {
            return
          }

          pendingSlideRef.current = null
          setSlideAnimating(false)
          setSlideOffset(CENTER_TRACK_OFFSET)
          onNavigateWeek(direction)
        }}
      >
        <div className="week-page" aria-hidden={slideOffset !== CENTER_TRACK_OFFSET}>
          {renderWeekPane(addWeeks(weekStart, -1), false)}
        </div>
        <div className="week-page">{renderWeekPane(weekStart, true)}</div>
        <div className="week-page" aria-hidden={slideOffset !== CENTER_TRACK_OFFSET}>
          {renderWeekPane(addWeeks(weekStart, 1), false)}
        </div>
      </div>
    </section>
  )
}
