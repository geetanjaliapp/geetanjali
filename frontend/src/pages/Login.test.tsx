import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Login from './Login'
import { AuthProvider } from '../contexts/AuthContext'
import { authApi, tokenStorage } from '../api/auth'
import { mockUser } from '../test/fixtures'
import type { ReactNode } from 'react'

// Mock the auth API
vi.mock('../api/auth', () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    refresh: vi.fn(),
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

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
)

describe('Login Page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(tokenStorage.getToken).mockReturnValue(null)
  })

  it('should render login form', async () => {
    render(<Login />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Welcome Back')).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should have link to signup page', async () => {
    render(<Login />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText("Don't have an account?")).toBeInTheDocument()
    })

    // There are two signup links - one in navbar and one in form. Get the one after "Don't have an account?"
    const signupLinks = screen.getAllByRole('link', { name: /sign up/i })
    expect(signupLinks.length).toBeGreaterThan(0)
    expect(signupLinks.some(link => link.getAttribute('href') === '/signup')).toBe(true)
  })

  it('should allow typing in form fields', async () => {
    const user = userEvent.setup()
    render(<Login />, { wrapper })

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    })

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')

    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('password123')
  })

  it('should call login and navigate on success', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: 'token',
      token_type: 'bearer',
      user: mockUser,
    })

    render(<Login />, { wrapper })

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('should show error message on login failure', async () => {
    const user = userEvent.setup()
    // Create a mock error - the friendly message will be shown
    vi.mocked(authApi.login).mockRejectedValue(new Error('Please try again later'))

    render(<Login />, { wrapper })

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Error message is processed by errorMessages.login() and displayed in red box
    await waitFor(() => {
      expect(screen.getByText('Please try again later')).toBeInTheDocument()
    })
  })

  it('should disable button while loading', async () => {
    const user = userEvent.setup()
    // Make login hang
    vi.mocked(authApi.login).mockImplementation(() => new Promise(() => {}))

    render(<Login />, { wrapper })

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
      // Query for the submit button specifically by its loading text
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })
  })
})
