import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Income from './pages/Income'
import Budgets from './pages/Budgets'
import Recurring from './pages/Recurring'

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/expenses" element={<Protected><Expenses /></Protected>} />
          <Route path="/income" element={<Protected><Income /></Protected>} />
          <Route path="/budgets" element={<Protected><Budgets /></Protected>} />
          <Route path="/recurring" element={<Protected><Recurring /></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
