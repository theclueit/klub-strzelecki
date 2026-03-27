import { Code, Globe, Smartphone, Server } from 'lucide-react'
import Link from 'next/link'

export default function ClueItPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Clue IT</h1>
        <p className="text-lg text-muted max-w-xl mx-auto">
          Tworzymy nowoczesne rozwiązania IT dla organizacji sportowych, klubów i stowarzyszeń.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-12">
        {[
          { icon: Globe, title: 'Portale klubowe', desc: 'Zarządzanie członkami, wydarzeniami, wynikami i rankingami w jednym miejscu.' },
          { icon: Smartphone, title: 'Aplikacje mobilne', desc: 'Natywne aplikacje dla zawodników i sędziów z dostępem do danych w terenie.' },
          { icon: Server, title: 'Systemy backendowe', desc: 'Bezpieczna infrastruktura, integracje z systemami płatności i federacjami.' },
          { icon: Code, title: 'Rozwiązania na miarę', desc: 'Dedykowane systemy dopasowane do specyfiki Twojej organizacji.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-card border border-border rounded-xl p-6">
            <Icon className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-sm text-muted">{desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Zainteresowany współpracą?</h2>
        <p className="text-muted mb-4">Skontaktuj się z nami — chętnie porozmawiamy o Twoim projekcie.</p>
        <a
          href="mailto:kontakt@clueit.pl"
          className="inline-block px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors"
        >
          kontakt@clueit.pl
        </a>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          &larr; Wróć na stronę główną
        </Link>
      </div>
    </div>
  )
}
