import { useState } from 'react'

interface Profile {
  name?: string
  email?: string
  picture?: string
}

interface AccountMenuProps {
  isReady: boolean
  isConnected: boolean
  profile: Profile | null
  authError: string | null
  onAuthenticate: () => Promise<unknown>
  onDisconnect: () => void
}

function profileInitial(profile: Profile | null): string {
  const label = profile?.name?.trim() || profile?.email?.trim() || 'G'
  return label.charAt(0).toUpperCase()
}

export function AccountMenu({
  isReady,
  isConnected,
  profile,
  authError,
  onAuthenticate,
  onDisconnect,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  return (
    <div className="account-menu">
      <button
        type="button"
        className="account-avatar"
        aria-label="Open Google account menu"
        onClick={() => {
          setLocalError(null)
          setOpen((state) => !state)
        }}
      >
        {profile?.picture ? <img src={profile.picture} alt="Google profile" /> : <span>{profileInitial(profile)}</span>}
      </button>

      {open && (
        <div className="account-overlay" role="presentation" onClick={() => setOpen(false)}>
          <section
            className="account-popover"
            aria-label="Google account authentication"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="account-title">Google account</p>
            {isConnected ? (
              <small className="account-status">{profile?.email ?? profile?.name ?? 'Connected'}</small>
            ) : (
              <small className="account-status">Authenticate with your Google account.</small>
            )}

            {(localError || authError) && <small className="sync-error">{localError ?? authError}</small>}

            <div className="account-actions">
              {isConnected && (
                <button
                  type="button"
                  onClick={() => {
                    onDisconnect()
                    setOpen(false)
                  }}
                >
                  Sign out
                </button>
              )}
              <button
                type="button"
                className="primary"
                disabled={!isReady || isAuthenticating}
                onClick={() => {
                  setLocalError(null)
                  setIsAuthenticating(true)
                  void onAuthenticate()
                    .then(() => setOpen(false))
                    .catch((error: unknown) => {
                      setLocalError(error instanceof Error ? error.message : 'Authentication failed.')
                    })
                    .finally(() => setIsAuthenticating(false))
                }}
              >
                {isAuthenticating ? 'Authorizing...' : isConnected ? 'Switch account' : 'Auth'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
