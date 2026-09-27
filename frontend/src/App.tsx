import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>
      </Route>
      {/* Dusra kuthala pan route(*) user ne add kela tar redirect kara home page la */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
