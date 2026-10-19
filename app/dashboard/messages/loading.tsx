export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-gray-200/60 rounded-lg" />
      <div className="h-4 w-72 bg-gray-100/60 rounded-lg" />
      <div className="mt-6 workspace-glass-card rounded-3xl p-6 space-y-4">
        <div className="h-5 w-40 bg-gray-200/50 rounded" />
        <div className="h-4 w-full bg-gray-100/40 rounded" />
        <div className="h-4 w-3/4 bg-gray-100/40 rounded" />
        <div className="h-4 w-1/2 bg-gray-100/40 rounded" />
      </div>
    </div>
  )
}
