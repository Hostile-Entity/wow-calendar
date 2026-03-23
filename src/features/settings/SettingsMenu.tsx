import { useState } from 'react'
import gearIcon from '../../assets/icons/gear.svg'

interface SettingsMenuProps {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  autoSync: boolean
  onAutoSyncChange: (enabled: boolean) => void
  debugMode: boolean
  onDebugModeChange: (enabled: boolean) => void
  onClearLocalData: () => Promise<void>
}

export function SettingsMenu({
  theme,
  onThemeChange,
  autoSync,
  onAutoSyncChange,
  debugMode,
  onDebugModeChange,
  onClearLocalData,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  return (
    <div className="settings-menu">
      <button
        type="button"
        className="settings-button"
        aria-label="Open settings"
        onClick={() => setOpen((state) => !state)}
      >
        <img src={gearIcon} alt="" aria-hidden="true" />
      </button>

      {open && (
        <div className="settings-overlay" role="presentation" onClick={() => setOpen(false)}>
          <section
            className="settings-popover"
            aria-label="Settings panel"
            onClick={(event) => event.stopPropagation()}
          >
            <label className="settings-row">
              <span>Theme</span>
              <select
                value={theme}
                onChange={(event) => onThemeChange(event.target.value as 'light' | 'dark')}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <label className="settings-row">
              <span>Auto sync</span>
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(event) => onAutoSyncChange(event.target.checked)}
              />
            </label>
            <label className="settings-row">
              <span>Debug mode</span>
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(event) => onDebugModeChange(event.target.checked)}
              />
            </label>

            <button
              type="button"
              className="danger settings-clear-button"
              disabled={isClearing}
              onClick={() => {
                const confirmed = window.confirm(
                  'Clear all local data? This removes local events, settings, and stored account session from this browser only.',
                )
                if (!confirmed) {
                  return
                }

                setIsClearing(true)
                void onClearLocalData().finally(() => setIsClearing(false))
              }}
            >
              {isClearing ? 'Clearing...' : 'Clear all local data'}
            </button>

            <p className="settings-version">Version {__APP_VERSION__}</p>
          </section>
        </div>
      )}
    </div>
  )
}
