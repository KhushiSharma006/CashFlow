import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Each page is its own chunk, fetched only when its route is visited.
// Dashboard and Insights in particular pull in Recharts (a sizeable
// dependency) — splitting means someone who never opens those pages
// never downloads that code at all.
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Income = lazy(() => import('./pages/Income'))
const Budgets = lazy(() => import('./pages/Budgets'))
const Recurring = lazy(() => import('./pages/Recurring'))
const Insights = lazy(() => import('./pages/Insights'))
const Households = lazy(() => import('./pages/Households'))

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <p className="font-mono text-ink-soft text-sm">Loading…</p>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/expenses" element={<Protected><Expenses /></Protected>} />
            <Route path="/income" element={<Protected><Income /></Protected>} />
            <Route path="/budgets" element={<Protected><Budgets /></Protected>} />
            <Route path="/recurring" element={<Protected><Recurring /></Protected>} />
            <Route path="/insights" element={<Protected><Insights /></Protected>} />
            <Route path="/households" element={<Protected><Households /></Protected>} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
