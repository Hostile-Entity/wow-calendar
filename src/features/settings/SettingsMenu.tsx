import { useState } from 'react'

interface SettingsMenuProps {
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  autoSync: boolean
  onAutoSyncChange: (enabled: boolean) => void
  debugMode: boolean
  onDebugModeChange: (enabled: boolean) => void
}

export function SettingsMenu({
  theme,
  onThemeChange,
  autoSync,
  onAutoSyncChange,
  debugMode,
  onDebugModeChange,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="settings-menu">
      <button
        type="button"
        className="settings-button"
        aria-label="Open settings"
        onClick={() => setOpen((state) => !state)}
      >
        Settings
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

            <p className="settings-version">Version {__APP_VERSION__}</p>
          </section>
        </div>
      )}
    </div>
  )
}
