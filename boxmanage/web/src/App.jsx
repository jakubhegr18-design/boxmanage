import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { lazy, Suspense, useState } from 'react';
import { useAuth } from './auth';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Boxes = lazy(() => import('./pages/Boxes'));
const BoxDetail = lazy(() => import('./pages/BoxDetail'));
const BoxForm = lazy(() => import('./pages/BoxForm'));
const Scan = lazy(() => import('./pages/Scan'));
const PrintLabels = lazy(() => import('./pages/PrintLabels'));
const Locations = lazy(() => import('./pages/Locations'));
const Users = lazy(() => import('./pages/Users'));
const Export = lazy(() => import('./pages/Export'));
const Settings = lazy(() => import('./pages/Settings'));

function PageLoader() {
  return <div className="center-page">Načítám…</div>;
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/', label: 'Přehled', icon: '🏠' },
    { to: '/scan', label: 'Sken', icon: '📷' },
    { to: '/boxes', label: 'Krabice', icon: '📦' },
    { to: '/boxes/new', label: 'Nová', icon: '➕' },
    { to: '/print', label: 'Tisk', icon: '🖨️' },
    { to: '/locations', label: 'Lokace', icon: '📍' },
    { to: '/export', label: 'Export', icon: '📤' },
  ];
  if (user?.role === 'admin') {
    links.push({ to: '/users', label: 'Uživatelé', icon: '👥' });
  }
  links.push({ to: '/settings', label: 'Nastavení', icon: '⚙️' });

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">☰</button>
        <h1 className="brand" onClick={() => (window.location.href = '/')}>📦 BoxManage</h1>
        <span className="topbar-user">{user?.username} · <button className="link" onClick={logout}>odhlásit</button></span>
      </header>

      {menuOpen && (
        <nav className="menu">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'menu-item active' : 'menu-item')} onClick={() => setMenuOpen(false)}>
              <span>{l.icon}</span> {l.label}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="content">{children}</main>

      <nav className="bottom-nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'bn-item active' : 'bn-item')}>
            <span className="bn-icon">{l.icon}</span>
            <span className="bn-label">{l.label}</span>
          </NavLink>
        ))}
      </nav>
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
      <Route path="/boxes" element={<Protected><Layout><Boxes /></Layout></Protected>} />
      <Route path="/boxes/new" element={<Protected><Layout><BoxForm /></Layout></Protected>} />
      <Route path="/boxes/:id" element={<Protected><Layout><BoxDetail /></Layout></Protected>} />
      <Route path="/boxes/:id/edit" element={<Protected><Layout><BoxForm /></Layout></Protected>} />
      <Route path="/scan" element={<Protected><Layout><Scan /></Layout></Protected>} />
      <Route path="/print" element={<Protected><Layout><PrintLabels /></Layout></Protected>} />
      <Route path="/locations" element={<Protected><Layout><Locations /></Layout></Protected>} />
      <Route path="/export" element={<Protected><Layout><Export /></Layout></Protected>} />
      <Route path="/settings" element={<Protected><Layout><Settings /></Layout></Protected>} />
      <Route path="/users" element={<Protected><AdminOnly><Layout><Users /></Layout></AdminOnly></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
