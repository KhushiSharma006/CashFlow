import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    const { data, error } = await signUp(email, password, fullName)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    if (data?.session) {
      navigate('/')
    } else {
      setInfo('Account created. Check your email to confirm, then sign in.')
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-semibold text-ink">Tallybook</h1>
          <p className="text-ink-soft text-sm mt-1">Open a new ledger.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <label htmlFor="fullName" className="block text-sm font-medium text-ink mb-1.5">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
              placeholder="Khushi Sharma"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-2">
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 text-sm focus:border-brass outline-none"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <p className="text-rust text-sm mt-3 bg-rust-soft rounded-md px-3 py-2">{error}</p>
          )}
          {info && (
            <p className="text-sage text-sm mt-3 bg-sage-soft rounded-md px-3 py-2">{info}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-5 bg-ink text-paper-raised rounded-md py-2.5 text-sm font-medium hover:bg-ink-soft transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-ink-soft mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-brass font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
