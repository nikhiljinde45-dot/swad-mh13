import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Alert, Button, Sheet, Spinner } from './kit'
import { ApiError, api, type PaymentQr } from '../lib/api'
import { inr } from '../lib/format'

/**
 * Shows the UPI payment QR for one order. The UPI string (payee + amount) is
 * built on the server from the stored order total, so the amount shown here is
 * always the real amount due.
 */
export function PaymentSheet({
  open,
  orderId,
  onClose,
  allowClaim = false,
  onPaid,
}: {
  open: boolean
  orderId: string | null
  onClose: () => void
  allowClaim?: boolean
  onPaid?: () => void
}) {
  const [data, setData] = useState<PaymentQr | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open || !orderId) return
    let cancelled = false
    setData(null)
    setQr(null)
    setError(null)
    setCopied(false)

    api
      .paymentQr(orderId)
      .then(async (result) => {
        if (cancelled) return
        setData(result)
        if (result.upi_string) {
          try {
            const image = await QRCode.toDataURL(result.upi_string, { width: 420, margin: 1 })
            if (!cancelled) setQr(image)
          } catch {
            if (!cancelled) setError('Could not draw the QR code — use the UPI ID below.')
          }
        }
      })
      .catch((cause) => {
        if (cancelled) return
        setError(cause instanceof ApiError ? cause.message : 'Could not load the payment details.')
      })

    return () => {
      cancelled = true
    }
  }, [open, orderId])

  const claim = async () => {
    if (!orderId) return
    setClaiming(true)
    setError(null)
    try {
      await api.claimPayment(orderId)
      setData((current) => (current ? { ...current, payment_status: 'paid' } : current))
      onPaid?.()
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not record the payment.')
    } finally {
      setClaiming(false)
    }
  }

  const copyUpi = async () => {
    if (!data?.upi_vpa) return
    try {
      await navigator.clipboard.writeText(data.upi_vpa)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const paid = data?.payment_status === 'paid'

  return (
    <Sheet open={open} onClose={onClose} title={allowClaim ? 'Pay for your order' : 'Payment QR'}>
      <div className="space-y-3">
        {error && <Alert tone={error.toLowerCase().includes('not configured') ? 'warning' : 'error'}>{error}</Alert>}
        {!data && !error && <Spinner label="Loading payment details…" />}

        {data && (
          <>
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-white">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Amount to pay</p>
              <p className="text-3xl font-extrabold">{inr(data.amount)}</p>
              <p className="text-[11px] text-slate-400">{data.reference}</p>
            </div>

            {paid ? (
              <Alert tone="success">Payment recorded as paid for this order.</Alert>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                  {data.qr_image_url ? (
                    <img
                      src={data.qr_image_url}
                      alt="Scan to pay with UPI"
                      className="h-56 w-56 rounded-xl object-contain"
                    />
                  ) : qr ? (
                    <img src={qr} alt="Scan to pay with UPI" className="h-56 w-56" />
                  ) : (
                    <Spinner label="Preparing QR…" />
                  )}
                  <p className="text-center text-[11px] leading-relaxed text-slate-500">
                    Scan with any UPI app (GPay, PhonePe, Paytm) and pay {inr(data.amount)}.
                  </p>
                </div>

                {data.upi_vpa && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">UPI ID</p>
                      <p className="truncate text-sm font-bold text-slate-900">{data.upi_vpa}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={copyUpi}>
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                )}

                {data.upi_string && (
                  <a
                    href={data.upi_string}
                    className="block rounded-xl bg-orange-600 px-4 py-2.5 text-center text-sm font-bold text-white"
                  >
                    Open in UPI app
                  </a>
                )}

                {allowClaim && data.payment_method === 'online' ? (
                  <Button full loading={claiming} onClick={claim}>
                    I have paid {inr(data.amount)}
                  </Button>
                ) : (
                  <p className="text-center text-[11px] text-slate-500">
                    {allowClaim
                      ? 'Pay the rider with this QR when the order arrives.'
                      : 'Show this QR to the customer and collect the exact amount.'}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
