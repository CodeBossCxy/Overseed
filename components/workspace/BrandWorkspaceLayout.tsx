'use client'

import { usePathname } from 'next/navigation'
import WorkspaceLayout from './WorkspaceLayout'

export default function BrandWorkspaceLayout({ children, topBarLeft }: { children: React.ReactNode; topBarLeft?: React.ReactNode }) {
  const pathname = usePathname()
  return <WorkspaceLayout role="brand" topBarLeft={topBarLeft}><div key={pathname} className="page-enter-animation flex flex-col min-h-full">{children}</div></WorkspaceLayout>
}
