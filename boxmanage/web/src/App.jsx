import { Routes, Route, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { setNavigator } from './navigate';
import { BrandMark, Home, Scan, Boxes, Plus, Printer, Pin, Download, Users, Settings as SettingsIcon, LogOut, Sun, Moon, Menu, X } from './components/Icons';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BoxesPage = lazy(() => import('./pages/Boxes'));
const BoxDetail = lazy(() => import('./pages/BoxDetail'));
const BoxForm = lazy(() => import('./pages/BoxForm'));
const ScanPage = lazy(() => import('./pages/Scan'));
const PrintLabels = lazy(() => import('./pages/PrintLabels'));
const PrintBle = lazy(() => import('./pages/PrintBle'));
const Locations = lazy(() => import('./pages/Locations'));
const UsersPage = lazy(() => import('./pages/Users'));
const Export = lazy(() => import('./pages/Export'));
const Settings = lazy(() => import('./pages/Settings'));

function PageLoader() {
  return <div className="center-page">Načítám…</div>;
}

const NAV = [
  { to: '/', label: 'Přehled', icon: Home },
  { to: '/scan', label: 'Sken', icon: Scan },
  { to: '/boxes', label: 'Krabice', icon: Boxes },
  { to: '/boxes/new', label: 'Nová krabice', icon: Plus },
  { to: '/print', label: 'Tisk štítků', icon: Printer },
  { to: '/locations', label: 'Lokace', icon: Pin },
  { to: '/export', label: 'Export', icon: Download },
];

const MOBILE_NAV = [
  { to: '/', label: 'Přehled', icon: Home },
  { to: '/scan', label: 'Sken', icon: Scan },
  { to: '/boxes', label: 'Krabice', icon: Boxes },
  { to: '/print', label: 'Tisk', icon: Printer },
];

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('boxmanage_theme', next);
    setTheme(next);
  }
  return [theme, toggle];
}

function ThemeToggle({ theme, toggle }) {
  return (
    <button className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'} title={theme === 'dark' ? 'Světlý režim' : 'Tmavý režim'}>
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

function NavList({ links, onNavigate }) {
  return links.map((l) => (
    <NavLink
      key={l.to}
      to={l.to}
      className={({ isActive }) => (isActive ? 'menu-item active' : 'menu-item')}
      onClick={onNavigate}
    >
      <span className="mi-icon"><l.icon size={20} /></span>
      <span>{l.label}</span>
    </NavLink>
  ));
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [theme, toggle] = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setNavigator(navigate), [navigate]);

  const links = [...NAV];
  if (user?.role === 'admin') {
    links.push({ to: '/users', label: 'Uživatelé', icon: Users });
  }
  links.push({ to: '/settings', label: 'Nastavení', icon: SettingsIcon });

  const showFab =
    !location.pathname.startsWith('/scan') &&
    !location.pathname.startsWith('/print') &&
    !location.pathname.startsWith('/boxes/');

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Menu">
          <Menu size={22} />
        </button>
        <h1 className="brand" onClick={() => navigate('/')}>
          <BrandMark size={32} />
          <span>BoxManage</span>
        </h1>
        <div className="topbar-spacer" />
        <ThemeToggle theme={theme} toggle={toggle} />
      </header>

      <aside className="sidebar">
        <div className="brand">
          <BrandMark size={34} />
          <span>BoxManage</span>
        </div>
        <nav className="side-nav">
          <NavList links={links} />
        </nav>
        <div className="side-foot">
          <div className="side-avatar">{(user?.username || '?').slice(0, 1).toUpperCase()}</div>
          <div className="side-user">
            <div className="name">{user?.username}</div>
            <div className="role">{user?.role === 'admin' ? 'Admin' : 'Uživatel'}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
            <ThemeToggle theme={theme} toggle={toggle} />
            <button className="icon-btn" onClick={logout} aria-label="Odhlásit" title="Odhlásit">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer">
            <div className="drawer-head">
              <div className="brand">
                <BrandMark size={30} />
                <span>BoxManage</span>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(false)} aria-label="Zavřít">
                <X size={20} />
              </button>
            </div>
            <nav className="drawer-nav">
              <NavList links={links} onNavigate={() => setDrawer(false)} />
            </nav>
            <div className="drawer-footer">
              <div className="side-avatar">{(user?.username || '?').slice(0, 1).toUpperCase()}</div>
              <div className="side-user">
                <div className="name">{user?.username}</div>
                <div className="role">{user?.role === 'admin' ? 'Admin' : 'Uživatel'}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <button className="icon-btn" onClick={logout} aria-label="Odhlásit" title="Odhlásit">
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <main className="content">{children}</main>

      <nav className="bottom-nav">
        {MOBILE_NAV.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'bn-item active' : 'bn-item')}>
            <span className="bn-icon"><l.icon size={22} /></span>
            <span className="bn-label">{l.label}</span>
          </NavLink>
        ))}
        <button className="bn-item" onClick={() => setDrawer(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span className="bn-icon"><Menu size={22} /></span>
          <span className="bn-label">Menu</span>
        </button>
      </nav>

      {showFab && (
        <NavLink to="/boxes/new" className="fab" aria-label="Nová krabice">
          <Plus size={26} />
        </NavLink>
      )}
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-page">Načítám…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Layout><Dashboard /></Layout></Protected>} />
        <Route path="/boxes" element={<Protected><Layout><BoxesPage /></Layout></Protected>} />
        <Route path="/boxes/new" element={<Protected><Layout><BoxForm /></Layout></Protected>} />
        <Route path="/boxes/:id" element={<Protected><Layout><BoxDetail /></Layout></Protected>} />
        <Route path="/boxes/:id/edit" element={<Protected><Layout><BoxForm /></Layout></Protected>} />
        <Route path="/scan" element={<Protected><Layout><ScanPage /></Layout></Protected>} />
        <Route path="/print" element={<Protected><Layout><PrintLabels /></Layout></Protected>} />
        <Route path="/print-ble/:id" element={<Protected><Layout><PrintBle /></Layout></Protected>} />
        <Route path="/locations" element={<Protected><Layout><Locations /></Layout></Protected>} />
        <Route path="/export" element={<Protected><Layout><Export /></Layout></Protected>} />
        <Route path="/settings" element={<Protected><Layout><Settings /></Layout></Protected>} />
        <Route path="/users" element={<Protected><AdminOnly><Layout><UsersPage /></Layout></AdminOnly></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
