'use client'

import { useSession } from 'next-auth/react'
import { useViewMode } from '@/lib/hooks/useViewMode'
import MainLayout from '@/components/MainLayout'
import CreatorWorkspaceLayout from './CreatorWorkspaceLayout'
import BrandWorkspaceLayout from './BrandWorkspaceLayout'

// Role-aware page shell: signed-in users keep their workspace sidebar
// (creator or brand) on every page; logged-out visitors get the public
// header layout. Use this on pages reachable both in-app and publicly.
export default function RoleShell({
  children,
  noFooter,
  topBarLeft,
}: {
  children: React.ReactNode
  noFooter?: boolean
  topBarLeft?: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const { isBrand } = useViewMode()

  if (status === 'loading') {
    return <div className="min-h-screen ws-themed-bg" />
  }
  if (!session?.user) {
    return <MainLayout noFooter={noFooter}>{children}</MainLayout>
  }
  return isBrand ? (
    <BrandWorkspaceLayout topBarLeft={topBarLeft}>{children}</BrandWorkspaceLayout>
  ) : (
    <CreatorWorkspaceLayout>{children}</CreatorWorkspaceLayout>
  )
}
