import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ResetPassword from './ResetPassword'
import { AuthProvider } from '../contexts/AuthContext'
import { authApi, tokenStorage } from '../api/auth'
import type { ReactNode } from 'react'

// Mock the auth API
vi.mock('../api/auth', () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    refresh: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
  tokenStorage: {
    getToken: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    needsRefresh: vi.fn(),
    isExpired: vi.fn(),
  },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const renderWithToken = (token: string) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/reset-password?token=${token}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/reset-password" element={children} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
  return render(<ResetPassword />, { wrapper: Wrapper })
}

const renderWithoutToken = () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/reset-password']}>
      <AuthProvider>
        <Routes>
          <Route path="/reset-password" element={children} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
  return render(<ResetPassword />, { wrapper: Wrapper })
}

describe('ResetPassword Page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(tokenStorage.getToken).mockReturnValue(null)
  })

  it('should render reset password form when token is provided', async () => {
    renderWithToken('valid-token-123')

    await waitFor(() => {
      expect(screen.getByText('Set New Password')).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument()
  })

  it('should redirect to forgot-password when no token', async () => {
    renderWithoutToken()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/forgot-password')
    })
  })

  it('should have link back to login page', async () => {
    renderWithToken('valid-token-123')

    await waitFor(() => {
      expect(screen.getByText('Set New Password')).toBeInTheDocument()
    })

    const backToLoginLinks = screen.getAllByRole('link', { name: /back to sign in/i })
    expect(backToLoginLinks.length).toBeGreaterThan(0)
    expect(backToLoginLinks.some(link => link.getAttribute('href') === '/login')).toBe(true)
  })

  it('should allow typing in password fields', async () => {
    const user = userEvent.setup()
    renderWithToken('valid-token-123')

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    })

    const passwordInput = screen.getByLabelText(/new password/i)
    const confirmInput = screen.getByLabelText(/confirm password/i)

    await user.type(passwordInput, 'newpassword123')
    await user.type(confirmInput, 'newpassword123')

    expect(passwordInput).toHaveValue('newpassword123')
    expect(confirmInput).toHaveValue('newpassword123')
  })

  it('should show error when passwords do not match', async () => {
    const user = userEvent.setup()
    renderWithToken('valid-token-123')

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/new password/i), 'password123')
    await user.type(screen.getByLabelText(/confirm password/i), 'different123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })
  })

  it('should show error when password is too short', async () => {
    const user = userEvent.setup()
    renderWithToken('valid-token-123')

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/new password/i), 'short')
    await user.type(screen.getByLabelText(/confirm password/i), 'short')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })
  })

  it('should show success message after successful reset', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.resetPassword).mockResolvedValue({
      message: 'Your password has been reset successfully.',
    })

    renderWithToken('valid-token-123')

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText('Password Reset')).toBeInTheDocument()
    })

    expect(screen.getByText(/password has been reset successfully/i)).toBeInTheDocument()
  })

  it('should show error message on API failure', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      new Error('Invalid or expired reset link')
    )

    renderWithToken('invalid-token')

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid or expired reset link')).toBeInTheDocument()
    })
  })

  it('should disable button while loading', async () => {
    const user = userEvent.setup()
    // Make API call hang
    vi.mocked(authApi.resetPassword).mockImplementation(() => new Promise(() => {}))

    renderWithToken('valid-token-123')

    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText('Resetting...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /resetting/i })).toBeDisabled()
    })
  })
})
