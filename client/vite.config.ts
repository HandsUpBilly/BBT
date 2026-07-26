import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: 
    ['5173--019dea7a-db9d-733d-b843-669e32bef1eb.eu-central-1-01.gitpod.dev',
     '5173--019f9dd4-3ed3-70ce-8a38-91fb33fb1ab8.eu-central-1-01.gitpod.dev',
     '5173--019f9e0a-a8a6-7604-9d00-0cb93d2b3df1.eu-central-1-01.gitpod.dev'
    ],
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
