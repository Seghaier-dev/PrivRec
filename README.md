# PrivRec

A small web app for recording your screen or camera, encrypting the result, and
storing it on the [Sia](https://sia.tech) decentralized network. You get back a
share link that expires whenever you choose.

No accounts of ours, no servers of ours, no analytics. Your videos are
end-to-end encrypted and only people you send the link to can watch them.

## How it works

1. **Sign in.** A new user generates a 12-word BIP-39 phrase (a returning user
   pastes theirs in), then approves PrivRec once on the Sia Storage page. The
   phrase is the only key to your account — write it down somewhere safe,
   because we can't recover it.
2. **Record.** Capture your camera (with mic), your screen, or both together
   (screen with a camera bubble in the corner), right in the browser. Pick
   which camera/mic to use with a live preview before you start.
3. **Upload & share.** The recording is encrypted, uploaded to Sia, and you get
   a link. Choose how long it stays alive (1 hour up to "never").
4. **Watch.** Anyone with the link and a Sia account can stream and decrypt the
   video. The page streams it as it downloads so playback starts quickly.
5. **Manage.** The "My recordings" dashboard lists everything you've uploaded
   with account storage stats. From there you can mint a fresh share link for
   any recording (with its own expiry) or delete recordings you no longer need.

## Tech

- **React 19** + **React Router 7**
- **Vite** for dev/build, **Tailwind CSS v4** for styling
- **[@siafoundation/sia-storage](https://www.npmjs.com/package/@siafoundation/sia-storage)**
  — a WASM client that talks to the Sia network directly from the browser

## Running locally

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build
npm run lint     # eslint
npm test         # run the unit tests
```

You'll need a recent Node.js (18+).

## Where keys and data live

- Your **recovery phrase** never leaves your machine. It's used to derive an
  **App Key**, and only the App Key is stored.
- The App Key is **encrypted before it touches localStorage**. We generate a
  non-extractable AES-GCM key in IndexedDB (the browser won't let any script
  read its raw bytes) and store only the ciphertext. See
  [src/lib/keyStore.js](src/lib/keyStore.js).
- The first time you connect on a device, you approve PrivRec once on the
  Sia Storage page. That approval is tied to your account, so reconnecting
  later on the same device is silent.
- "Disconnect" wipes the stored key and you'll need your phrase again.

## Indexer

By default the app uses `https://sia.storage` as its indexer. You can point it
at your own — including a local one — from the onboarding screen, or later
from the **Settings** page (switching indexers disconnects the device, since
App Keys are tied to the indexer that issued them). Run your own with the
open-source [indexd](https://github.com/SiaFoundation/indexd).

## Self-hosting

PrivRec is a fully static app — no backend to run. Build it and drop `dist/`
on any static file host. See the [self-hosting guide](docs/self-hosting.md)
for build steps, SPA fallback and security-header configuration (nginx, Caddy,
Netlify, Cloudflare Pages), and the privacy properties of a self-hosted
deployment.

## Security notes

This app handles a private key in the browser, so a few things are worth knowing
if you deploy it:

- **Content-Security-Policy.** The production build injects a strict CSP that
  blocks inline scripts, `eval`, and `javascript:`/`data:` URLs (see
  [vite.config.js](vite.config.js)). It only allows the WASM compilation the Sia
  SDK needs.
- **`connect-src` can't be locked down.** Sia is decentralized, so downloads
  connect to constantly-changing storage hosts on arbitrary ports. The CSP has
  to allow any HTTPS/WSS connection — that's inherent to a P2P client in the
  browser. The at-rest key encryption above is the backstop.
- **Set `frame-ancestors` yourself.** A `<meta>` CSP can't set it, so configure
  it as an HTTP header at your host to prevent clickjacking, e.g.:

  ```
  Content-Security-Policy: frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  ```

## Project layout

```
src/
  App.jsx              routing + WASM init / auth gate
  main.jsx             app entry point
  hooks/
    useRecorder.js     camera/screen/PiP capture with MediaRecorder
  lib/
    sia.js             Sia SDK wrapper: connect, reconnect, upload, share
    recordings.js      recording history: event-log replay, metadata, sizes
    keyStore.js        encrypted-at-rest storage for the App Key
    shareLink.js       build and parse share-link URLs
    redirect.js        open-redirect / URL scheme validation
    indexer.js         indexer URL validation (HTTPS-only, localhost exception)
  pages/
    Onboarding.jsx     generate/enter recovery phrase + approval flow
    Recorder.jsx       record screen, camera, or both (picture-in-picture)
    Upload.jsx         encrypt, upload, pick expiry, share result page
    Play.jsx           stream and decrypt a shared recording
    History.jsx        recording dashboard: share links, deletion, account stats
    Account.jsx        account page: storage usage, quota, key and app details
    Settings.jsx       indexer configuration
```

Each `lib/` module (`sia`, `keyStore`, `shareLink`, `redirect`, `indexer`) has
a matching `.test.js` file with unit tests.

## Acknowledgement

This work is supported by a [Sia Foundation](https://sia.tech/) grant.