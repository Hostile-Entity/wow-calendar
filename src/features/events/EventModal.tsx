import { useEffect, useRef, useState } from 'react'
import { getEventColors } from './googleColors'
import type { EventColorId } from '../../lib/types/events'

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
          className="event-title-input"
          value={formValues.title}
          onChange={(event) => setFormValues({ ...formValues, title: event.target.value })}
          placeholder="Event name"
          maxLength={80}
        />

        <div className="time-row">
          <label>
            Start
            <input
              type="datetime-local"
              step={900}
              value={formValues.start}
              onChange={(event) => setFormValues({ ...formValues, start: event.target.value })}
            />
          </label>
          <label>
            End
            <input
              type="datetime-local"
              step={900}
              value={formValues.end}
              onChange={(event) => setFormValues({ ...formValues, end: event.target.value })}
            />
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
