import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { CaseHeader } from './CaseHeader'
import { mockCase } from '../../test/fixtures'

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('CaseHeader', () => {
  const defaultProps = {
    caseData: mockCase,
    canSave: true,
    canDelete: true,
    canShare: true,
    shareLoading: false,
    showShareDropdown: false,
    copySuccess: false,
    onSave: vi.fn(),
    onDeleteClick: vi.fn(),
    onToggleShareDropdown: vi.fn(),
    onToggleShare: vi.fn(),
    onCopyShareLink: vi.fn(),
  }

  it('should render back link', () => {
    renderWithRouter(<CaseHeader {...defaultProps} />)

    // Back link contains "←" and a span with "Back" (hidden on mobile)
    const backLink = screen.getByRole('link', { name: /back/i })
    expect(backLink).toBeInTheDocument()
    expect(backLink).toHaveAttribute('href', '/consultations')
  })

  describe('Save button', () => {
    it('should render save button when canSave is true', () => {
      renderWithRouter(<CaseHeader {...defaultProps} />)

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })

    it('should not render save button when canSave is false', () => {
      renderWithRouter(<CaseHeader {...defaultProps} canSave={false} />)

      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    })

    it('should call onSave when clicked', () => {
      const onSave = vi.fn()
      renderWithRouter(<CaseHeader {...defaultProps} onSave={onSave} />)

      fireEvent.click(screen.getByRole('button', { name: /save/i }))
      expect(onSave).toHaveBeenCalledTimes(1)
    })
  })

  describe('Delete button', () => {
    it('should render delete button when canDelete is true', () => {
      renderWithRouter(<CaseHeader {...defaultProps} />)

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    })

    it('should not render delete button when canDelete is false', () => {
      renderWithRouter(<CaseHeader {...defaultProps} canDelete={false} />)

      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    })

    it('should call onDeleteClick when clicked', () => {
      const onDeleteClick = vi.fn()
      renderWithRouter(<CaseHeader {...defaultProps} onDeleteClick={onDeleteClick} />)

      fireEvent.click(screen.getByRole('button', { name: /delete/i }))
      expect(onDeleteClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Share button', () => {
    it('should render share button when canShare is true', () => {
      renderWithRouter(<CaseHeader {...defaultProps} />)

      expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
    })

    it('should not render share button when canShare is false', () => {
      renderWithRouter(<CaseHeader {...defaultProps} canShare={false} />)

      expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument()
    })

    it('should show "Sharing is enabled" aria-label when case is public', () => {
      renderWithRouter(
        <CaseHeader {...defaultProps} caseData={{ ...mockCase, is_public: true }} />
      )

      expect(screen.getByRole('button', { name: /sharing is enabled/i })).toBeInTheDocument()
    })

    it('should call onToggleShareDropdown when clicked', () => {
      const onToggleShareDropdown = vi.fn()
      renderWithRouter(<CaseHeader {...defaultProps} onToggleShareDropdown={onToggleShareDropdown} />)

      fireEvent.click(screen.getByRole('button', { name: /share/i }))
      expect(onToggleShareDropdown).toHaveBeenCalledTimes(1)
    })
  })

  describe('Share dropdown', () => {
    it('should show dropdown when showShareDropdown is true', () => {
      renderWithRouter(<CaseHeader {...defaultProps} showShareDropdown={true} />)

      expect(screen.getByText('Public sharing')).toBeInTheDocument()
      expect(screen.getByText('Anyone with link can view')).toBeInTheDocument()
    })

    it('should not show dropdown when showShareDropdown is false', () => {
      renderWithRouter(<CaseHeader {...defaultProps} showShareDropdown={false} />)

      expect(screen.queryByText('Public sharing')).not.toBeInTheDocument()
    })

    it('should show toggle in enabled state when case is public', () => {
      renderWithRouter(
        <CaseHeader
          {...defaultProps}
          showShareDropdown={true}
          caseData={{ ...mockCase, is_public: true, public_slug: 'abc123' }}
        />
      )

      expect(screen.getByText('Share link')).toBeInTheDocument()
    })

    it('should show private notice when case is not public', () => {
      renderWithRouter(
        <CaseHeader {...defaultProps} showShareDropdown={true} caseData={{ ...mockCase, is_public: false }} />
      )

      expect(screen.getByText('Turn on to create a shareable link')).toBeInTheDocument()
    })

    it('should show copy success text when copy succeeds', () => {
      renderWithRouter(
        <CaseHeader
          {...defaultProps}
          showShareDropdown={true}
          copySuccess={true}
          caseData={{ ...mockCase, is_public: true, public_slug: 'abc123' }}
        />
      )

      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })
})
