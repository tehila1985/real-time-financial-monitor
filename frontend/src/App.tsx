import { Navigate, Route, Routes } from 'react-router-dom'
import { AddTransactionPage } from './pages/AddTransactionPage'
import { MonitorPage } from './pages/MonitorPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/monitor" replace />} />
      <Route path="/add" element={<AddTransactionPage />} />
      <Route path="/monitor" element={<MonitorPage />} />
    </Routes>
  )
}

export default App
