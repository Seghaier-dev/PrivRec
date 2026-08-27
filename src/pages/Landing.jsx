import { Link } from 'react-router-dom'
import { hasStoredKey } from '../lib/sia'
import { Logo } from '../components/AppHeader'
import {
  IconLock,
  IconMonitor,
  IconCamera,
  IconPip,
  IconLink,
  IconUser,
  IconExternal,
  IconVideo,
  IconCheck,
} from '../components/icons'

const FEATURES = [
  {
    Icon: IconLock,
    title: 'Encrypted before upload',
    text: 'Every recording is encrypted in your browser before a single byte leaves your device. Nobody in the middle can watch it, including us.',
  },
  {
    Icon: IconVideo,
    title: 'Stored on the Sia network',
    text: 'Your videos live on decentralized Sia storage, split across independent hosts. There is no central server to breach or shut down.',
  },
  {
    Icon: IconMonitor,
    title: 'Screen, camera, or both',
    text: 'Record your screen, your camera, or picture-in-picture with your camera over your screen. Pick your device and microphone before you start.',
  },
  {
    Icon: IconLink,
    title: 'Share links that expire',
    text: 'Every share link can expire after an hour, a day, a week, or a month. Regenerate a fresh link for any old recording whenever you need one.',
  },
  {
    Icon: IconUser,
    title: 'No email, no signup forms',
    text: 'Your account is a 12-word recovery phrase, generated on your device. No email address, no password database, nothing to leak.',
  },
  {
    Icon: IconExternal,
    title: 'Open source and self-hostable',
    text: 'PrivRec is a static web app with no backend of its own. Host it on any static file server and point it at your own Sia indexer.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Record',
    text: 'Choose screen, camera, or picture-in-picture. A live preview and real-time timer show exactly what is being captured.',
  },
  {
    n: '2',
    title: 'Encrypt and upload',
    text: 'The recording is encrypted locally, then uploaded straight from your browser to the Sia storage network.',
  },
  {
    n: '3',
    title: 'Share the link',
    text: 'You get one link with the decryption key tucked in the URL fragment. Only people you send it to can watch.',
  },
]

const PRIVACY_POINTS = [
  'The decryption key travels in the URL fragment, which browsers never send to any server.',
  'Account keys are stored non-extractable in your browser. Scripts can use them but never read them.',
  'There is no PrivRec backend. The app talks directly to the Sia network from your browser.',
  'Recordings are erasure-coded across independent Sia hosts, not parked in one company\u2019s bucket.',
]

export default function Landing() {
  const connected = hasStoredKey()
  const appHref = connected ? '/record' : '/signin'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="PrivRec home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-500 md:flex">
            <a href="#features" className="transition-colors hover:text-gray-900">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-gray-900">How it works</a>
            <a href="#privacy" className="transition-colors hover:text-gray-900">Privacy</a>
          </nav>
          <div className="flex items-center gap-2">
            {!connected && (
              <Link
                to="/signin"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                Sign in
              </Link>
            )}
            <Link
              to={appHref}
              className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              {connected ? 'Open app' : 'Start recording'}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
            <IconLock size={12} className="text-gray-400" />
            End-to-end encrypted, stored on Sia
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Screen recording that
            <br className="hidden sm:block" /> stays private
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-500 sm:text-lg">
            Record your screen or camera, encrypt it in your browser, and share
            it with a single link. No email, no servers of ours, no one
            watching over your shoulder.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={appHref}
              className="group flex items-center gap-2.5 rounded-full bg-gray-900 py-3 pl-3.5 pr-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 transition-transform group-hover:scale-110">
                <span className="h-2 w-2 rounded-full bg-white" />
              </span>
              {connected ? 'Open the recorder' : 'Start recording free'}
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Free to use. Works in your browser. Nothing to install.
          </p>
        </div>

        {/* Product mock */}
        <div className="mx-auto mt-14 max-w-3xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm sm:p-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-950">
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-xs font-medium tabular-nums text-white">02:47</span>
              </div>
              <div className="absolute bottom-3 right-3 flex h-16 w-24 items-center justify-center rounded-lg border border-white/15 bg-gray-800 sm:h-20 sm:w-32">
                <IconCamera size={20} className="text-gray-500" />
              </div>
              <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-600">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                  <IconMonitor size={22} className="text-gray-400" />
                </span>
                <p className="text-sm text-gray-500">Your screen, camera, or both</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-gray-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything a recorder needs, nothing that spies
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500 sm:text-base">
              PrivRec was built for one thing: letting you record and share
              video without handing it to a company first.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl border border-gray-200 bg-gray-50 p-5 transition-colors hover:border-gray-300"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white">
                  <Icon size={16} />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-gray-200 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Three steps, one link
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500 sm:text-base">
              From hitting record to sharing a private video takes under a minute.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ n, title, text }) => (
              <div key={n} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-900">
                  {n}
                </span>
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <IconMonitor size={13} /> Screen
            </span>
            <span className="flex items-center gap-1.5">
              <IconCamera size={13} /> Camera
            </span>
            <span className="flex items-center gap-1.5">
              <IconPip size={13} /> Picture-in-picture
            </span>
            <span className="flex items-center gap-1.5">
              <IconLink size={13} /> Expiring links
            </span>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="border-t border-gray-200 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Private by design, not by promise
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-500 sm:text-base">
              Most recorders ask you to trust their privacy policy. PrivRec is
              built so there is nothing to trust: the architecture makes it
              impossible for anyone but your viewers to see a recording.
            </p>
            <Link
              to={appHref}
              className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              {connected ? 'Open the recorder' : 'Create your account'}
            </Link>
          </div>
          <ul className="space-y-3">
            {PRIVACY_POINTS.map(point => (
              <li
                key={point}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <IconCheck size={11} />
                </span>
                <span className="text-sm leading-relaxed text-gray-600">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <Link to="/" aria-label="PrivRec home">
            <Logo />
          </Link>
          <div className="flex items-center gap-5 text-xs text-gray-400">
            <a
              href="https://github.com/Seghaier-dev/PrivRec"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-gray-600"
            >
              GitHub
            </a>
            <a
              href="https://github.com/Seghaier-dev/PrivRec/blob/main/docs/self-hosting.md"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-gray-600"
            >
              Self-hosting guide
            </a>
            <a
              href="https://sia.tech"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-gray-600"
            >
              Built on Sia
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
