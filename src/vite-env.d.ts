/// <reference types="vite/client" />
/* eslint-disable @typescript-eslint/no-unused-vars */

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  const __APP_VERSION__: string

  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: google.accounts.oauth2.TokenClientConfig) => google.accounts.oauth2.TokenClient
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }

  namespace google.accounts.oauth2 {
    interface TokenResponse {
      access_token?: string
      expires_in?: string | number
      error?: string
    }

    interface TokenClientConfig {
      client_id: string
      scope: string
      callback: (response: TokenResponse) => void
    }

    interface RequestAccessTokenOverrideConfig {
      prompt?: '' | 'consent' | 'select_account'
    }

    interface TokenClient {
      callback: (response: TokenResponse) => void
      requestAccessToken: (overrideConfig?: RequestAccessTokenOverrideConfig) => void
    }
  }
}

export {}
