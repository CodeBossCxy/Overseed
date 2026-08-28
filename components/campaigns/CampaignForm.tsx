'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import LocaleDateInput from '@/components/LocaleDateInput'

interface Category {
  id: number
  name: string
  slug: string
}

interface Platform {
  id: number
  name: string
  slug: string
}

interface CampaignFormProps {
  categories: Category[]
  platforms: Platform[]
  initialData?: any
  isEditing?: boolean
}

export default function CampaignForm({
  categories,
  platforms,
  initialData,
  isEditing = false,
}: CampaignFormProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const cf = t.campaignForm
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1)

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    status: initialData?.status || 'DRAFT',
    deadline: initialData?.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : '',
    campaignStartDate: initialData?.campaignStartDate ? new Date(initialData.campaignStartDate).toISOString().split('T')[0] : '',
    campaignEndDate: initialData?.campaignEndDate ? new Date(initialData.campaignEndDate).toISOString().split('T')[0] : '',
    totalSlots: initialData?.totalSlots || 10,
    compensationType: initialData?.compensationType || 'PAID',
    paymentMin: initialData?.paymentMin || '',
    paymentMax: initialData?.paymentMax || '',
    giftDescription: initialData?.giftDescription || '',
    giftValue: initialData?.giftValue || '',
    requiresProductPurchase: initialData?.requiresProductPurchase || false,
    productPurchaseAmount: initialData?.productPurchaseAmount || '',
    isProductReimbursed: initialData?.isProductReimbursed || false,
    contentType: initialData?.contentType || 'ANY',
    contentGuidelines: initialData?.contentGuidelines || '',
    wordCountMin: initialData?.wordCountMin || '',
    wordCountMax: initialData?.wordCountMax || '',
    hashtagsRequired: initialData?.hashtagsRequired || '',
    mentionsRequired: initialData?.mentionsRequired || '',
    categoryIds: initialData?.categories?.map((c: any) => c.category.id) || [],
    platformIds: initialData?.platforms?.map((p: any) => p.platform.id) || [],
    followerRequirements: initialData?.followerRequirements?.map((r: any) => ({
      platformId: r.platform.id,
      minFollowers: r.minFollowers,
      maxFollowers: r.maxFollowers,
    })) || [],
    images: initialData?.images || [],
  })

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Validate required fields when publishing (not drafts)
    if (!asDraft) {
      const missing: string[] = []
      // Step 1
      if (!formData.title.trim()) missing.push(cf.campaignTitle)
      if (!formData.description.trim()) missing.push(cf.description)
      if (formData.categoryIds.length === 0) missing.push(cf.categories)
      if (!formData.deadline) missing.push(cf.applicationDeadline)
      if (!formData.campaignStartDate) missing.push(cf.campaignStartDate)
      if (!formData.campaignEndDate) missing.push(cf.campaignEndDate)
      if (formData.images.length === 0) missing.push(cf.campaignImages)
      // Step 2
      if (['PAID', 'PAID_PLUS_GIFT', 'NEGOTIABLE'].includes(formData.compensationType)) {
        if (!formData.paymentMin) missing.push(cf.paymentMin)
        if (!formData.paymentMax) missing.push(cf.paymentMax)
      }
      if (['GIFTED', 'PAID_PLUS_GIFT'].includes(formData.compensationType)) {
        if (!formData.giftDescription.trim()) missing.push(cf.giftDescription)
        if (!formData.giftValue) missing.push(cf.giftValue)
      }
      // Step 3
      if (formData.platformIds.length === 0) missing.push(cf.targetPlatforms)
      if (!formData.contentGuidelines.trim()) missing.push(cf.contentGuidelines)
      if (missing.length > 0) {
        setError(`${cf.requiredFields}: ${missing.join(', ')}`)
        setIsSubmitting(false)
        return
      }
    }

    try {
      const submitData = {
        ...formData,
        status: asDraft ? 'DRAFT' : 'ACTIVE',
        paymentMin: formData.paymentMin ? parseFloat(formData.paymentMin) : null,
        paymentMax: formData.paymentMax ? parseFloat(formData.paymentMax) : null,
        giftValue: formData.giftValue ? parseFloat(formData.giftValue) : null,
        productPurchaseAmount: formData.productPurchaseAmount ? parseFloat(formData.productPurchaseAmount) : null,
        wordCountMin: formData.wordCountMin ? parseInt(formData.wordCountMin) : null,
        wordCountMax: formData.wordCountMax ? parseInt(formData.wordCountMax) : null,
        deadline: formData.deadline || null,
        campaignStartDate: formData.campaignStartDate || null,
        campaignEndDate: formData.campaignEndDate || null,
        followerRequirements: formData.followerRequirements.map((r: any) => ({
          ...r,
          minFollowers: parseInt(r.minFollowers) || 0,
        })),
      }

      const url = isEditing ? `/api/campaigns/${initialData.id}` : '/api/campaigns'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || cf.failedToSave)
      }

      const campaign = await response.json()
      router.push(asDraft ? '/dashboard/brand/campaigns' : `/dashboard/brand/campaigns/${campaign.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Image upload state ──
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return

    // Client-side validation
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const maxSize = 5 * 1024 * 1024
    const maxTotal = 8

    const remaining = maxTotal - formData.images.length
    if (remaining <= 0) {
      setUploadError(cf.maxImages)
      return
    }

    const filesToUpload = files.slice(0, remaining)

    for (const f of filesToUpload) {
      if (!allowed.includes(f.type)) {
        setUploadError(`"${f.name}" ${cf.unsupportedType}`)
        return
      }
      if (f.size > maxSize) {
        setUploadError(`"${f.name}" ${cf.fileTooLarge}`)
        return
      }
    }

    setUploadError(null)
    setIsUploading(true)

    try {
      const body = new FormData()
      filesToUpload.forEach((f) => body.append('files', f))

      const res = await fetch('/api/upload', { method: 'POST', body })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      const { urls } = await res.json()
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...urls] }))
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      uploadFiles(Array.from(e.target.files))
      e.target.value = '' // reset so same file can be re-selected
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files) {
        uploadFiles(Array.from(e.dataTransfer.files))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formData.images.length]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_: string, i: number) => i !== index),
    }))
  }

  const handleCategoryToggle = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((cid: number) => cid !== id)
        : [...prev.categoryIds, id],
    }))
  }

  const handlePlatformToggle = (id: number) => {
    setFormData((prev) => {
      const newPlatformIds = prev.platformIds.includes(id)
        ? prev.platformIds.filter((pid: number) => pid !== id)
        : [...prev.platformIds, id]

      // Update follower requirements to match selected platforms
      const newRequirements = newPlatformIds.map((pid: number) => {
        const existing = prev.followerRequirements.find((r: any) => r.platformId === pid)
        return existing || { platformId: pid, minFollowers: 0, maxFollowers: null }
      })

      return {
        ...prev,
        platformIds: newPlatformIds,
        followerRequirements: newRequirements,
      }
    })
  }

  const updateFollowerRequirement = (platformId: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      followerRequirements: prev.followerRequirements.map((r: any) =>
        r.platformId === platformId ? { ...r, [field]: value } : r
      ),
    }))
  }

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{cf.basicInfo}</h2>

      <div>
        <label className="block text-sm font-medium mb-1">{cf.campaignTitle} *</label>
        <input
          type="text"
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          placeholder={cf.campaignTitlePlaceholder}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{cf.description} *</label>
        <textarea
          rows={6}
          required
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          placeholder={cf.descriptionPlaceholder}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">{cf.categories} *</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryToggle(cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm transition ${
                formData.categoryIds.includes(cat.id)
                  ? 'bg-white text-gray-900 font-bold shadow-sm ring-1 ring-gray-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t.categoryNames[cat.name] || cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{cf.applicationDeadline} *</label>
          <LocaleDateInput
            required
            value={formData.deadline}
            onChange={(v) => setFormData({ ...formData, deadline: v })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{cf.numberOfSpots} *</label>
          <input
            type="number"
            min="1"
            required
            value={formData.totalSlots}
            onChange={(e) => setFormData({ ...formData, totalSlots: parseInt(e.target.value) || 1 })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{cf.campaignStartDate} *</label>
          <LocaleDateInput
            required
            value={formData.campaignStartDate}
            onChange={(v) => setFormData({ ...formData, campaignStartDate: v })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{cf.campaignEndDate} *</label>
          <LocaleDateInput
            required
            value={formData.campaignEndDate}
            onChange={(v) => setFormData({ ...formData, campaignEndDate: v })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Campaign Images */}
      <div>
        <label className="block text-sm font-medium mb-2">{cf.campaignImages} *</label>
        <p className="text-sm text-gray-500 mb-3">{cf.campaignImagesDesc}</p>

        {/* Upload error */}
        {uploadError && (
          <div className="mb-3 p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {uploadError}
          </div>
        )}

        {/* Image Preview Grid */}
        {formData.images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {formData.images.map((url: string, index: number) => (
              <div key={index} className="relative group aspect-square">
                <img
                  src={url}
                  alt={`Campaign image ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-sm"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Drop zone + file picker */}
        {formData.images.length < 8 && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
              isDragging
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-primary-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-gray-500">{cf.uploading}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M2 16.5V18a2 2 0 002 2h16a2 2 0 002-2v-1.5M6 12l-2 2M18 12l2 2" />
                </svg>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-primary-600">{cf.clickToUpload}</span> {cf.orDragDrop}
                </p>
                <p className="text-xs text-gray-400">
                  {formData.images.length}/8 {cf.imagesAdded}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{cf.compensation}</h2>

      <div>
        <label className="block text-sm font-medium mb-2">{cf.compensationType} *</label>
        <div className="space-y-2">
          {[
            { value: 'PAID', label: cf.paid, desc: cf.paidDesc },
            { value: 'GIFTED', label: cf.gifted, desc: cf.giftedDesc },
            { value: 'PAID_PLUS_GIFT', label: cf.paidPlusGift, desc: cf.paidPlusGiftDesc },
            { value: 'AFFILIATE', label: cf.affiliate, desc: cf.affiliateDesc },
            { value: 'NEGOTIABLE', label: cf.negotiable, desc: cf.negotiableDesc },
          ].map((option) => (
            <label key={option.value} className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="compensationType"
                value={option.value}
                checked={formData.compensationType === option.value}
                onChange={(e) => setFormData({ ...formData, compensationType: e.target.value })}
                className="mt-1"
              />
              <div>
                <span className="font-medium">{option.label}</span>
                <p className="text-sm text-gray-500">{option.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {['PAID', 'PAID_PLUS_GIFT', 'NEGOTIABLE'].includes(formData.compensationType) && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{cf.paymentMin} *</label>
            <input
              type="number"
              min="0"
              required
              value={formData.paymentMin}
              onChange={(e) => setFormData({ ...formData, paymentMin: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{cf.paymentMax} *</label>
            <input
              type="number"
              min="0"
              required
              value={formData.paymentMax}
              onChange={(e) => setFormData({ ...formData, paymentMax: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              placeholder="0"
            />
          </div>
        </div>
      )}

      {['GIFTED', 'PAID_PLUS_GIFT'].includes(formData.compensationType) && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{cf.giftDescription} *</label>
            <input
              type="text"
              required
              value={formData.giftDescription}
              onChange={(e) => setFormData({ ...formData, giftDescription: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              placeholder={cf.giftDescPlaceholder}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{cf.giftValue} *</label>
            <input
              type="number"
              min="0"
              required
              value={formData.giftValue}
              onChange={(e) => setFormData({ ...formData, giftValue: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              placeholder="0"
            />
          </div>
        </div>
      )}

      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.requiresProductPurchase}
            onChange={(e) => setFormData({ ...formData, requiresProductPurchase: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm font-medium">{cf.requiresProductPurchase}</span>
        </label>
        {formData.requiresProductPurchase && (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">{cf.purchaseAmount}</label>
              <input
                type="number"
                min="0"
                value={formData.productPurchaseAmount}
                onChange={(e) => setFormData({ ...formData, productPurchaseAmount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isProductReimbursed}
                onChange={(e) => setFormData({ ...formData, isProductReimbursed: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">{cf.purchaseReimbursed}</span>
            </label>
          </>
        )}
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{cf.platformRequirements}</h2>

      <div>
        <label className="block text-sm font-medium mb-2">{cf.targetPlatforms} *</label>
        <div className="flex flex-wrap gap-2">
          {platforms.map((plat) => (
            <button
              key={plat.id}
              type="button"
              onClick={() => handlePlatformToggle(plat.id)}
              className={`px-4 py-2 rounded-md text-sm transition ${
                formData.platformIds.includes(plat.id)
                  ? 'bg-white text-gray-900 font-bold shadow-sm ring-1 ring-gray-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {plat.name}
            </button>
          ))}
        </div>
      </div>

      {formData.followerRequirements.length > 0 && (
        <div className="space-y-4">
          <label className="block text-sm font-medium">{cf.followerRequirements}</label>
          {formData.followerRequirements.map((req: any) => {
            const platform = platforms.find((p) => p.id === req.platformId)
            return (
              <div key={req.platformId} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <span className="w-24 font-medium">{platform?.name}</span>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{cf.minFollowers}</label>
                    <input
                      type="number"
                      min="0"
                      value={req.minFollowers}
                      onChange={(e) => updateFollowerRequirement(req.platformId, 'minFollowers', e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{cf.maxFollowersOptional}</label>
                    <input
                      type="number"
                      min="0"
                      value={req.maxFollowers || ''}
                      onChange={(e) => updateFollowerRequirement(req.platformId, 'maxFollowers', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                      placeholder={cf.noLimit}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">{cf.contentType} *</label>
        <select
          required
          value={formData.contentType}
          onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
        >
          <option value="ANY">{cf.anyFormat}</option>
          <option value="IMAGE_POST">{cf.imagePost}</option>
          <option value="VIDEO">{cf.video}</option>
          <option value="STORY">{cf.story}</option>
          <option value="REEL">{cf.reel}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{cf.contentGuidelines} *</label>
        <textarea
          rows={4}
          required
          value={formData.contentGuidelines}
          onChange={(e) => setFormData({ ...formData, contentGuidelines: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
          placeholder={cf.contentGuidelinesPlaceholder}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{cf.requiredHashtags}</label>
          <input
            type="text"
            required
            value={formData.hashtagsRequired}
            onChange={(e) => setFormData({ ...formData, hashtagsRequired: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
            placeholder={cf.hashtagsPlaceholder}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{cf.requiredMentions}</label>
          <input
            type="text"
            required
            value={formData.mentionsRequired}
            onChange={(e) => setFormData({ ...formData, mentionsRequired: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
            placeholder={cf.mentionsPlaceholder}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{cf.minWordCount}</label>
          <input
            type="number"
            min="0"
            value={formData.wordCountMin}
            onChange={(e) => setFormData({ ...formData, wordCountMin: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
            placeholder={cf.noMinimum}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{cf.maxWordCount}</label>
          <input
            type="number"
            min="0"
            value={formData.wordCountMax}
            onChange={(e) => setFormData({ ...formData, wordCountMax: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
            placeholder={cf.noMaximum}
          />
        </div>
      </div>
    </div>
  )

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-start">
          {[
            { s: 1, label: cf.stepBasicInfo },
            { s: 2, label: cf.stepCompensation },
            { s: 3, label: cf.stepRequirements },
          ].map(({ s, label }) => (
            <div key={s} className="contents">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(s)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition ${
                    step === s
                      ? 'bg-white text-gray-900 font-bold shadow-sm ring-1 ring-gray-300'
                      : step > s
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step > s ? '✓' : s}
                </button>
                <span className="text-sm text-gray-600 whitespace-nowrap">{label}</span>
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 mt-[18px] ${step > s ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Form Steps */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              {cf.back}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={isSubmitting}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
          >
            {cf.saveAsDraft}
          </button>
          {step < 3 ? (
            <button
              key="next"
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition"
            >
              {cf.next}
            </button>
          ) : (
            <button
              key="submit"
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition disabled:opacity-50"
            >
              {isSubmitting ? cf.saving : isEditing ? cf.updateCampaign : cf.submitForReview}
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
