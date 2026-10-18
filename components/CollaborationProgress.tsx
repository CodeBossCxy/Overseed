'use client'

/**
 * Shared 5-stage collaboration progress tracker used across all outreach types
 * (discovery outreach, campaign pipeline outreach, mass outreach).
 *
 * Stages: Outreach → Response → Offer → Collaboration → Complete
 */

export type CollabStage = 'outreach' | 'response' | 'offer' | 'collaboration' | 'complete'
export type StageStatus = 'completed' | 'current' | 'pending' | 'failed'

interface StageDefinition {
  key: CollabStage
  label: { en: string; zh: string }
  description: { en: string; zh: string }
}

const STAGES: StageDefinition[] = [
  {
    key: 'outreach',
    label: { en: 'Outreach', zh: '触达' },
    description: { en: 'Prepare and send outreach to the creator', zh: '准备并向达人发送触达' },
  },
  {
    key: 'response',
    label: { en: 'Response', zh: '回复' },
    description: { en: 'Creator replies to your outreach', zh: '达人回复您的触达' },
  },
  {
    key: 'offer',
    label: { en: 'Offer', zh: '报价' },
    description: { en: 'Negotiate and finalize collaboration terms', zh: '协商并确定合作条款' },
  },
  {
    key: 'collaboration',
    label: { en: 'Collaboration', zh: '合作' },
    description: { en: 'Creator completes the deliverables', zh: '达人完成交付内容' },
  },
  {
    key: 'complete',
    label: { en: 'Complete', zh: '完成' },
    description: { en: 'Collaboration finished and payment released', zh: '合作完成并释放付款' },
  },
]

const STATUS_LABELS: Record<StageStatus, { en: string; zh: string }> = {
  completed: { en: 'Done', zh: '完成' },
  current: { en: 'Current', zh: '进行中' },
  pending: { en: 'Pending', zh: '待定' },
  failed: { en: 'Failed', zh: '失败' },
}

// Stage index: 0=outreach, 1=response, 2=offer, 3=collaboration, 4=complete
const STAGE_INDEX: Record<string, number> = {
  SHORTLISTED: 0,
  SENT: 0,
  FAILED: 0,
  AWAITING_RESPONSE: 1,
  RESPONDED: 1,
  DECLINED: 1,
  NEGOTIATING: 2,
  OFFER_ACCEPTED: 2,
  IN_PROGRESS: 3,
  COMPLETED: 4,
  CANCELLED: 0,
  // Legacy statuses (backwards-compat with existing data)
  PENDING_REVIEW: 0,
  READY_FOR_OUTREACH: 0,
  PENDING: 0,
  SENDING: 0,
  CONTACTED: 1,
  PENDING_RESPONSE: 1,
  INTERESTED: 1,
  DELIVERED: 1,
}

// Statuses that mean "done with this stage, moving to next"
const STAGE_COMPLETED: Set<string> = new Set([
  'SENT', 'AWAITING_RESPONSE', 'RESPONDED', 'NEGOTIATING',
  'OFFER_ACCEPTED', 'IN_PROGRESS', 'COMPLETED',
  // Legacy
  'CONTACTED', 'PENDING_RESPONSE', 'INTERESTED', 'DELIVERED',
])

const FAILED_STATUSES: Set<string> = new Set(['FAILED', 'CANCELLED', 'DECLINED'])

/**
 * Map any outreach status string to the 5-stage pipeline.
 * Returns an array of StageStatus for each of the 5 stages.
 */
export function mapStatusToStages(status: string): StageStatus[] {
  const s = status.toUpperCase().replace(/[\s-]/g, '_')
  const idx = STAGE_INDEX[s] ?? 0
  const isFailed = FAILED_STATUSES.has(s)

  return STAGES.map((_, i): StageStatus => {
    if (isFailed && i === idx) return 'failed'
    if (isFailed && i > idx) return 'pending'
    if (isFailed && i < idx) return 'completed'
    if (i < idx) return 'completed'
    if (i === idx) {
      // If the status indicates the stage is done (e.g. SENT completes outreach stage)
      return STAGE_COMPLETED.has(s) && i < 4 ? 'completed' : 'current'
    }
    // For the next stage after a completed one, mark as current
    if (i === idx + 1 && STAGE_COMPLETED.has(s)) return 'current'
    return 'pending'
  })
}

export default function CollaborationProgress({
  status,
  locale = 'en',
  compact = false,
}: {
  status: string
  locale?: string
  compact?: boolean
}) {
  const zh = locale === 'zh'
  const stages = mapStatusToStages(status)

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {STAGES.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
                stages[i] === 'completed'
                  ? 'bg-primary-600 text-white'
                  : stages[i] === 'current'
                    ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-300'
                    : stages[i] === 'failed'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-gray-100 text-gray-400'
              }`}
              title={zh ? stage.label.zh : stage.label.en}
            >
              {stages[i] === 'completed' ? '✓' : i + 1}
            </div>
            {i < STAGES.length - 1 && (
              <div className={`w-4 h-0.5 ${stages[i] === 'completed' ? 'bg-primary-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-primary-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </span>
        <h3 className="font-bold text-sm text-gray-900">
          {zh ? '合作进度' : 'Collaboration Progress'}
        </h3>
      </div>

      {STAGES.map((stage, i) => {
        const stageStatus = stages[i]
        const isLast = i === STAGES.length - 1

        return (
          <div key={stage.key} className="flex gap-3">
            {/* Left: circle + line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                  stageStatus === 'completed'
                    ? 'bg-primary-600 text-white'
                    : stageStatus === 'current'
                      ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-400'
                      : stageStatus === 'failed'
                        ? 'bg-red-100 text-red-600 ring-2 ring-red-300'
                        : 'bg-gray-100 text-gray-400'
                }`}
              >
                {stageStatus === 'completed' ? '✓' : i + 1}
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[24px] ${stageStatus === 'completed' ? 'bg-primary-300' : 'bg-gray-200'}`} />
              )}
            </div>

            {/* Right: label + description + badge */}
            <div className={`flex-1 pb-5 ${isLast ? 'pb-0' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-bold ${stageStatus === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>
                    {zh ? stage.label.zh : stage.label.en}
                  </p>
                  <p className={`text-xs mt-0.5 ${stageStatus === 'pending' ? 'text-gray-300' : 'text-gray-500'}`}>
                    {zh ? stage.description.zh : stage.description.en}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0 ${
                    stageStatus === 'completed'
                      ? 'bg-primary-50 text-primary-700'
                      : stageStatus === 'current'
                        ? 'bg-primary-100 text-primary-700'
                        : stageStatus === 'failed'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {zh ? STATUS_LABELS[stageStatus].zh : STATUS_LABELS[stageStatus].en}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
