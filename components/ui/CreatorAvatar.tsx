'use client'

import { useState, useEffect } from 'react'

interface CreatorAvatarProps {
  url: string | null | undefined
  name: string
  size?: string
  textSize?: string
  className?: string
}

export default function CreatorAvatar({
  url,
  name,
  size = 'w-10 h-10',
  textSize = 'text-sm',
  className = '',
}: CreatorAvatarProps) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])

  const initial = (name || '?').charAt(0).toUpperCase()

  return (
    <div className={`${size} rounded-full bg-gray-200 overflow-hidden flex-shrink-0 ${className}`}>
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200 text-primary-600 font-bold ${textSize}`}>
          {initial}
        </div>
      )}
    </div>
  )
}
