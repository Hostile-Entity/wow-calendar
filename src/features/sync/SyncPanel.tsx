import { useMemo, useState } from 'react'
import type { CalendarEvent } from '../../lib/types/events'
import { buildSyncPreview } from './googleSync'

const LARGE_PUSH_THRESHOLD = 20

interface SyncPanelProps {
  pendingEvents: CalendarEvent[]
  isConnected: boolean
  authError: string | null
  onSync: () => Promise<unknown>
}

export function SyncPanel({
  pendingEvents,
  isConnected,
  authError,
  onSync,
}: SyncPanelProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [statusText, setStatusText] = useState('Google sync')
  const [statusError, setStatusError] = useState<string | null>(null)

  const pendingOutboundCount = pendingEvents.length
  const preview = useMemo(() => buildSyncPreview(pendingEvents), [pendingEvents])

  return (
    <aside className="sync-panel" aria-label="Google Calendar sync panel">
      <div className="sync-summary">
        <p className="sync-label">{statusText}</p>
        <small className="sync-detail">
          {isConnected ? 'Connected' : 'Not connected'} - {pendingOutboundCount} pending - {preview.creates}C{' '}
          {preview.updates}U {preview.deletes}D
        </small>
        {(statusError || authError) && <small className="sync-error">{statusError ?? authError}</small>}
      </div>

      <div className="sync-actions">
        <button
          type="button"
          className="primary"
          disabled={isSyncing}
          onClick={() => {
            if (!isConnected) {
              setStatusError('Authenticate from the account icon first.')
              return
            }

            if (pendingOutboundCount > LARGE_PUSH_THRESHOLD) {
              const confirmed = window.confirm(
                `You are about to push ${pendingOutboundCount} changes to Google Calendar. Continue?`,
              )
              if (!confirmed) {
                return
              }
            }

            setStatusError(null)
            setStatusText('Syncing...')
            setIsSyncing(true)

            void onSync()
              .then(() => setStatusText('Synced'))
              .catch((error: unknown) => {
                setStatusText('Google sync')
                setStatusError(error instanceof Error ? error.message : 'Sync failed.')
              })
              .finally(() => setIsSyncing(false))
          }}
        >
          {isSyncing ? 'Syncing...' : 'Sync with Google'}
        </button>
      </div>
    </aside>
  )
}
