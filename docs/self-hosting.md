# Self-hosting PrivRec

PrivRec is a fully static single-page app. There is no backend, no database,
and no server-side code: everything — recording, encryption, upload, playback —
runs in the visitor's browser, talking directly to the Sia network. Hosting it
yourself means serving a folder of static files, nothing more.

## Prerequisites

- **Node.js 18+** and npm (only for building — the server you deploy to
  doesn't need Node at all)
- Any static file host: nginx, Caddy, Apache, Netlify, Cloudflare Pages,
  GitHub Pages, an S3 bucket behind a CDN, ...
- **HTTPS on the host.** The browser APIs PrivRec depends on
  (`getUserMedia`, `getDisplayMedia`, `crypto.subtle`, clipboard) only work in
  a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).
  `http://localhost` counts as secure, so local testing works without a cert.

## Build

```bash
git clone https://github.com/Seghaier-dev/PrivRec.git
cd PrivRec
npm install
npm run build
```

The production build lands in `dist/`. That folder is the entire deployment —
copy it to your host.

To sanity-check the build locally before deploying:

```bash
npm run preview   # serves dist/ at http://localhost:4173
```

## Server configuration

Two things matter beyond "serve the files":

### 1. SPA fallback

PrivRec uses client-side routing (`/record`, `/play`, `/history`, ...). The
server must serve `index.html` for any path that doesn't match a real file,
otherwise a refresh on `/play` returns a 404 — and share links land on `/play`.

- **nginx**

  ```nginx
  server {
      listen 443 ssl;
      server_name privrec.example.com;
      root /var/www/privrec/dist;

      location / {
          try_files $uri $uri/ /index.html;
      }

      # Security headers (see below)
      add_header Content-Security-Policy "frame-ancestors 'none'" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-Frame-Options "DENY" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  }
  ```

- **Caddy**

  ```caddy
  privrec.example.com {
      root * /var/www/privrec/dist
      try_files {path} /index.html
      file_server
      header {
          Content-Security-Policy "frame-ancestors 'none'"
          X-Content-Type-Options "nosniff"
          X-Frame-Options "DENY"
          Referrer-Policy "strict-origin-when-cross-origin"
      }
  }
  ```

- **Netlify / Cloudflare Pages** — the repo already ships a
  [public/_headers](../public/_headers) file that both platforms pick up
  automatically. For the SPA fallback on Netlify, add a `public/_redirects`
  file containing:

  ```
  /*  /index.html  200
  ```

  Cloudflare Pages serves the SPA fallback automatically for single-page apps.

### 2. Security headers

The production build injects a strict Content-Security-Policy into
`index.html` at build time (see [vite.config.js](../vite.config.js)): no
inline scripts, no `eval`, WASM compilation only for the Sia SDK. One
directive can't live in a `<meta>` tag, so set it as an HTTP header at your
host:

```
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
```

`frame-ancestors 'none'` prevents another site from framing your deployment
and clickjacking users into recording or sharing. The nginx/Caddy examples
above and the bundled `_headers` file already include it.

Note the CSP allows `connect-src https: wss:` rather than an allowlist — Sia
is a decentralized network, so the app talks directly to storage hosts on
ever-changing domains and ports. That's inherent to a P2P client in the
browser and can't be pinned down further.

### MIME types

The Sia SDK ships a `.wasm` module. Every mainstream server already maps
`.wasm` to `application/wasm`, but if you're on an exotic setup and WASM
fails to load with a "magic word" error, check that header first.

## Choosing an indexer

By default the app connects to the public `https://sia.storage` indexer. Users
can change it in two places:

- on the **onboarding screen** (before connecting), or
- in **Settings** (after connecting — note that switching disconnects the
  device, since App Keys are tied to the indexer that issued them).

To run your own indexer, deploy the open-source
[indexd](https://github.com/SiaFoundation/indexd) and point PrivRec at its
URL. The indexer URL must be HTTPS (plain HTTP is accepted for `localhost`
only, for development against a local indexd).

## Privacy properties of a self-hosted deployment

Whoever hosts PrivRec serves only the app's static assets. The host never
sees:

- recordings or any video data (uploads go browser → Sia hosts directly),
- encryption keys (they travel in URL *fragments*, which browsers do not send
  to servers),
- recovery phrases or App Keys (never transmitted; the App Key is stored
  encrypted in the visitor's browser).

The only parties a user's browser talks to are your static host (for the app
itself), the configured indexer, and Sia storage hosts.

## Updating

```bash
git pull
npm install
npm run build
```

and re-upload `dist/`. There is no migration to run — all user state lives in
their own browsers and on the Sia network.
