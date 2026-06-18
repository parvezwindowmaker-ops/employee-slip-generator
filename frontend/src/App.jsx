import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  createHttpError,
  isNetworkError,
  readResponse,
  requireJsonPayload,
} from './api.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_ROWS_PER_PAGE = 20
const BANNER_AUTO_DISMISS_MS = 8000

const monthOptions = [
  ['1', 'January'],
  ['2', 'February'],
  ['3', 'March'],
  ['4', 'April'],
  ['5', 'May'],
  ['6', 'June'],
  ['7', 'July'],
  ['8', 'August'],
  ['9', 'September'],
  ['10', 'October'],
  ['11', 'November'],
  ['12', 'December'],
]

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 9 }, (_, index) => String(currentYear - 4 + index))

const payrollColumns = [
  ['serialNumber', 'Sr.'],
  ['employeeName', 'Employee'],
  ['departmentGroup', 'Group'],
  ['post', 'Post'],
  ['status', 'Status'],
  ['pfStatus', 'PF'],
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
  if (value === null || value === undefined || value === '') return '—'
  if (moneyFields.has(key)) return `₹${Number(value).toLocaleString('en-IN')}`
  return value
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`
}

function filenameFromDisposition(disposition, fallback) {
  const match = disposition?.match(/filename="?([^"]+)"?/i)
  return match?.[1] || fallback
}

/* ─── Auto-dismiss hook ─── */
function useAutoDismiss(value, setter, delay = BANNER_AUTO_DISMISS_MS) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (value) {
      timerRef.current = setTimeout(() => setter(''), delay)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, setter, delay])
}

function App() {
  const [credentials, setCredentials] = useState({ username: 'admin', password: '' })
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '')
  const [admin, setAdmin] = useState(null)
  const [periods, setPeriods] = useState([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [slips, setSlips] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadMonth, setUploadMonth] = useState('')
  const [uploadYear, setUploadYear] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [slipsLoading, setSlipsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  /* ─── Signature settings ─── */
  const [signatureMode, setSignatureMode] = useState(
    () => (localStorage.getItem('signatureMode') === 'with' ? 'with' : 'without'),
  )
  const [signatureImage, setSignatureImage] = useState(null)
  const [signatureFile, setSignatureFile] = useState(null)
  const [signatureLoading, setSignatureLoading] = useState(false)
  const [signatureUploading, setSignatureUploading] = useState(false)

  /* ─── Pagination state ─── */
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)

  /* ─── Multi-period download ─── */
  const [multiPeriodIds, setMultiPeriodIds] = useState(new Set())
  const [multiEmployee, setMultiEmployee] = useState('')

  /* ─── Tab navigation ─── */
  const [activeTab, setActiveTab] = useState('payroll')

  /* ─── Keep a ref to the current token so async functions always read the latest value ─── */
  const tokenRef = useRef(token)
  useEffect(() => { tokenRef.current = token }, [token])

  /* ─── Auto-dismiss banners ─── */
  useAutoDismiss(error, setError)
  useAutoDismiss(notice, setNotice)
  const selectedPeriod = periods.find((period) => String(period.id) === String(selectedPeriodId))

  const employeeOptions = useMemo(
    () =>
      slips
        .map((slip) => ({
          id: String(slip.id),
          label: slip.employeeName,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [slips],
  )

  /* Unique sorted employee names from the current period's slips (for multi-period picker) */
  const uniqueEmployeeNames = useMemo(
    () => [...new Set(slips.map((s) => s.employeeName))].sort((a, b) => a.localeCompare(b)),
    [slips],
  )

  const filteredSlips = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase()
    return slips.filter((slip) => {
      const matchesEmployee = !selectedEmployeeId || String(slip.id) === String(selectedEmployeeId)
      const matchesSearch = !search || slip.employeeName.toLowerCase().includes(search)
      return matchesEmployee && matchesSearch
    })
  }, [employeeSearch, selectedEmployeeId, slips])

  /* ─── Pagination computations ─── */
  const totalPages = Math.max(1, Math.ceil(filteredSlips.length / rowsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * rowsPerPage
  const endIndex = Math.min(startIndex + rowsPerPage, filteredSlips.length)
  const paginatedSlips = filteredSlips.slice(startIndex, endIndex)

  const filteredNetPay = useMemo(
    () => filteredSlips.reduce((total, slip) => total + Number(slip.netAmount || 0), 0),
    [filteredSlips],
  )

  function resetSession(message = '') {
    localStorage.removeItem('adminToken')
    tokenRef.current = ''
    setToken('')
    setAdmin(null)
    setPeriods([])
    setSelectedPeriodId('')
    setSlips([])
    setSignatureImage(null)
    setSignatureFile(null)
    setError(message)
    setCredentials((current) => ({ ...current, password: '' }))
  }

  async function apiRequest(path, options = {}) {
    const currentToken = tokenRef.current
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${currentToken}`,
          ...(options.headers || {}),
        },
      })

      if (response.status === 401) {
        resetSession('Session invalid. Please log in again.')
        const error = new Error('Authentication required')
        error.status = 401
        throw error
      }

      if (!response.ok) {
        const data = await readResponse(response)
        throw createHttpError(response, data)
      }

      return response
    } catch (err) {
      if (isNetworkError(err)) {
        throw new Error(
          'Unable to connect to the server. Please check your internet connection and ensure the backend is running.',
          { cause: err },
        )
      }
      throw err
    }
  }

  async function loadPeriods(preferredPeriodId) {
    const response = await apiRequest('/payroll-periods')
    const data = requireJsonPayload(await readResponse(response))
    setPeriods(data)

    if (data.length === 0) {
      setSelectedPeriodId('')
      setSlips([])
      return
    }

    const preferredExists = data.some(
      (period) => String(period.id) === String(preferredPeriodId),
    )
    setSelectedPeriodId(String(preferredExists ? preferredPeriodId : data[0].id))
  }

  useEffect(() => {
    if (!token) return

    async function bootstrap() {
      setLoading(true)
      setError('')
      setNotice('')

      try {
        const response = await apiRequest('/auth/me')
        const data = requireJsonPayload(await readResponse(response))
        setAdmin(data.admin)
        await loadPeriods(selectedPeriodId)
      } catch (loadError) {
        if (loadError.status === 401) {
          return
        }
        resetSession(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token || !selectedPeriodId) return

    async function loadSlips() {
      setSlipsLoading(true)
      setError('')
      setSelectedEmployeeId('')
      setEmployeeSearch('')
      setCurrentPage(1)

      try {
        const response = await apiRequest(`/payroll-periods/${selectedPeriodId}/slips`)
        const data = requireJsonPayload(await readResponse(response))
        setSlips(data.slips)
      } catch (loadError) {
        if (loadError.status !== 401) {
          setError(loadError.message)
        }
      } finally {
        setSlipsLoading(false)
      }
    }

    loadSlips()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriodId, token])

  /* ─── Persist signature mode ─── */
  useEffect(() => {
    localStorage.setItem('signatureMode', signatureMode)
  }, [signatureMode])

  /* ─── Load stored signature once authenticated ─── */
  useEffect(() => {
    if (!token) return

    async function loadSignature() {
      setSignatureLoading(true)
      try {
        const response = await apiRequest('/settings/signature')
        const data = requireJsonPayload(await readResponse(response))
        setSignatureImage(data.signature || null)
      } catch (loadError) {
        // Non-fatal: a missing signature shouldn't block the dashboard
        if (loadError.status !== 401) {
          setSignatureImage(null)
        }
      } finally {
        setSignatureLoading(false)
      }
    }

    loadSignature()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function handleLogin(event) {
    event.preventDefault()

    if (!credentials.username.trim()) {
      setError('Please enter your username.')
      return
    }
    if (!credentials.password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    setError('')
    setNotice('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
      const data = await readResponse(response)

      if (!response.ok) {
        throw createHttpError(response, data, {
          defaultMessage: 'Invalid credentials. Please try again.',
        })
      }

      const loginData = requireJsonPayload(data)
      localStorage.setItem('adminToken', loginData.token)
      tokenRef.current = loginData.token
      setCredentials((current) => ({ ...current, password: '' }))
      setAdmin(loginData.admin)
      setToken(loginData.token)
    } catch (loginError) {
      if (isNetworkError(loginError)) {
        setError('Unable to connect to the server. Please check your connection.')
      } else {
        setError(loginError.message)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    resetSession('')
  }

  async function handleUpload(event) {
    event.preventDefault()

    if (!uploadFile) {
      setError('Please select an XLSX file to upload.')
      return
    }

    /* Validate file type */
    if (!/\.(xlsx|xls)$/i.test(uploadFile.name)) {
      setError('Invalid file type. Only .xlsx and .xls files are supported.')
      return
    }

    /* Validate file size (15 MB) */
    if (uploadFile.size > 15 * 1024 * 1024) {
      setError('File is too large. Maximum allowed size is 15 MB.')
      return
    }

    /* Validate month/year combo — both or neither */
    if ((uploadMonth && !uploadYear) || (!uploadMonth && uploadYear)) {
      setError('Please select both Month and Year, or leave both on "Auto detect".')
      return
    }

    const form = event.currentTarget

    setUploading(true)
    setError('')
    setNotice('')

    const formData = new FormData()
    formData.append('file', uploadFile)

    if (uploadMonth && uploadYear) {
      formData.append('month', uploadMonth)
      formData.append('year', uploadYear)
    }

    try {
      const response = await apiRequest('/payroll-periods/upload', {
        method: 'POST',
        body: formData,
      })
      const data = requireJsonPayload(await readResponse(response))

      setUploadFile(null)
      setUploadMonth('')
      setUploadYear('')
      form.reset()

      /* Build success notice — handle single and multi-period results */
      const periodsInfo = data.periods || []
      let message

      if (periodsInfo.length > 1) {
        const details = periodsInfo
          .map((p) => `${p.period.label} (${p.employeesImported} employees)`)
          .join(', ')
        message = `Successfully imported ${periodsInfo.length} periods: ${details}.`
      } else {
        message = `Successfully imported ${data.employeesImported} salary records for ${data.period?.label || 'the selected period'}.`
      }

      if (data.skippedSheets?.length > 0) {
        message += ` Skipped sheets: ${data.skippedSheets.join(', ')}.`
      }
      if (data.warnings?.length > 0) {
        message += ` Warnings: ${data.warnings.join('; ')}.`
      }

      setNotice(message)
      await loadPeriods(data.period?.id)
    } catch (uploadError) {
      if (uploadError.status !== 401) {
        setError(uploadError.message)
      }
    } finally {
      setUploading(false)
    }
  }

  async function downloadFile(path, fallbackFileName) {
    setDownloading(true)
    setError('')
    setNotice('')

    try {
      const response = await apiRequest(path)
      const blob = await response.blob()
      const fileName = filenameFromDisposition(
        response.headers.get('content-disposition'),
        fallbackFileName,
      )
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setNotice(`Downloaded "${fileName}" successfully.`)
    } catch (downloadError) {
      if (downloadError.status !== 401) {
        setError(downloadError.message)
      }
    } finally {
      setDownloading(false)
    }
  }

  function handleDownloadOne(slip) {
    if (!ensureSignatureReady()) return

    const params = new URLSearchParams()
    params.set('includeSignature', signatureMode === 'with' ? 'true' : 'false')
    downloadFile(
      `/payroll-periods/${selectedPeriodId}/slips/${slip.id}/pdf?${params.toString()}`,
      `${slip.employeeName}_Salary_Slip.pdf`,
    )
  }

  function handleDownloadFiltered() {
    if (!ensureSignatureReady()) return

    const params = new URLSearchParams()

    if (selectedEmployeeId) {
      params.set('employeeId', selectedEmployeeId)
    } else if (employeeSearch.trim()) {
      params.set('search', employeeSearch.trim())
    }

    params.set('includeSignature', signatureMode === 'with' ? 'true' : 'false')

    const query = params.toString()
    downloadFile(
      `/payroll-periods/${selectedPeriodId}/slips/download${query ? `?${query}` : ''}`,
      'Salary_Slips.zip',
    )
  }

  function toggleMultiPeriod(periodId) {
    setMultiPeriodIds((prev) => {
      const next = new Set(prev)
      if (next.has(periodId)) {
        next.delete(periodId)
      } else {
        next.add(periodId)
      }
      return next
    })
  }

  function toggleAllPeriods() {
    if (multiPeriodIds.size === periods.length) {
      setMultiPeriodIds(new Set())
    } else {
      setMultiPeriodIds(new Set(periods.map((p) => p.id)))
    }
  }

  function handleMultiPeriodDownload() {
    if (!multiEmployee || multiPeriodIds.size === 0) {
      setError('Please select an employee and at least one period.')
      return
    }

    if (!ensureSignatureReady()) return

    const ids = Array.from(multiPeriodIds).join(',')
    const includeSignature = signatureMode === 'with' ? 'true' : 'false'
    downloadFile(
      `/payroll-periods/slips/multi-period-download?employeeName=${encodeURIComponent(multiEmployee)}&periodIds=${ids}&includeSignature=${includeSignature}`,
      `${multiEmployee}_Multi_Period_Slips.zip`,
    )
  }

  /* ─── Signature management ─── */

  /* Guards downloads: if "with signature" is chosen but none is uploaded, send
     the user to the Signature tab instead of producing an unsigned slip. */
  function ensureSignatureReady() {
    if (signatureMode === 'with' && !signatureImage) {
      setError('No signature uploaded yet. Upload one in the Signature tab, or switch to "Computer-generated".')
      setActiveTab('signature')
      return false
    }
    return true
  }

  async function handleSignatureUpload(event) {
    event.preventDefault()

    if (!signatureFile) {
      setError('Please select a signature image to upload.')
      return
    }

    if (!/\.(png|jpe?g)$/i.test(signatureFile.name)) {
      setError('Invalid file type. Only PNG or JPEG images are supported.')
      return
    }

    if (signatureFile.size > 2 * 1024 * 1024) {
      setError('Signature image is too large. Maximum allowed size is 2 MB.')
      return
    }

    const form = event.currentTarget

    setSignatureUploading(true)
    setError('')
    setNotice('')

    const formData = new FormData()
    formData.append('signature', signatureFile)

    try {
      const response = await apiRequest('/settings/signature', {
        method: 'POST',
        body: formData,
      })
      const data = requireJsonPayload(await readResponse(response))

      setSignatureImage(data.signature || null)
      setSignatureFile(null)
      form.reset()
      setNotice('Signature saved. It will appear on slips when "Include authorized signature" is selected.')
    } catch (uploadError) {
      if (uploadError.status !== 401) {
        setError(uploadError.message)
      }
    } finally {
      setSignatureUploading(false)
    }
  }

  async function handleSignatureRemove() {
    setSignatureUploading(true)
    setError('')
    setNotice('')

    try {
      await apiRequest('/settings/signature', { method: 'DELETE' })
      setSignatureImage(null)
      setNotice('Signature removed.')
    } catch (removeError) {
      if (removeError.status !== 401) {
        setError(removeError.message)
      }
    } finally {
      setSignatureUploading(false)
    }
  }

  /* ═══════════════════════════════════════
     LOGIN SCREEN
     ═══════════════════════════════════════ */
  if (!token) {
    const isLoginDisabled = !credentials.username || !credentials.password || loading

    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="login-header">
            <div className="login-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="eyebrow">Payroll Administration</p>
            <h1>Welcome Back</h1>
            <p className="login-subtitle">Sign in to manage employee salary slips</p>
          </div>

          <form onSubmit={handleLogin}>
            <label htmlFor="username">
              Username
              <input
                id="username"
                autoComplete="username"
                value={credentials.username}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, username: event.target.value }))
                }
                placeholder="Enter your username"
                aria-label="Username"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </label>
            <label htmlFor="password">
              Password
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={credentials.password}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="Enter your password"
                aria-label="Password"
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </label>

            {error && (
              <div
                id="login-error"
                className="banner banner-error"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
              >
                <span className="banner-icon">⚠️</span>
                <span className="banner-text">{error}</span>
                <button
                  type="button"
                  className="banner-close"
                  onClick={() => setError('')}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={isLoginDisabled}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span> Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </section>
      </main>
    )
  }

  /* Compact, read-only reminder of the active signature mode, with a shortcut
     to the Signature tab. Shown above the download actions. */
  const signatureHint = (
    <div className="signature-hint">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17c3-3 5-3 7 0s4 3 7-2" />
        <path d="M14 7l3 3" />
      </svg>
      <span>
        Slips download{' '}
        <strong>
          {signatureMode === 'with'
            ? 'with the authorized signature'
            : 'as computer-generated (no signature)'}
        </strong>
        .
      </span>
      <button type="button" className="link-button" onClick={() => setActiveTab('signature')}>
        Change
      </button>
    </div>
  )

  /* ═══════════════════════════════════════
     MAIN DASHBOARD
     ═══════════════════════════════════════ */
  return (
    <main className="app-shell">
      {/* ─── Top bar ─── */}
      <header className="topbar">
        <div>
          <p className="eyebrow">Payroll Administration</p>
          <h1>Salary Slip Register</h1>
        </div>
        <div className="admin-actions">
          <div className="admin-badge">
            <div className="admin-avatar">
              {(admin?.fullName || admin?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <span aria-label={`Logged in as ${admin?.fullName || admin?.username}`}>
              {admin?.fullName || admin?.username}
            </span>
          </div>
          <button type="button" className="secondary-button" onClick={handleLogout}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      {/* ─── Banners ─── */}
      {error && (
        <div
          className="banner banner-error"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          id="error-message"
        >
          <span className="banner-icon">⚠️</span>
          <span className="banner-text">{error}</span>
          <button
            type="button"
            className="banner-close"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <div
          className="banner banner-notice"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          id="notice-message"
        >
          <span className="banner-icon">✓</span>
          <span className="banner-text">{notice}</span>
          <button
            type="button"
            className="banner-close"
            onClick={() => setNotice('')}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}

      {/* ─── Tab Navigation ─── */}
      <nav className="tab-nav" aria-label="Dashboard sections">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'payroll' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('payroll')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Payroll
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'upload' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'download' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('download')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Bulk Download
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'signature' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('signature')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17c3-3 5-3 7 0s4 3 7-2" />
            <path d="M14 7l3 3" />
            <path d="M3 21h18" />
          </svg>
          Signature
        </button>
      </nav>

      {/* ═══════════════════════════════════════
         TAB: PAYROLL
         ═══════════════════════════════════════ */}
      {activeTab === 'payroll' && (
        <div className="tab-content">
          {/* ─── Period selector + stats ─── */}
          <section className="period-panel glass-card">
              <div className="panel-heading">
                <p className="eyebrow">Stored Payroll</p>
                <h2>Select Period</h2>
              </div>

              <label>
                Period
                <select
                  value={selectedPeriodId}
                  onChange={(event) => setSelectedPeriodId(event.target.value)}
                  disabled={periods.length === 0}
                >
                  {periods.length === 0 && <option value="">No periods available</option>}
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.label}
                    </option>
                  ))}
                </select>
              </label>

              <dl className="period-stats">
                <div className="stat-card">
                  <dt>Employees</dt>
                  <dd>{selectedPeriod?.employeeCount || 0}</dd>
                </div>
                <div className="stat-card">
                  <dt>Total Net Pay</dt>
                  <dd>{formatMoney(selectedPeriod?.totalNetPay)}</dd>
                </div>
                <div className="stat-card">
                  <dt>Uploaded</dt>
                  <dd>
                    {selectedPeriod?.uploadedAt
                      ? new Date(selectedPeriod.uploadedAt).toLocaleDateString()
                      : '—'}
                  </dd>
                </div>
              </dl>
          </section>

          {/* ─── Controls bar ─── */}
          <section className="controls-bar glass-card">
            <label htmlFor="employee-select">
              Employee
              <select
                id="employee-select"
                value={selectedEmployeeId}
                onChange={(event) => {
                  setSelectedEmployeeId(event.target.value)
                  setCurrentPage(1)
                }}
                disabled={slips.length === 0}
                aria-describedby="employee-help"
              >
                <option value="">All employees</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.label}
                  </option>
                ))}
              </select>
              <small id="employee-help">Filter by specific employee</small>
            </label>

            <label htmlFor="search-input">
              Search
              <input
                id="search-input"
                value={employeeSearch}
                onChange={(event) => {
                  setEmployeeSearch(event.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by name…"
                disabled={slips.length === 0}
                aria-describedby="search-help"
              />
              <small id="search-help">Type to search employees</small>
            </label>

            <button
              type="button"
              className="primary-button"
              onClick={handleDownloadFiltered}
              disabled={!selectedPeriodId || filteredSlips.length === 0 || downloading}
              aria-busy={downloading}
              aria-label={`Download ${filteredSlips.length} salary slip${filteredSlips.length === 1 ? '' : 's'}`}
            >
              {downloading ? (
                <>
                  <span className="btn-spinner"></span> Preparing…
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download {filteredSlips.length}
                </>
              )}
            </button>
          </section>

          {/* ─── Summary grid ─── */}
          <section className="summary-grid">
            <div className="summary-card glass-card">
              <span>Stored Periods</span>
              <strong>{periods.length}</strong>
            </div>
            <div className="summary-card glass-card">
              <span>Visible Employees</span>
              <strong>{filteredSlips.length}</strong>
            </div>
            <div className="summary-card glass-card">
              <span>Visible Net Pay</span>
              <strong>{formatMoney(filteredNetPay)}</strong>
            </div>
          </section>

          {signatureHint}
        </div>
      )}

      {/* ═══════════════════════════════════════
         TAB: UPLOAD
         ═══════════════════════════════════════ */}
      {activeTab === 'upload' && (
        <div className="tab-content">
          <form className="upload-panel glass-card" onSubmit={handleUpload}>
              <div className="panel-heading">
                <p className="eyebrow">Bulk Upload</p>
                <h2>Import Payroll Sheet</h2>
              </div>

              <label htmlFor="file-input">
                File <span className="required" aria-label="required">*</span>
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  disabled={uploading}
                  aria-describedby="file-help"
                  required
                />
                <small id="file-help">Accepted: .xlsx, .xls files up to 15 MB. Multi-sheet workbooks supported — each sheet auto-creates a separate month.</small>
              </label>

              <div className="form-row">
                <label htmlFor="upload-month">
                  Month
                  <select
                    id="upload-month"
                    value={uploadMonth}
                    onChange={(event) => setUploadMonth(event.target.value)}
                    disabled={uploading}
                    aria-describedby="month-help"
                  >
                    <option value="">Auto detect</option>
                    {monthOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <small id="month-help">Leave blank to auto-detect from file</small>
                </label>

                <label htmlFor="upload-year">
                  Year
                  <select
                    id="upload-year"
                    value={uploadYear}
                    onChange={(event) => setUploadYear(event.target.value)}
                    disabled={uploading}
                    aria-describedby="year-help"
                  >
                    <option value="">Auto detect</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <small id="year-help">Leave blank to auto-detect from file</small>
                </label>
              </div>

              <button
                type="submit"
                className="primary-button"
                disabled={uploading || !uploadFile}
                aria-busy={uploading}
              >
                {uploading ? (
                  <>
                    <span className="btn-spinner"></span> Uploading…
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload XLSX
                  </>
                )}
              </button>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════
         TAB: BULK DOWNLOAD
         ═══════════════════════════════════════ */}
      {activeTab === 'download' && (
        <div className="tab-content">
          <section className="multi-period-bar glass-card">
            <div className="panel-heading">
              <p className="eyebrow">Multi-Month Download</p>
              <h2>Download salary slips across multiple months</h2>
            </div>

            {periods.length === 0 ? (
              <div className="empty-state">
                <p>No payroll periods available. Upload an XLSX file first.</p>
              </div>
            ) : (
              <>
                <label htmlFor="multi-employee-select">
                  Employee <span className="required" aria-label="required">*</span>
                  <select
                    id="multi-employee-select"
                    value={multiEmployee}
                    onChange={(event) => setMultiEmployee(event.target.value)}
                    disabled={uniqueEmployeeNames.length === 0}
                  >
                    <option value="">— Select an employee —</option>
                    {uniqueEmployeeNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <small>Select the employee whose slips you want to download</small>
                </label>

                <div className="multi-period-actions">
                  <button
                    type="button"
                    className="secondary-button multi-period-toggle"
                    onClick={toggleAllPeriods}
                  >
                    {multiPeriodIds.size === periods.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="multi-period-count">
                    {multiPeriodIds.size} of {periods.length} selected
                  </span>
                </div>

                <div className="multi-period-grid">
                  {periods.map((period) => (
                    <label key={period.id} className={`multi-period-chip ${multiPeriodIds.has(period.id) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={multiPeriodIds.has(period.id)}
                        onChange={() => toggleMultiPeriod(period.id)}
                      />
                      {period.label}
                    </label>
                  ))}
                </div>

                {signatureHint}

                <button
                  type="button"
                  className="primary-button"
                  onClick={handleMultiPeriodDownload}
                  disabled={multiPeriodIds.size === 0 || !multiEmployee || downloading}
                  aria-busy={downloading}
                >
                  {downloading ? (
                    <><span className="btn-spinner"></span> Preparing…</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download {multiPeriodIds.size} Month{multiPeriodIds.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </>
            )}
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════
         TAB: SIGNATURE
         ═══════════════════════════════════════ */}
      {activeTab === 'signature' && (
        <div className="tab-content">
          <section className="signature-panel glass-card">
            <div className="panel-heading">
              <p className="eyebrow">Slip Signature</p>
              <h2>Signature Settings</h2>
            </div>

            <label htmlFor="signature-mode">
              Signature on salary slips
              <select
                id="signature-mode"
                value={signatureMode}
                onChange={(event) => setSignatureMode(event.target.value)}
              >
                <option value="without">Computer-generated (no signature)</option>
                <option value="with">Include authorized signature</option>
              </select>
              <small>
                {signatureMode === 'with'
                  ? 'Slips will display the uploaded authorized signature above the signatory line.'
                  : 'Slips will show a note that the document is computer-generated and needs no signature.'}
              </small>
            </label>

            {signatureMode === 'with' && (
              <div className="signature-manager">
                <div className="signature-preview-box">
                  <span className="signature-preview-label">Current signature</span>
                  {signatureLoading ? (
                    <p className="signature-empty-text">Loading…</p>
                  ) : signatureImage ? (
                    <img
                      src={signatureImage}
                      alt="Authorized signature"
                      className="signature-preview-img"
                    />
                  ) : (
                    <p className="signature-empty-text">No signature uploaded yet.</p>
                  )}

                  {signatureImage && !signatureLoading && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleSignatureRemove}
                      disabled={signatureUploading}
                    >
                      Remove signature
                    </button>
                  )}
                </div>

                <form className="signature-upload-form" onSubmit={handleSignatureUpload}>
                  <label htmlFor="signature-file">
                    {signatureImage ? 'Replace signature' : 'Upload signature'}{' '}
                    <span className="required" aria-label="required">*</span>
                    <input
                      id="signature-file"
                      type="file"
                      accept=".png,.jpg,.jpeg"
                      onChange={(event) => setSignatureFile(event.target.files?.[0] || null)}
                      disabled={signatureUploading}
                    />
                    <small>Accepted: PNG or JPEG up to 2 MB. A transparent PNG works best.</small>
                  </label>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={signatureUploading || !signatureFile}
                    aria-busy={signatureUploading}
                  >
                    {signatureUploading ? (
                      <>
                        <span className="btn-spinner"></span> Saving…
                      </>
                    ) : (
                      'Save signature'
                    )}
                  </button>
                </form>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ─── Table with pagination ─── */}
      {activeTab === 'payroll' && (
      <section className="table-wrap glass-card">
        {slipsLoading || loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p className="empty">Loading payroll records…</p>
          </div>
        ) : !selectedPeriodId || periods.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h3>No Payroll Data</h3>
            <p>
              Upload your first XLSX payroll sheet using the form above to get started. The system
              will auto-detect month and year from the file.
            </p>
          </div>
        ) : filteredSlips.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h3>No Results Found</h3>
            <p>
              No salary records match your current filters. Try adjusting the search or employee
              selection.
            </p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table role="grid">
                <thead>
                  <tr>
                    {payrollColumns.map(([, label]) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSlips.map((slip) => (
                    <tr key={slip.id}>
                      {payrollColumns.map(([key]) => (
                        <td key={key}>{formatCell(key, slip[key])}</td>
                      ))}
                      <td>
                        <button
                          type="button"
                          className="table-button"
                          onClick={() => handleDownloadOne(slip)}
                          disabled={downloading}
                          aria-label={`Download salary slip for ${slip.employeeName}`}
                          aria-busy={downloading}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ─── Pagination bar ─── */}
            <div className="pagination-bar">
              <div className="pagination-info">
                Showing {startIndex + 1}–{endIndex} of {filteredSlips.length} records
              </div>
              <div className="pagination-controls">
                <label className="pagination-label">
                  Rows:
                  <select
                    value={rowsPerPage}
                    onChange={(event) => {
                      setRowsPerPage(Number(event.target.value))
                      setCurrentPage(1)
                    }}
                    className="pagination-select"
                  >
                    {ROWS_PER_PAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="pagination-nav">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage <= 1}
                    aria-label="First page"
                    title="First page"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    aria-label="Previous page"
                    title="Previous page"
                  >
                    ‹
                  </button>
                  <span className="pagination-page">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    aria-label="Next page"
                    title="Next page"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage >= totalPages}
                    aria-label="Last page"
                    title="Last page"
                  >
                    »
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
      )}

      {/* ─── Footer ─── */}
      <footer className="app-footer">
        <p>Employee Salary Slip Register &copy; {new Date().getFullYear()}</p>
      </footer>
    </main>
  )
}

export default App
