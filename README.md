# PrivRec

A small web app for recording your screen or camera, encrypting the result, and
storing it on the [Sia](https://sia.tech) decentralized network. You get back a
share link that expires whenever you choose.

No accounts, no servers of ours, no analytics. Your videos are end-to-end
encrypted and only the people you send the link to can watch them.

## How it works

1. **Sign in with a recovery phrase.** A new user generates a 12-word BIP-39
   phrase; a returning user pastes theirs in. That phrase is the only key to
   your account — write it down somewhere safe, because we can't recover it.
2. **Record.** Capture your camera (with mic) or your screen, right in the
   browser. Pick which camera/mic to use before you start.
3. **Upload & share.** The recording is encrypted, uploaded to Sia, and you get
   a link. Choose how long it stays alive (1 hour up to "never").
4. **Watch.** Anyone with the link and a Sia account can stream and decrypt the
   video. The page streams it as it downloads so playback starts quickly.

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
```

You'll need a recent Node.js (18+).

**Log in with Sia Storage** — Open the Sia Storage page and log in to PrivRec.
You'll be signed in automatically once you're done.

## Where keys and data live

- Your **recovery phrase** never leaves your machine. It's used to derive an
  **App Key**, and only the App Key is stored.
- The App Key is **encrypted before it touches localStorage**. We generate a
  non-extractable AES-GCM key in IndexedDB (the browser won't let any script
  read its raw bytes) and store only the ciphertext. See
  [src/lib/keyStore.js](src/lib/keyStore.js).
- "Disconnect" wipes the stored key and you'll need your phrase again.

## Indexer

By default the app uses `https://sia.storage` as its indexer. You can point it
at your own — including a local one — from the onboarding screen. Run your own
with the open-source [indexd](https://github.com/SiaFoundation/indexd).

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
  hooks/
    useRecorder.js     camera/screen capture with MediaRecorder
  lib/
    sia.js             Sia SDK wrapper: connect, reconnect, upload, share
    keyStore.js        encrypted-at-rest storage for the App Key
  pages/
    Onboarding.jsx     generate/enter recovery phrase + approval flow
    Recorder.jsx       record screen or camera
    Upload.jsx         encrypt, upload, pick expiry, get a link
    Play.jsx           stream and decrypt a shared recording
```

## Acknowledgement

This work is supported by a [Sia Foundation](https://sia.tech/) grant.
