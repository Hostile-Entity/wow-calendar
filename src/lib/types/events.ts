export type EventColorId =
  | '12'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'

export type SyncStatus =
  | 'synced'
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete'
  | 'sync_error'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: string
  end: string
  allDay?: boolean
  calendarDefaultColorHex?: string
  colorId: EventColorId
  source: 'local' | 'google'
  syncStatus: SyncStatus
  updatedAt: string
  deletedAt?: string
  googleEventId?: string
  googleEtag?: string
}
