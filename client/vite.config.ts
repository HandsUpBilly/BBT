import { defineConfig, normalizePath, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { version } from '../package.json'
import { deploymentVersion } from './src/deploymentVersion'

const deployedAt = process.env.VITE_DEPLOYED_AT ?? new Date().toISOString()

const statefulRulesModules = [
  '/src/bfs.ts',
  '/src/blockBranching.ts',
  '/src/blockBranchTree.ts',
  '/src/branchReplay.ts',
  '/src/branchRun.ts',
  '/src/useBranchRun.ts',
  '/src/useGameState.ts',
]

/**
 * React Fast Refresh deliberately preserves hook state. That is unsafe for the
 * rules engine: an existing BranchRun can otherwise keep action-log entries
 * calculated by the previous code, so the pitch can show a stale roll after a
 * rules edit. A full reload starts a fresh puzzle with one coherent ruleset.
 */
const reloadOnRulesUpdate = (): Plugin => ({
  name: 'reload-on-rules-update',
  handleHotUpdate({ file, server }) {
    const normalizedFile = normalizePath(file)
    if (!statefulRulesModules.some(modulePath => normalizedFile.endsWith(modulePath))) return
    server.ws.send({ type: 'full-reload' })
    return []
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), reloadOnRulesUpdate()],
  define: {
    __BBT_VERSION__: JSON.stringify(
      deploymentVersion(version, process.env.VITE_APP_VERSION),
    ),
    // Netlify does not expose the deployment time as a build variable. Capture
    // the instant this bundle is produced; allow controlled/reproducible builds
    // to supply the same ISO timestamp explicitly.
    __BBT_DEPLOYED_AT__: JSON.stringify(deployedAt),
    // Netlify sets CONTEXT to exactly 'production' for the configured
    // production-branch deploy, and to 'deploy-preview' / 'branch-deploy' /
    // 'dev' for everything else (staging, PR previews, `netlify dev`); it is
    // unset for a plain local build. Only the real production deploy should
    // ever gate Admin nav on a confirmed server-side check — everywhere else
    // (staging included) shows it unconditionally as a convenience. This is
    // client-side nav visibility only; `/api/editor/*` authorization is
    // unchanged and still enforced on every environment, staging included.
    __BBT_FORCE_ADMIN_NAV__: JSON.stringify(process.env.CONTEXT !== 'production'),
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
