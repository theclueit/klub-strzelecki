import { Code, Globe, Smartphone, Server } from 'lucide-react'
import Link from 'next/link'
import FeedbackForm from './FeedbackForm'

const CHANGELOG = [
  {
    version: '1.5.0',
    date: '2026-03-27',
    changes: [
      'Formularz zgłaszania uwag i propozycji rozwoju',
      'Informacja o wersji i historia zmian',
      'Integracja płatności Przelewy24 (sandbox)',
      'Wyszukiwanie osób w wynikach zawodów',
      'Pełny CRUD magazynu z historią transakcji',
      'Podgląd zalogowanych użytkowników w panelu admina',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-03-20',
    changes: [
      'Drukowanie numerów startowych',
      'Skaner QR i szybkie wyszukiwanie w panelu sędziego',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-03-15',
    changes: [
      'Zdjęcia tarczy: blokowanie per zawody, wyświetlanie w profilu',
      'Analiza tarcz z użyciem AI',
      'Rola rejestratora i automatyczne rankingi',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-03-10',
    changes: [
      'Rejestracja gości na miejscu w panelu admina',
      'Regulaminy pobierane z bazy danych',
      'Panel sędziego z logowaniem PINem',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-05',
    changes: [
      'Walidacja zapisów po stronie serwera',
      'Potwierdzenia email przy rejestracji',
      'Rozbudowa panelu admina',
      'Resetowanie hasła i profil użytkownika',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-02-20',
    changes: [
      'System rejestracji i logowania',
      'Panel administracyjny: zawody, dyscypliny, sędziowie',
      'Zapisy na zawody (członkowie i goście)',
      'Sloty godzinowe i rankingi',
      'Panel sędziego z potwierdzaniem wyników',
    ],
  },
]

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

      {/* Formularz zgłaszania uwag */}
      <div className="bg-card border border-border rounded-xl p-8 mb-8">
        <h2 className="text-xl font-bold mb-2">Zgłoś uwagę lub propozycję</h2>
        <p className="text-muted mb-6 text-sm">
          Masz pomysł na usprawnienie? Znalazłeś błąd? Daj nam znać — każde zgłoszenie trafia bezpośrednio do naszego systemu zadań.
        </p>
        <FeedbackForm />
      </div>

      {/* Historia wersji */}
      <div className="bg-card border border-border rounded-xl p-8 mb-8">
        <h2 className="text-xl font-bold mb-6">Historia wersji</h2>
        <div className="space-y-6">
          {CHANGELOG.map((release, idx) => (
            <div key={release.version} className={idx > 0 ? 'pt-6 border-t border-border' : ''}>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-sm font-mono font-semibold rounded">
                  v{release.version}
                </span>
                <span className="text-sm text-muted">{new Date(release.date).toLocaleDateString('pl-PL')}</span>
                {idx === 0 && (
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-xs font-semibold rounded">
                    Aktualna
                  </span>
                )}
              </div>
              <ul className="space-y-1 ml-1">
                {release.changes.map((change, i) => (
                  <li key={i} className="text-sm text-muted flex items-start gap-2">
                    <span className="text-primary mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-primary/60" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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

      <div className="mt-8 text-center text-xs text-muted">
        <p>Wersja {CHANGELOG[0].version} · Ostatnia aktualizacja: {new Date(CHANGELOG[0].date).toLocaleDateString('pl-PL')}</p>
      </div>

      <div className="mt-4 text-center">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          &larr; Wróć na stronę główną
        </Link>
      </div>
    </div>
  )
}
