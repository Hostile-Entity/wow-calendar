import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version?: string }
const appVersion = packageJson.version ?? '0.3.3'
const repoName = 'wow-calendar'
const isGithubPagesBuild = process.env.NODE_ENV === 'production'

// https://vite.dev/config/
export default defineConfig({
  base: isGithubPagesBuild ? `/${repoName}/` : '/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
})
