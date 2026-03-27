import { CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function PaymentSuccessPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <CheckCircle className="w-16 h-16 text-success mx-auto mb-6" />
      <h1 className="text-2xl font-bold mb-3">Platnosc zakonczona pomyslnie!</h1>
      <p className="text-muted mb-8">
        Twoja oplata startowa zostala zaksiegowana. Potwierdzenie wyslemy na Twoj adres email.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/kalendarz" className="px-6 py-2.5 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors">
          Kalendarz
        </Link>
        <Link href="/profil" className="px-6 py-2.5 border border-border text-foreground font-semibold rounded-lg hover:bg-card-hover transition-colors">
          Moj profil
        </Link>
      </div>
    </div>
  )
}
