# Szablon tablicy Notion — współpraca z klientem

## Jak skonfigurować

### 1. Utwórz nową stronę w Notion
- Kliknij **+ New page**
- Nazwij ją np. **"Klub Strzelecki — Zgłoszenia"**
- Wybierz **Board** (tablica kanban)

### 2. Kolumny (statusy)

| Kolumna | Kolor | Opis |
|---------|-------|------|
| Nowe | Szary | Klient dodaje tutaj zgłoszenia |
| Do omówienia | Żółty | Wymaga doprecyzowania |
| Zaplanowane | Niebieski | Przyjęte do realizacji |
| W trakcie | Pomarańczowy | Aktualnie realizowane |
| Do sprawdzenia | Fioletowy | Gotowe, czeka na akceptację klienta |
| Gotowe | Zielony | Zaakceptowane i wdrożone |

### 3. Właściwości (pola) dla każdego zgłoszenia

| Pole | Typ | Opcje |
|------|-----|-------|
| Typ | Select | Bug, Zmiana, Nowa funkcja, Pytanie |
| Priorytet | Select | Pilne, Ważne, Normalne, Niski |
| Zgłosił | Person | — |
| Data zgłoszenia | Date | — |
| Termin | Date | — |
| Zrzut ekranu | Files & media | — |
| Notatki Clue IT | Text | Wewnętrzne notatki (widoczność można ograniczyć) |

### 4. Szablony zgłoszeń (Notion Templates)

Dodaj te szablony klikając **+ New template** w tablicy:

---

#### Szablon: Bug (błąd)

```
**Co się dzieje?**
Opisz problem swoimi słowami.

**Gdzie to widzisz?**
Na jakiej stronie / w jakiej sekcji?

**Jak odtworzyć?**
1. Wchodzę na stronę...
2. Klikam...
3. Widzę...

**Czego się spodziewałem?**
Co powinno się wydarzyć zamiast tego?

**Zrzut ekranu**
(wklej tutaj zrzut ekranu lub zdjęcie z telefonu)
```

Ustaw domyślnie: Typ = Bug, Priorytet = Normalne

---

#### Szablon: Nowa funkcja

```
**Czego potrzebuję?**
Opisz funkcję swoimi słowami.

**Po co to jest?**
Jaki problem to rozwiązuje? Kto z tego skorzysta?

**Jak sobie to wyobrażam?**
Opis lub szkic (można wkleić zdjęcie rysunku na kartce).

**Jak pilne?**
Na kiedy to jest potrzebne?
```

Ustaw domyślnie: Typ = Nowa funkcja, Priorytet = Normalne

---

#### Szablon: Zmiana

```
**Co chcę zmienić?**
Wskaż co i gdzie.

**Jak ma wyglądać po zmianie?**
Opisz lub wklej przykład/screenshot.

**Dlaczego?**
Krótko — powód zmiany.
```

Ustaw domyślnie: Typ = Zmiana, Priorytet = Normalne

---

#### Szablon: Pytanie

```
**Pytanie:**
O co chcę zapytać?

**Kontekst:**
Czego dotyczy? (strona, funkcja, termin)
```

Ustaw domyślnie: Typ = Pytanie, Priorytet = Niski

---

## 5. Widoki (Views)

Utwórz dodatkowe widoki tablicy:

| Widok | Typ | Filtr / Grupowanie |
|-------|-----|--------------------|
| Tablica | Board | Grupuj po: Status (domyślny) |
| Lista bugów | Table | Filtr: Typ = Bug |
| Priorytety | Table | Sortuj: Priorytet → Pilne na górze |
| Moje zgłoszenia | Table | Filtr: Zgłosił = @ja |
| Kalendarz | Calendar | Po polu: Termin |

## 6. Udostępnianie klientowi

1. Kliknij **Share** w prawym górnym rogu
2. **Invite** → wpisz email klienta
3. Ustaw uprawnienia: **Can edit** (żeby mógł dodawać zgłoszenia)
4. Klient dostanie zaproszenie na email — może korzystać z przeglądarki lub aplikacji Notion (iOS/Android)

## 7. Zasady współpracy (wklej na stronę)

> ### Jak zgłaszać?
> 1. Kliknij **+ New** na tablicy
> 2. Wybierz szablon (Bug / Nowa funkcja / Zmiana / Pytanie)
> 3. Wypełnij pola — im więcej szczegółów, tym szybciej zrealizujemy
> 4. Dodaj zrzut ekranu jeśli to możliwe (Ctrl+V lub zdjęcie z telefonu)
> 5. Gotowe! Dostaniesz odpowiedź w komentarzu pod zgłoszeniem
