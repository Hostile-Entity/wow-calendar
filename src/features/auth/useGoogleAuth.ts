import { useCallback, useEffect, useRef, useState } from 'react'

const GOOGLE_SCRIPT_ID = 'google-identity-services'
const GOOGLE_TOKEN_KEY = 'wow-calendar-google-token'
const GOOGLE_PROFILE_KEY = 'wow-calendar-google-profile'
const GOOGLE_LINKED_KEY = 'wow-calendar-google-linked'
const GOOGLE_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
].join(' ')

interface StoredToken {
  accessToken: string
  expiresAt: number
}

interface GoogleProfile {
  name?: string
  email?: string
  picture?: string
}

function readStoredToken(): StoredToken | null {
  const raw = localStorage.getItem(GOOGLE_TOKEN_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as StoredToken
    if (!parsed.accessToken || typeof parsed.expiresAt !== 'number') {
      localStorage.removeItem(GOOGLE_TOKEN_KEY)
      return null
    }
    if (Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(GOOGLE_TOKEN_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(GOOGLE_TOKEN_KEY)
    return null
  }
}

function storeToken(accessToken: string, expiresIn: number): void {
  const expiresAt = Date.now() + Math.max(0, expiresIn - 30) * 1000
  localStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify({ accessToken, expiresAt }))
}

function clearStoredToken(): void {
  localStorage.removeItem(GOOGLE_TOKEN_KEY)
}

function readStoredProfile(): GoogleProfile | null {
  const raw = localStorage.getItem(GOOGLE_PROFILE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as GoogleProfile
  } catch {
    localStorage.removeItem(GOOGLE_PROFILE_KEY)
    return null
  }
}

function storeProfile(profile: GoogleProfile): void {
  localStorage.setItem(GOOGLE_PROFILE_KEY, JSON.stringify(profile))
}

function clearStoredProfile(): void {
  localStorage.removeItem(GOOGLE_PROFILE_KEY)
}

function readLinkedFlag(): boolean {
  return localStorage.getItem(GOOGLE_LINKED_KEY) === '1'
}

function storeLinkedFlag(): void {
  localStorage.setItem(GOOGLE_LINKED_KEY, '1')
}

function clearLinkedFlag(): void {
  localStorage.removeItem(GOOGLE_LINKED_KEY)
}

async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile | null> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    return null
  }

  const profile = (await response.json()) as GoogleProfile
  return profile
}

export function useGoogleAuth() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''
  const initialStoredToken = readStoredToken()
  const [scriptLoaded, setScriptLoaded] = useState(() => Boolean(window.google?.accounts?.oauth2))
  const [error, setError] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(() => initialStoredToken?.accessToken ?? null)
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(() => initialStoredToken?.expiresAt ?? null)
  const [profile, setProfile] = useState<GoogleProfile | null>(() => readStoredProfile())
  const [isLinked, setIsLinked] = useState(
    () => Boolean(initialStoredToken?.accessToken) || Boolean(readStoredProfile()) || readLinkedFlag(),
  )

  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null)

  useEffect(() => {
    if (window.google?.accounts?.oauth2) {
      return
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null
    const script = existing ?? document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true

    const onLoad = () => setScriptLoaded(true)
    const onError = () => setError('Google auth script failed to load.')

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })

    if (!existing) {
      document.head.appendChild(script)
    }

    return () => {
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }
  }, [])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    void fetchGoogleProfile(accessToken).then((nextProfile) => {
      if (!nextProfile) {
        return
      }
      setProfile(nextProfile)
      storeProfile(nextProfile)
    })
  }, [accessToken])

  const getTokenClient = useCallback(() => {
    if (!scriptLoaded || !window.google?.accounts?.oauth2) {
      throw new Error('Google auth is not ready yet.')
    }

    if (!clientId) {
      throw new Error('Missing VITE_GOOGLE_CLIENT_ID.')
    }

    if (tokenClientRef.current) {
      return tokenClientRef.current
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: () => {},
    })

    tokenClientRef.current = tokenClient
    return tokenClient
  }, [clientId, scriptLoaded])

  const requestToken = useCallback(
    async (prompt: '' | 'select_account'): Promise<string> => {
      const tokenClient = getTokenClient()

      try {
        const token = await new Promise<google.accounts.oauth2.TokenResponse>((resolve, reject) => {
          tokenClient.callback = (response) => {
            if (response.error) {
              reject(new Error(response.error))
              return
            }
            resolve(response)
          }

          tokenClient.requestAccessToken({ prompt })
        })

        if (!token.access_token) {
          throw new Error('Google did not return an access token.')
        }

        const expiresInSeconds = Number(token.expires_in ?? 3600)
        const nextExpiresAt = Date.now() + Math.max(0, expiresInSeconds - 30) * 1000
        const nextToken = token.access_token
        storeToken(nextToken, expiresInSeconds)
        storeLinkedFlag()
        setAccessToken(nextToken)
        setTokenExpiresAt(nextExpiresAt)
        setIsLinked(true)
        setError(null)
        return nextToken
      } catch (requestError) {
        if (requestError instanceof Error && requestError.message === 'interaction_required') {
          setError(null)
        } else if (requestError instanceof Error) {
          setError(requestError.message)
        } else {
          setError('Google authentication failed.')
        }
        throw requestError
      }
    },
    [getTokenClient],
  )

  const authenticate = useCallback(async () => {
    if (!scriptLoaded) {
      throw new Error('Google auth script is still loading. Please retry in a moment.')
    }

    const token = await requestToken('select_account')
    const nextProfile = await fetchGoogleProfile(token)
    if (nextProfile) {
      setProfile(nextProfile)
      storeProfile(nextProfile)
    }
    return token
  }, [requestToken, scriptLoaded])

  const ensureAccessToken = useCallback(async () => {
    const stored = readStoredToken()
    if (stored) {
      setAccessToken(stored.accessToken)
      setTokenExpiresAt(stored.expiresAt)
      setIsLinked(true)
      return stored.accessToken
    }

    setAccessToken(null)
    setTokenExpiresAt(null)
    return requestToken('')
  }, [requestToken])

  useEffect(() => {
    if (!isLinked) {
      return
    }

    void ensureAccessToken().catch(() => {
      return
    })
  }, [ensureAccessToken, isLinked])

  useEffect(() => {
    if (!isLinked || !tokenExpiresAt) {
      return
    }

    const renewInMs = Math.max(5000, tokenExpiresAt - Date.now() - 120000)
    const timeoutId = window.setTimeout(() => {
      void requestToken('').catch(() => {
        return
      })
    }, renewInMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isLinked, requestToken, tokenExpiresAt])

  const disconnect = useCallback(() => {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken)
    }
    clearStoredToken()
    clearStoredProfile()
    clearLinkedFlag()
    setAccessToken(null)
    setTokenExpiresAt(null)
    setProfile(null)
    setIsLinked(false)
  }, [accessToken])

  const clearLocalAuthData = useCallback(() => {
    clearStoredToken()
    clearStoredProfile()
    clearLinkedFlag()
    setAccessToken(null)
    setTokenExpiresAt(null)
    setProfile(null)
    setIsLinked(false)
    setError(null)
  }, [])

  return {
    isReady: scriptLoaded,
    error,
    isConnected: isLinked,
    profile,
    authenticate,
    ensureAccessToken,
    disconnect,
    clearLocalAuthData,
  }
}
