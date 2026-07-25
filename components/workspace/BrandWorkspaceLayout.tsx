'use client'

import WorkspaceLayout from './WorkspaceLayout'

export default function BrandWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceLayout role="brand">{children}</WorkspaceLayout>
}
