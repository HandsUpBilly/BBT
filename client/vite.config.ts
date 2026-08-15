import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { version } from '../package.json'

const deployedAt = process.env.VITE_DEPLOYED_AT ?? new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Netlify exposes the deploy's git SHA as COMMIT_REF; falling back to the
    // root package version keeps local builds readable. Surfaced in About and
    // attached to issue reports, so it needs to change per deploy.
    __BBT_VERSION__: JSON.stringify(
      process.env.VITE_APP_VERSION
        ?? (process.env.COMMIT_REF ? `${version}+${process.env.COMMIT_REF.slice(0, 7)}` : version),
    ),
    // Netlify does not expose the deployment time as a build variable. Capture
    // the instant this bundle is produced; allow controlled/reproducible builds
    // to supply the same ISO timestamp explicitly.
    __BBT_DEPLOYED_AT__: JSON.stringify(deployedAt),
  },
  server: {
    // Gitpod workspace URLs are ephemeral, so match the domain rather than
    // accumulating one hard-coded hostname per workspace.
    allowedHosts: ['.gitpod.dev'],
    fs: {
      // The client imports shared/ (validation + report formatting) from the
      // repo root so it cannot drift from the server's copy.
      allow: ['..'],
    },
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
