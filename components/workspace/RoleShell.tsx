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
    return (
      <div className="min-h-screen ws-themed-bg flex">
        {/* Sidebar placeholder */}
        <div className="hidden sm:block w-[72px] flex-shrink-0" />
        <div className="flex-1 px-4 sm:px-8 pt-20 pb-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-gray-200/40 rounded-lg" />
            <div className="h-4 w-72 bg-gray-100/40 rounded-lg" />
            <div className="mt-6 rounded-3xl bg-white/20 p-6 space-y-4">
              <div className="h-5 w-40 bg-gray-200/30 rounded" />
              <div className="h-4 w-full bg-gray-100/30 rounded" />
              <div className="h-4 w-3/4 bg-gray-100/30 rounded" />
            </div>
          </div>
        </div>
      </div>
    )
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
