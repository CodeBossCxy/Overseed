'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

interface ImageCropModalProps {
  /** Object URL or data URL of the selected image */
  imageSrc: string
  /** 'round' for avatars, 'rect' for logos */
  cropShape?: 'round' | 'rect'
  /** Output size in px (square) */
  outputSize?: number
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

async function cropToBlob(imageSrc: string, area: Area, outputSize: number): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to crop image'))), 'image/jpeg', 0.92)
  })
}

export default function ImageCropModal({
  imageSrc,
  cropShape = 'round',
  outputSize = 512,
  title = 'Adjust your photo',
  confirmLabel = 'Apply',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels)
  }, [])

  const confirm = async () => {
    if (!croppedArea) return
    setProcessing(true)
    try {
      const blob = await cropToBlob(imageSrc, croppedArea, outputSize)
      onConfirm(blob)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">Drag to reposition, use the slider to zoom</p>
        </div>
        <div className="relative w-full h-72 bg-gray-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="px-5 py-4 space-y-4">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary-600"
            aria-label="Zoom"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-xl transition disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={confirm}
              disabled={processing || !croppedArea}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition disabled:opacity-50"
            >
              {processing ? '…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
