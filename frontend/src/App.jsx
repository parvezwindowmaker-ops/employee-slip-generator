import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const payrollColumns = [
  ['serialNumber', 'Sr.'],
  ['employeeName', 'Employee'],
  ['group', 'Group'],
  ['post', 'Post'],
  ['status', 'Status'],
  ['pfEligible', 'PF'],
  ['uanNumber', 'UAN'],
  ['salaryAmount', 'Salary'],
  ['presentDays', 'Present'],
  ['totalDays', 'Days'],
  ['gross', 'Gross'],
  ['totalDeductions', 'Deduction'],
  ['netAmount', 'Net Amount'],
]

const moneyFields = new Set(['salaryAmount', 'gross', 'totalDeductions', 'netAmount'])

function formatCell(key, value) {
  if (value === null || value === undefined || value === '') return '-'
  if (key === 'pfEligible') return value ? 'Yes' : 'No'
  if (moneyFields.has(key)) return Number(value).toLocaleString('en-IN')
  return value
}

function App() {
  const [credentials, setCredentials] = useState({ username: 'admin', password: '' })
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '')
  const [admin, setAdmin] = useState(null)
  const [employees, setEmployees] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const netPayTotal = useMemo(
    () => employees.reduce((total, employee) => total + Number(employee.netAmount || 0), 0),
    [employees],
  )

  useEffect(() => {
    if (!token) return

    async function loadAdminData() {
      setLoading(true)
      setError('')

      try {
        const [meResponse, employeesResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/employees`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (!meResponse.ok || !employeesResponse.ok) {
          throw new Error('Please login again')
        }

        const meData = await meResponse.json()
        const employeesData = await employeesResponse.json()
        setAdmin(meData.admin)
        setEmployees(employeesData)
      } catch (loadError) {
        localStorage.removeItem('adminToken')
        setToken('')
        setAdmin(null)
        setEmployees([])
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadAdminData()
  }, [token])

  async function handleLogin(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to login')
      }

      localStorage.setItem('adminToken', data.token)
      setToken(data.token)
      setAdmin(data.admin)
    } catch (loginError) {
      setError(loginError.message)
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('adminToken')
    setToken('')
    setAdmin(null)
    setEmployees([])
  }

  if (!token) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div>
            <p className="eyebrow">Payroll administration</p>
            <h1>Admin Login</h1>
          </div>

          <form onSubmit={handleLogin}>
            <label>
              Username
              <input
                autoComplete="username"
                value={credentials.username}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, username: event.target.value }))
                }
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Payroll administration</p>
          <h1>Employee Salary Register</h1>
        </div>
        <div className="admin-actions">
          <span>{admin?.fullName || admin?.username}</span>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="summary-grid">
        <div>
          <span>Total Employees</span>
          <strong>{employees.length}</strong>
        </div>
        <div>
          <span>Total Net Pay</span>
          <strong>{netPayTotal.toLocaleString('en-IN')}</strong>
        </div>
        <div>
          <span>Source Fields</span>
          <strong>38 XLSX columns</strong>
        </div>
      </section>

      <section className="table-wrap">
        {loading ? (
          <p className="empty">Loading payroll records...</p>
        ) : (
          <table>
            <thead>
              <tr>
                {payrollColumns.map(([, label]) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  {payrollColumns.map(([key]) => (
                    <td key={key}>{formatCell(key, employee[key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && employees.length === 0 && <p className="empty">No employees found.</p>}
      </section>
    </main>
  )
}

export default App
