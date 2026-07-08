'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface ApplicationActionsProps {
  applicationId: string
  currentStatus: string
  onStatusChange: (newStatus: string) => void
}

export default function ApplicationActions({
  applicationId,
  currentStatus,
  onStatusChange,
}: ApplicationActionsProps) {
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [brandNotes, setBrandNotes] = useState('')

  const updateStatus = async (status: string, additionalData?: any) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...additionalData,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update application')
      }

      onStatusChange(status)
      setShowRejectModal(false)
    } catch (error) {
      console.error('Error updating application:', error)
      alert(t.applications.actions.updateFailed)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = () => {
    if (confirm(t.applications.actions.confirmApprove)) {
      updateStatus('APPROVED')
    }
  }

  const handleReject = () => {
    setShowRejectModal(true)
  }

  const submitRejection = () => {
    updateStatus('REJECTED', {
      rejectionReason,
      brandNotes,
    })
  }

  const handleMarkUnderReview = () => {
    updateStatus('UNDER_REVIEW')
  }

  const handleMarkComplete = () => {
    if (confirm(t.applications.actions.confirmComplete)) {
      updateStatus('COMPLETED')
    }
  }

  // Different actions based on current status
  const renderActions = () => {
    switch (currentStatus) {
      case 'PENDING':
        return (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleMarkUnderReview}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              {t.applications.actions.markUnderReview}
            </button>
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
            >
              {t.applications.actions.approve}
            </button>
            <button
              onClick={handleReject}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
            >
              {t.applications.actions.reject}
            </button>
          </div>
        )

      case 'UNDER_REVIEW':
        return (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50"
            >
              {t.applications.actions.approve}
            </button>
            <button
              onClick={handleReject}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
            >
              {t.applications.actions.reject}
            </button>
          </div>
        )

      case 'APPROVED':
        return (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleMarkComplete}
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50"
            >
              {t.applications.actions.markComplete}
            </button>
          </div>
        )

      case 'REJECTED':
      case 'WITHDRAWN':
      case 'COMPLETED':
        return (
          <p className="text-gray-500 text-sm">
            {t.applications.actions.noActions}
          </p>
        )

      default:
        return null
    }
  }

  return (
    <div>
      {renderActions()}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">{t.applications.actions.rejectModalTitle}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t.applications.actions.rejectionReasonLabel}
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  placeholder={t.applications.actions.rejectionReasonPlaceholder}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t.applications.actions.internalNotesLabel}
                </label>
                <textarea
                  rows={2}
                  value={brandNotes}
                  onChange={(e) => setBrandNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  placeholder={t.applications.actions.internalNotesPlaceholder}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition"
              >
                {t.applications.actions.cancel}
              </button>
              <button
                onClick={submitRejection}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
              >
                {isLoading ? t.applications.actions.rejecting : t.applications.actions.reject}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
