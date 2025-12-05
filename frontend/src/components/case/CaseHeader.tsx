import { Link } from 'react-router-dom';
import type { Case } from '../../types';

interface CaseHeaderProps {
  caseData: Case;
  canSave: boolean;
  canDelete: boolean;
  canShare: boolean;
  shareLoading: boolean;
  showShareDropdown: boolean;
  copySuccess: boolean;
  onSave: () => void;
  onDeleteClick: () => void;
  onToggleShareDropdown: () => void;
  onToggleShare: () => void;
  onCopyShareLink: () => void;
}

export function CaseHeader({
  caseData,
  canSave,
  canDelete,
  canShare,
  shareLoading,
  showShareDropdown,
  copySuccess,
  onSave,
  onDeleteClick,
  onToggleShareDropdown,
  onToggleShare,
  onCopyShareLink,
}: CaseHeaderProps) {
  return (
    <div className="border-b border-amber-200/50 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <Link to="/consultations" className="text-amber-700 hover:text-amber-800 text-sm flex items-center gap-1">
        ← Back
      </Link>
      <div className="flex gap-2">
        {/* Save - only for completed cases with content */}
        {canSave && (
          <button
            onClick={onSave}
            className="text-xs px-3 py-1.5 bg-white rounded-lg shadow-sm text-gray-700 hover:bg-gray-50 border border-gray-200 flex items-center gap-1.5"
            aria-label="Save consultation as file"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Save
          </button>
        )}

        {/* Delete - always available */}
        {canDelete && (
          <button
            onClick={onDeleteClick}
            className="text-xs px-3 py-1.5 bg-white rounded-lg shadow-sm text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 flex items-center gap-1.5"
            aria-label="Delete consultation"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}

        {/* Share - only for completed cases with content */}
        {canShare && (
          <div className="relative">
            <button
              onClick={onToggleShareDropdown}
              className={`text-xs px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 ${
                caseData.is_public
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
              aria-label={`${caseData.is_public ? 'Sharing is enabled' : 'Share consultation'}`}
              aria-expanded={showShareDropdown}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {caseData.is_public ? 'Shared' : 'Share'}
              <svg className={`w-3 h-3 transition-transform ${showShareDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Share Dropdown */}
            {showShareDropdown && (
              <>
                {/* Backdrop to close dropdown */}
                <div className="fixed inset-0 z-10" onClick={onToggleShareDropdown} />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-20 p-4">
                  {/* Visibility Toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Public sharing</div>
                      <div className="text-xs text-gray-500">Anyone with link can view</div>
                    </div>
                    <button
                      onClick={onToggleShare}
                      disabled={shareLoading}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        caseData.is_public ? 'bg-green-500' : 'bg-gray-200'
                      } ${shareLoading ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          caseData.is_public ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Share Link (only when public) */}
                  {caseData.is_public && caseData.public_slug && (
                    <div className="pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-700 mb-2">Share link</div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={`${window.location.origin}/c/${caseData.public_slug}`}
                          className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-700 font-mono"
                        />
                        <button
                          onClick={onCopyShareLink}
                          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs font-medium"
                        >
                          {copySuccess ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Private notice */}
                  {!caseData.is_public && (
                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                      Turn on to create a shareable link
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
