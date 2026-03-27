import { XCircle } from 'lucide-react'
import Link from 'next/link'

export default function PaymentErrorPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <XCircle className="w-16 h-16 text-danger mx-auto mb-6" />
      <h1 className="text-2xl font-bold mb-3">Platnosc nie powiodla sie</h1>
      <p className="text-muted mb-8">
        Nie udalo sie przetworzyc platnosci. Sprobuj ponownie lub skontaktuj sie z organizatorem.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/kalendarz" className="px-6 py-2.5 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors">
          Wróć do kalendarza
        </Link>
      </div>
    </div>
  )
}
