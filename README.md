# AgentFlowDashboard

Przegladarkowa aplikacja do zarzadzania taskami w stylu Jira: konta uzytkownikow, logowanie, board statusow, przypisywanie wielu osob, komentarze, @wzmianki, powiadomienia, historia aktywnosci i zalaczniki.

## Stack

- Next.js
- Prisma
- SQLite
- React

SQLite jest tutaj najlepszym wyborem na start, bo dane sa silnie relacyjne: uzytkownicy, taski, przypisania, komentarze, pliki, aktywnosci i powiadomienia. Pozniej mozna bez zmiany architektury przejsc na PostgreSQL.

## Uruchomienie

```bash
npm install
npx prisma db push
npm run dev
```

Aplikacja dziala pod adresem:

```text
http://localhost:5000
```

## Rejestracja i akceptacja kont

Aplikacja generuje lokalny token rejestracji i drukuje go w logach serwera, np.:

```text
[AgentFlowDashboard] Token rejestracji: ...
```

Pierwsze konto utworzone z poprawnym tokenem automatycznie dostaje role `ADMIN`. Kazde kolejne konto wymaga tego samego tokenu, ale po rejestracji czeka na akceptacje admina w zakladce `Ludzie`.

## Numery spraw

Kazdy task dostaje numer sprawy w formacie `AFD-1`, `AFD-2` itd. Numer jest linkiem do osobnej strony taska:

```text
http://localhost:5000/tasks/AFD-1
```

Na stronie sprawy jest pelny opis, status, priorytet, termin, przypisane osoby, reporter, komentarze, zalaczniki i historia zmian.

## Przydatne komendy

```bash
npm run build
npm run db:studio
```
