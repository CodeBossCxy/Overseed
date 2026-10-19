'use client'

import { usePathname } from 'next/navigation'
import WorkspaceLayout from './WorkspaceLayout'

export default function CreatorWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return <WorkspaceLayout role="creator"><div key={pathname} className="page-enter-animation">{children}</div></WorkspaceLayout>
}
