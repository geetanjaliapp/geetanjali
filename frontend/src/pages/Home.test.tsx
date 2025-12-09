import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Home from './Home'
import { AuthProvider } from '../contexts/AuthContext'
import * as api from '../lib/api'
import { authApi, tokenStorage } from '../api/auth'
import { mockCase, mockVerse, mockUser } from '../test/fixtures'
import type { ReactNode } from 'react'

// Mock the API module
vi.mock('../lib/api', () => ({
  checkHealth: vi.fn(),
  casesApi: {
    list: vi.fn(),
  },
  versesApi: {
    getRandom: vi.fn(),
  },
}))

// Mock the experiment module to always return 'control' for deterministic tests
vi.mock('../lib/experiment', () => ({
  useHomepageCTAExperiment: () => ({
    variant: 'control',
    trackClick: vi.fn(),
  }),
  trackEvent: vi.fn(),
  EXPERIMENTS: {
    HOMEPAGE_CTA: { name: 'homepage_cta_v1', variants: ['control', 'variant'], weights: [50, 50] },
  },
}))

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

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
)

describe('Home Page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.checkHealth).mockResolvedValue({
      status: 'healthy',
      service: 'geetanjali',
      environment: 'test',
    })
    vi.mocked(api.versesApi.getRandom).mockResolvedValue(mockVerse)
    vi.mocked(api.casesApi.list).mockResolvedValue([])
    vi.mocked(tokenStorage.getToken).mockReturnValue(null)
  })

  it('should render main heading and tagline', async () => {
    render(<Home />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/Difficult Decisions/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/Ethical guidance grounded in the timeless teachings/i)).toBeInTheDocument()
  })

  it('should render "Ask a Question" CTA button', async () => {
    render(<Home />, { wrapper })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /ask a question/i })).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: /ask a question/i })).toHaveAttribute('href', '/cases/new')
  })

  it('should render feature cards', async () => {
    render(<Home />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText('Clear Guidance')).toBeInTheDocument()
    })

    expect(screen.getByText('Multiple Paths')).toBeInTheDocument()
    expect(screen.getByText('Rooted in Scripture')).toBeInTheDocument()
  })

  it('should show no-signup message when not authenticated', async () => {
    render(<Home />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(/Try it free/i)).toBeInTheDocument()
    })
  })

  describe('verse display', () => {
    it('should fetch and display random verse', async () => {
      render(<Home />, { wrapper })

      await waitFor(() => {
        expect(api.versesApi.getRandom).toHaveBeenCalled()
      })
    })

    it('should handle verse fetch error gracefully', async () => {
      vi.mocked(api.versesApi.getRandom).mockRejectedValue(new Error('Failed'))

      render(<Home />, { wrapper })

      await waitFor(() => {
        expect(api.versesApi.getRandom).toHaveBeenCalled()
      })

      // Page should still render without crashing
      expect(screen.getByRole('link', { name: /ask a question/i })).toBeInTheDocument()
    })
  })

  describe('health check', () => {
    it('should show error when backend is unavailable', async () => {
      vi.mocked(api.checkHealth).mockRejectedValue(new Error('Connection refused'))

      render(<Home />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText('Service Unavailable')).toBeInTheDocument()
      })
    })

    it('should not show error when backend is healthy', async () => {
      render(<Home />, { wrapper })

      await waitFor(() => {
        expect(api.checkHealth).toHaveBeenCalled()
      })

      // Give time for any error state to appear
      await new Promise((r) => setTimeout(r, 100))

      expect(screen.queryByText('Service Unavailable')).not.toBeInTheDocument()
    })
  })

  describe('authenticated user', () => {
    beforeEach(() => {
      vi.mocked(tokenStorage.getToken).mockReturnValue('valid-token')
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(api.casesApi.list).mockResolvedValue([mockCase])
    })

    it('should show recent consultations for authenticated users', async () => {
      render(<Home />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText(/Continue where you left off/i)).toBeInTheDocument()
      })

      expect(screen.getByText(mockCase.title)).toBeInTheDocument()
    })

    it('should not show "no signup required" message', async () => {
      render(<Home />, { wrapper })

      await waitFor(() => {
        expect(authApi.getCurrentUser).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(screen.queryByText(/Try it free/i)).not.toBeInTheDocument()
      })
    })

    it('should link to all consultations', async () => {
      render(<Home />, { wrapper })

      await waitFor(() => {
        expect(screen.getByText(/Continue where you left off/i)).toBeInTheDocument()
      })

      expect(screen.getByRole('link', { name: /view all/i })).toHaveAttribute('href', '/consultations')
    })
  })
})
