'use client'

import WorkspaceLayout from './WorkspaceLayout'

export default function CreatorWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceLayout role="creator">{children}</WorkspaceLayout>
}
