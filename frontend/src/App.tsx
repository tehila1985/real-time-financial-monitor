import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { AddTransactionPage } from './pages/AddTransactionPage'
import { MonitorPage } from './pages/MonitorPage'

function App() {
  return (
    <div className="app-shell">
      <header className="app-nav">
        <span className="app-nav__brand">Real-Time Financial Monitor</span>
        <nav className="app-nav__links">
          <NavLink
            to="/add"
            className={({ isActive }) => `app-nav__link${isActive ? ' active' : ''}`}
          >
            Add Transaction
          </NavLink>
          <NavLink
            to="/monitor"
            className={({ isActive }) => `app-nav__link${isActive ? ' active' : ''}`}
          >
            Live Dashboard
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/monitor" replace />} />
        <Route path="/add" element={<AddTransactionPage />} />
        <Route path="/monitor" element={<MonitorPage />} />
      </Routes>
    </div>
  )
}

export default App
