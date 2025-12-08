import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Case } from '../../types';

interface CaseHeaderProps {
  caseData: Case;
  canSave: boolean;
  canDelete: boolean;
  canShare: boolean;
  shareLoading: boolean;
  copySuccess: boolean;
  onSave: () => void;
  onDeleteClick: () => void;
  onToggleShare: () => void;
  onCopyShareLink: () => void;
}

export function CaseHeader({
  caseData,
  canSave,
  canDelete,
  canShare,
  shareLoading,
  copySuccess,
  onSave,
  onDeleteClick,
  onToggleShare,
  onCopyShareLink,
}: CaseHeaderProps) {
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  return (
    <div className="border-b border-amber-200/50 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
      {/* Main header row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between">
        <Link to="/consultations" className="text-amber-700 hover:text-amber-800 text-sm flex items-center gap-1">
          ← <span className="hidden sm:inline">Back</span>
        </Link>
        <div className="flex gap-1.5 sm:gap-2">
          {/* Save - only for completed cases with content */}
          {canSave && (
            <button
              onClick={onSave}
              className="p-2 sm:px-3 sm:py-1.5 bg-white rounded-lg shadow-sm text-gray-700 hover:bg-gray-50 border border-gray-200 flex items-center gap-1.5"
              aria-label="Save consultation as file"
            >
              <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline text-xs">Save</span>
            </button>
          )}

          {/* Share toggle - only for completed cases with content */}
          {canShare && (
            <button
              onClick={onToggleShare}
              disabled={shareLoading}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors ${
                caseData.is_public
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              } ${shareLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-label={caseData.is_public ? 'Stop sharing' : 'Share consultation'}
            >
              <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="hidden sm:inline text-xs">{caseData.is_public ? 'Shared' : 'Share'}</span>
            </button>
          )}

          {/* Overflow menu (3-dot) for Delete */}
          {canDelete && (
            <div className="relative">
              <button
                onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                className="p-2 bg-white rounded-lg shadow-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-gray-200"
                aria-label="More options"
                aria-expanded={showOverflowMenu}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>

              {/* Overflow Dropdown */}
              {showOverflowMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowOverflowMenu(false)} />
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-20 py-1">
                    <button
                      onClick={() => {
                        setShowOverflowMenu(false);
                        onDeleteClick();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Compact share URL bar (when public) - right aligned */}
      {caseData.is_public && caseData.public_slug && (
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-2 flex justify-end">
          <div className="bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <code className="text-xs text-green-700 font-mono truncate max-w-[200px] sm:max-w-none">
                {window.location.host}/c/{caseData.public_slug}
              </code>
              <button
                onClick={onCopyShareLink}
                className="px-2 py-0.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
              >
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Only people with this link can view
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
