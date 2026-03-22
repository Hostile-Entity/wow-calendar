import { useEffect, useRef, useState } from 'react'
import { getEventColors } from './googleColors'
import type { EventColorId } from '../../lib/types/events'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => hour.toString().padStart(2, '0'))
const MINUTE_OPTIONS = ['00', '15', '30', '45'] as const

function normalizeQuarterMinute(minute: string): string {
  const numericMinute = Number(minute)
  if (!Number.isFinite(numericMinute)) {
    return '00'
  }

  const bounded = Math.max(0, Math.min(59, numericMinute))
  const rounded = Math.round(bounded / 15) * 15
  return `${rounded % 60}`.padStart(2, '0')
}

function parseLocalDateTime(value: string): { date: string; hour: string; minute: string } {
  const [datePart, timePart = '00:00'] = value.split('T')
  const [hourPart = '00', minutePart = '00'] = timePart.split(':')

  const date = /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : new Date().toISOString().slice(0, 10)
  const hour = HOUR_OPTIONS.includes(hourPart.padStart(2, '0')) ? hourPart.padStart(2, '0') : '00'
  const minute = normalizeQuarterMinute(minutePart)

  return { date, hour, minute }
}

function composeLocalDateTime(date: string, hour: string, minute: string): string {
  return `${date}T${hour}:${minute}`
}

export interface EventFormValues {
  title: string
  description: string
  start: string
  end: string
  colorId: EventColorId
}

interface EventModalProps {
  open: boolean
  initialValues: EventFormValues | null
  editMode: boolean
  calendarDefaultColorHex?: string
  onClose: () => void
  onSave: (values: EventFormValues) => Promise<void>
  onDelete?: () => Promise<void>
}

export function EventModal({
  open,
  initialValues,
  editMode,
  calendarDefaultColorHex,
  onClose,
  onSave,
  onDelete,
}: EventModalProps) {
  const [formValues, setFormValues] = useState<EventFormValues | null>(initialValues)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open || editMode) {
      return
    }

    const id = window.requestAnimationFrame(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(id)
  }, [editMode, open])

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current) {
        return
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  if (!open || !formValues) {
    return null
  }

  const startParts = parseLocalDateTime(formValues.start)
  const endParts = parseLocalDateTime(formValues.end)

  const updateDateTimePart = (
    field: 'start' | 'end',
    nextParts: Partial<{ date: string; hour: string; minute: string }>,
  ) => {
    const baseParts = parseLocalDateTime(formValues[field])
    const merged = {
      ...baseParts,
      ...nextParts,
    }

    setFormValues({
      ...formValues,
      [field]: composeLocalDateTime(merged.date, merged.hour, merged.minute),
    })
  }

  const handleSave = () => {
    if (!formValues.title.trim()) {
      setError('Event name is required.')
      return
    }

    if (new Date(formValues.end) <= new Date(formValues.start)) {
      setError('End time must be after start time.')
      return
    }

    setError(null)
    void onSave({
      ...formValues,
      title: formValues.title.trim(),
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="event-modal"
        role="dialog"
        aria-modal="true"
        aria-label={editMode ? 'Edit event' : 'Create event'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-top-actions">
          <button type="button" className="modal-top-button" onClick={onClose} aria-label="Close event editor">
            x
          </button>

          <div className="modal-top-right">
            <button type="button" className="primary modal-top-button" onClick={handleSave}>
              {editMode ? 'Save' : 'Create event'}
            </button>

            {editMode && onDelete && (
              <div className="event-menu" ref={menuRef}>
                <button
                  type="button"
                  className="menu-button modal-top-button"
                  aria-label="Open event actions"
                  onClick={() => setMenuOpen((state) => !state)}
                >
                  ...
                </button>

                {menuOpen && (
                  <div className="event-menu-popover">
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setMenuOpen(false)
                        void onDelete()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <input
          ref={titleInputRef}
          className="event-title-input"
          value={formValues.title}
          onChange={(event) => setFormValues({ ...formValues, title: event.target.value })}
          placeholder="Event name"
          maxLength={80}
        />

        <div className="time-row">
          <label>
            Start
            <div className="date-time-grid">
              <input
                type="date"
                value={startParts.date}
                onChange={(event) => updateDateTimePart('start', { date: event.target.value })}
              />
              <div className="time-selects">
                <select
                  value={startParts.hour}
                  onChange={(event) => updateDateTimePart('start', { hour: event.target.value })}
                >
                  {HOUR_OPTIONS.map((hour) => (
                    <option key={`start-hour-${hour}`} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
                <span>:</span>
                <select
                  value={startParts.minute}
                  onChange={(event) => updateDateTimePart('start', { minute: event.target.value })}
                >
                  {MINUTE_OPTIONS.map((minute) => (
                    <option key={`start-minute-${minute}`} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </label>
          <label>
            End
            <div className="date-time-grid">
              <input
                type="date"
                value={endParts.date}
                onChange={(event) => updateDateTimePart('end', { date: event.target.value })}
              />
              <div className="time-selects">
                <select
                  value={endParts.hour}
                  onChange={(event) => updateDateTimePart('end', { hour: event.target.value })}
                >
                  {HOUR_OPTIONS.map((hour) => (
                    <option key={`end-hour-${hour}`} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
                <span>:</span>
                <select
                  value={endParts.minute}
                  onChange={(event) => updateDateTimePart('end', { minute: event.target.value })}
                >
                  {MINUTE_OPTIONS.map((minute) => (
                    <option key={`end-minute-${minute}`} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </label>
        </div>

        <fieldset>
          <legend>Color</legend>
          <div className="color-options">
            {getEventColors(calendarDefaultColorHex).map((color) => (
              <button
                key={color.id}
                type="button"
                className={formValues.colorId === color.id ? 'active' : ''}
                style={{ backgroundColor: color.hex }}
                onClick={() => setFormValues({ ...formValues, colorId: color.id })}
                aria-label={color.label}
              />
            ))}
          </div>
        </fieldset>

        <textarea
          className="event-description-input"
          value={formValues.description}
          onChange={(event) => setFormValues({ ...formValues, description: event.target.value })}
          placeholder="Add description"
          maxLength={2000}
        />

        {error && <p className="error-text">{error}</p>}
      </section>
    </div>
  )
}
