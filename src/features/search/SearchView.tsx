import { format } from 'date-fns'
import { useEffect, useMemo, useRef } from 'react'
import { colorHexById } from '../events/googleColors'
import type { CalendarEvent } from '../../lib/types/events'

interface SearchViewProps {
  events: CalendarEvent[]
  query: string
  onSelectEvent: (event: CalendarEvent) => void
}

function sortByStartDesc(a: CalendarEvent, b: CalendarEvent): number {
  return new Date(b.start).getTime() - new Date(a.start).getTime()
}

export function SearchView({ events, query, onSelectEvent }: SearchViewProps) {
  const listRef = useRef<HTMLDivElement | null>(null)

  const normalizedQuery = query.trim().toLowerCase()

  const results = useMemo(() => {
    if (!normalizedQuery) {
      return [] as CalendarEvent[]
    }

    return events
      .filter((event) => {
        const title = event.title.toLowerCase()
        const description = (event.description ?? '').toLowerCase()
        return title.includes(normalizedQuery) || description.includes(normalizedQuery)
      })
      .sort(sortByStartDesc)
  }, [events, normalizedQuery])

  const closestResultId = useMemo(() => {
    if (results.length === 0) {
      return null
    }

    const now = Date.now()
    let closest = results[0]
    let closestDistance = Math.abs(new Date(closest.start).getTime() - now)

    for (let index = 1; index < results.length; index += 1) {
      const next = results[index]
      const distance = Math.abs(new Date(next.start).getTime() - now)
      if (distance < closestDistance) {
        closest = next
        closestDistance = distance
      }
    }

    return closest.id
  }, [results])

  useEffect(() => {
    if (!closestResultId || !listRef.current) {
      return
    }

    const target = listRef.current.querySelector<HTMLDivElement>(`[data-event-id="${closestResultId}"]`)
    target?.scrollIntoView({ block: 'center' })
  }, [closestResultId, query])

  if (!normalizedQuery) {
    return (
      <section className="search-view" aria-label="Search events view">
        <p className="search-empty">Type a query and press Enter to search events.</p>
      </section>
    )
  }

  if (results.length === 0) {
    return (
      <section className="search-view" aria-label="Search events view">
        <p className="search-empty">No results found.</p>
      </section>
    )
  }

  const oldest = results[results.length - 1]

  return (
    <section className="search-view" aria-label="Search events view">
      <div ref={listRef} className="search-results-scroll">
        {results.map((event, index) => {
          const start = new Date(event.start)
          const end = new Date(event.end)
          const year = format(start, 'yyyy')
          const previousYear = index > 0 ? format(new Date(results[index - 1].start), 'yyyy') : null
          const showYear = year !== previousYear
          const rangeLabel = event.allDay ? 'All day' : `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`

          return (
            <div key={event.id}>
              {showYear && <p className="search-year-separator">{year}</p>}
              <button
                type="button"
                className={`search-result-item ${event.id === closestResultId ? 'is-closest' : ''}`}
                data-event-id={event.id}
                onClick={() => onSelectEvent(event)}
              >
                <div className="search-result-date">
                  <span className="search-result-month">{format(start, 'MMM')}</span>
                  <strong className="search-result-day">{format(start, 'd')}</strong>
                </div>
                <div
                  className="search-result-event"
                  style={{
                    background: colorHexById(event.colorId, event.calendarDefaultColorHex),
                  }}
                >
                  <p className="search-result-title">{event.title}</p>
                  <p className="search-result-time">{rangeLabel}</p>
                </div>
              </button>
            </div>
          )
        })}
        <p className="search-end-note">No results past {format(new Date(oldest.start), 'MMM d, yyyy')}.</p>
      </div>
    </section>
  )
}
