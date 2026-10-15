'use client'

import WorkspaceLayout from './WorkspaceLayout'

export default function BrandWorkspaceLayout({ children, topBarLeft }: { children: React.ReactNode; topBarLeft?: React.ReactNode }) {
  return <WorkspaceLayout role="brand" topBarLeft={topBarLeft}>{children}</WorkspaceLayout>
}
