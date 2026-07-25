'use client'

import StatusBadge from '@/components/StatusBadge'

interface ApplicationStatusProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
}

// Thin wrapper kept for existing call sites; labels + tone now come from the
// canonical status machine (spec labels: Applied / Selected / Not Selected / …).
export default function ApplicationStatus({ status, size = 'md' }: ApplicationStatusProps) {
  return <StatusBadge machine="application" status={status} size={size} dot />
}
