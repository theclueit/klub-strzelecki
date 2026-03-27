'use client'

import { useState } from 'react'
import { Send, CheckCircle, AlertCircle } from 'lucide-react'

export default function FeedbackForm() {
  const [type, setType] = useState<'bug' | 'feature' | 'other'>('feature')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [issueUrl, setIssueUrl] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return

    setStatus('sending')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: title.trim(), description: description.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setIssueUrl(data.url || null)
        setTitle('')
        setDescription('')
        setEmail('')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-6">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="font-semibold mb-1">Dziękujemy za zgłoszenie!</p>
        <p className="text-sm text-muted mb-4">Twoja uwaga została przekazana do naszego zespołu.</p>
        {issueUrl && (
          <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
            Zobacz zgłoszenie na GitHubie →
          </a>
        )}
        <button
          onClick={() => { setStatus('idle'); setIssueUrl(null) }}
          className="block mx-auto mt-4 text-sm text-muted hover:text-foreground transition-colors"
        >
          Zgłoś kolejną uwagę
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Typ zgłoszenia */}
      <div className="flex gap-2">
        {([
          { value: 'bug', label: '🐛 Błąd', color: 'red' },
          { value: 'feature', label: '💡 Propozycja', color: 'blue' },
          { value: 'other', label: '📝 Inna uwaga', color: 'gray' },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setType(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              type === opt.value
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-border text-muted hover:border-primary/40'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tytuł */}
      <input
        type="text"
        placeholder="Krótki tytuł zgłoszenia"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      {/* Opis */}
      <textarea
        placeholder={type === 'bug'
          ? 'Opisz problem — co się stało, czego się spodziewałeś, jakie kroki prowadzą do błędu...'
          : 'Opisz swoją propozycję lub uwagę...'
        }
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={4}
        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
      />

      {/* Email (opcjonalny) */}
      <input
        type="email"
        placeholder="Email (opcjonalnie — jeśli chcesz otrzymać odpowiedź)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Nie udało się wysłać zgłoszenia. Spróbuj ponownie.</span>
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'sending' || !title.trim() || !description.trim()}
        className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        {status === 'sending' ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
      </button>
    </form>
  )
}
