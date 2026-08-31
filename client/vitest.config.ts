import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Mirrors vite.config.ts: releaseNotes.ts globs docs/release-notes/*.md
  // from outside the client root, same as shared/ already is.
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
