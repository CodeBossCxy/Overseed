'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

interface ApplicationStatusProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
}

export default function ApplicationStatus({ status, size = 'md' }: ApplicationStatusProps) {
  const { t } = useLanguage()

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          label: t.applications.status.pending,
          color: 'bg-yellow-100 text-yellow-800',
          icon: '⏳',
        }
      case 'UNDER_REVIEW':
        return {
          label: t.applications.status.underReview,
          color: 'bg-blue-100 text-blue-800',
          icon: '👀',
        }
      case 'APPROVED':
        return {
          label: t.applications.status.approved,
          color: 'bg-green-100 text-green-800',
          icon: '✓',
        }
      case 'REJECTED':
        return {
          label: t.applications.status.rejected,
          color: 'bg-red-100 text-red-800',
          icon: '✗',
        }
      case 'WITHDRAWN':
        return {
          label: t.applications.status.withdrawn,
          color: 'bg-gray-100 text-gray-800',
          icon: '↩',
        }
      case 'COMPLETED':
        return {
          label: t.applications.status.completed,
          color: 'bg-purple-100 text-purple-800',
          icon: '★',
        }
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800',
          icon: '•',
        }
    }
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const config = getStatusConfig(status)

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${config.color} ${sizeClasses[size]}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}
