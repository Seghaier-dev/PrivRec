import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { hardReset } from '../lib/sia'
import { IconUser } from './icons'

// Wordmark + record-dot glyph. Pure markup, no image asset to load.
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-900">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-gray-900">PrivRec</span>
    </span>
  )
}

function NavLink({ to, children }) {
  const { pathname } = useLocation()
  const active = pathname === to
  return (
    <Link
      to={to}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </Link>
  )
}

// Shared chrome for every signed-in page: logo, primary nav, account menu.
// `children` slots extra page-specific content (e.g. the recording indicator)
// between the nav and the account menu.
export default function AppHeader({ children }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    hardReset()
    window.location.href = '/'
  }

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link to="/record" aria-label="PrivRec home">
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          {children}
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/record">Record</NavLink>
            <NavLink to="/history">Library</NavLink>
          </nav>

          <div className="relative ml-1" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Account menu"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              <IconUser size={15} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-950/5">
                <div className="sm:hidden">
                  <MenuItem onClick={() => navigate('/record')}>Record</MenuItem>
                  <MenuItem onClick={() => navigate('/history')}>Library</MenuItem>
                  <div className="my-1 border-t border-gray-100" />
                </div>
                <MenuItem onClick={() => navigate('/account')}>Account</MenuItem>
                <MenuItem onClick={() => navigate('/settings')}>Settings</MenuItem>
                <div className="my-1 border-t border-gray-100" />
                <MenuItem danger onClick={handleLogout}>Disconnect</MenuItem>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuItem({ children, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
        danger ? 'text-red-600' : 'text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}
