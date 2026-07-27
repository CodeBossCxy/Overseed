'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function CheckoutForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useLanguage()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsProcessing(true)
    setError(null)

    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (result.error) {
      setError(result.error.message || 'Payment failed')
      setIsProcessing(false)
    } else if (result.paymentIntent?.status === 'succeeded') {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
      )}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
        >
          {t.payments?.cancel || 'Cancel'}
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
        >
          {isProcessing ? (t.payments?.processing || 'Processing...') : (t.payments?.payNow || 'Pay Now')}
        </button>
      </div>
    </form>
  )
}

interface PaymentModalProps {
  clientSecret: string
  amount: number
  platformFee: number
  creatorPayout: number
  onSuccess: () => void
  onCancel: () => void
}

export default function PaymentModal({
  clientSecret,
  amount,
  platformFee,
  creatorPayout,
  onSuccess,
  onCancel,
}: PaymentModalProps) {
  const { t } = useLanguage()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div data-solid className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold mb-1">{t.payments?.fundTitle || 'Fund Campaign Payment'}</h2>
        <p className="text-sm text-gray-500 mb-5">
          {t.payments?.fundDesc || 'Funds will be held securely until you release them after the work is completed.'}
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{t.payments?.totalAmount || 'Total Amount'}</span>
            <span className="font-semibold">${amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t.payments?.platformFee || 'Platform Fee'}</span>
            <span className="text-gray-600">-${platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="text-gray-500">{t.payments?.creatorReceives || 'Creator Receives'}</span>
            <span className="font-semibold text-emerald-600">${creatorPayout.toFixed(2)}</span>
          </div>
        </div>

        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} />
        </Elements>
      </div>
    </div>
  )
}
