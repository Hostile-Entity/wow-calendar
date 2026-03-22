import type { EventColorId } from '../../lib/types/events'

export const FALLBACK_CALENDAR_DEFAULT_COLOR = '#5f6368'

export const GOOGLE_EVENT_COLORS: Array<{ id: EventColorId; label: string; hex: string }> = [
  { id: '1', label: 'Lavender', hex: '#7986cb' },
  { id: '2', label: 'Sage', hex: '#33b679' },
  { id: '3', label: 'Grape', hex: '#8e24aa' },
  { id: '4', label: 'Flamingo', hex: '#e67c73' },
  { id: '5', label: 'Banana', hex: '#f6bf26' },
  { id: '6', label: 'Tangerine', hex: '#f4511e' },
  { id: '7', label: 'Peacock', hex: '#039be5' },
  { id: '8', label: 'Graphite', hex: '#616161' },
  { id: '9', label: 'Blueberry', hex: '#3f51b5' },
  { id: '10', label: 'Basil', hex: '#0b8043' },
  { id: '11', label: 'Tomato', hex: '#d50000' },
  { id: '12', label: 'Calendar', hex: FALLBACK_CALENDAR_DEFAULT_COLOR },
]

export function getEventColors(calendarDefaultColorHex?: string) {
  return GOOGLE_EVENT_COLORS.map((color) => {
    if (color.id !== '12') {
      return color
    }

    return {
      ...color,
      hex: calendarDefaultColorHex ?? FALLBACK_CALENDAR_DEFAULT_COLOR,
    }
  })
}

export function colorHexById(id: EventColorId, calendarDefaultColorHex?: string): string {
  return getEventColors(calendarDefaultColorHex).find((color) => color.id === id)?.hex ?? '#3f51b5'
}
