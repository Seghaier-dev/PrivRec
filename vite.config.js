import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Add a Content-Security-Policy to the PRODUCTION build only.
//
// We can't put the CSP in index.html because that would also apply during
// `vite dev`, where Vite injects an inline React-refresh script that a strict
// script-src blocks. Scoping this to `apply: 'build'` keeps HMR happy in dev
// while still shipping a tight policy in prod.
//
// What the CSP does and doesn't buy us:
//   * Main win — script-src 'self' 'wasm-unsafe-eval' (no 'unsafe-inline', no
//     'unsafe-eval') kills the usual XSS vectors: inline <script>, inline event
//     handlers, javascript: URLs, eval(). Injected code just can't run.
//     ('wasm-unsafe-eval' only allows WASM compilation, which the Sia SDK needs.)
//   * The catch — connect-src can't be a tight allowlist. Sia is decentralized,
//     so downloads talk directly to all sorts of storage-host domains on random
//     ports (721grad-it.de:9984, sia.ptmt.me:9984, ...) that change all the time.
//     There's no single gateway to pin, so connect-src has to allow any HTTPS/WS.
//     That means the CSP alone can't stop a (hypothetical) exfil of the decrypted
//     App Key. That's just the cost of running a P2P storage client in the
//     browser — we lean on dependency hygiene + at-rest key encryption for the rest.
//
// A couple of directive notes:
//   worker-src/media-src blob: — the SDK spins up blob-URL workers, and playback
//     uses blob:/MediaSource object URLs.
//   style-src 'unsafe-inline' — needed for inline style attributes; style
//     injection is way less dangerous than script injection.
//   frame-ancestors is left out on purpose: <meta> CSP ignores it, so the host
//     has to send it as an HTTP header (see the README).
function cspPlugin() {
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    // Sia hosts are random P2P domains/ports, no way to list them all. Allow
    // any HTTPS + secure WebSocket/WebTransport so downloads work.
    "connect-src 'self' https: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return {
    name: 'privrec-html-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  // The Sia SDK is a WASM module that resolves its .wasm file relative to
  // import.meta.url. Leaving it out of Vite's dep pre-bundler keeps that path
  // working in `vite dev` — otherwise WebAssembly.instantiate fails with a
  // "magic word" error because the SPA fallback serves index.html for the .wasm.
  optimizeDeps: {
    exclude: ['@siafoundation/sia-storage'],
  },
})
