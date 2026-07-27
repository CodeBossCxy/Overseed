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
}: {
  children: React.ReactNode
  noFooter?: boolean
}) {
  const { data: session, status } = useSession()
  const { isBrand } = useViewMode()

  if (status === 'loading') {
    // Avoid a public-header flash while the session resolves
    return <div className="min-h-screen ws-themed-bg" />
  }
  if (!session?.user) {
    return <MainLayout noFooter={noFooter}>{children}</MainLayout>
  }
  return isBrand ? (
    <BrandWorkspaceLayout>{children}</BrandWorkspaceLayout>
  ) : (
    <CreatorWorkspaceLayout>{children}</CreatorWorkspaceLayout>
  )
}
