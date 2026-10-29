# Nova Dent – aplikacja do rezerwacji wizyt stomatologicznych

Nova Dent to aplikacja webowa dla fikcyjnego gabinetu stomatologicznego. Pacjenci mogą przeglądać ofertę, wybierać lekarza i termin wizyty oraz zarządzać swoją rezerwacją. Aplikacja zawiera również panel administracyjny do zarządzania grafikiem i organizacją pracy gabinetu.

Projekt portfolio stworzony z wykorzystaniem Vue 3 i TypeScriptu. Backend jest symulowany za pomocą MSW, a dane demonstracyjne są przechowywane w przeglądarce.

## Prezentacja

Do projektu dołączony jest film prezentujący działanie aplikacji i jej najważniejsze funkcjonalności.

## Funkcjonalności

### Rezerwacja wizyt
- Lista usług wraz z cenami i czasem trwania.
- Szybka rezerwacja na podstawie najbliższych dostępnych terminów.
- Wybór lekarza, dnia i godziny wizyty.
- Formularz z danymi pacjenta i podsumowaniem rezerwacji.
- Generowanie kodu rezerwacji.
- Sprawdzanie dostępności terminów i informowanie o konfliktach.

### Zarządzanie rezerwacją
- Podgląd rezerwacji za pomocą kodu i adresu e-mail.
- Możliwość odwołania wizyty do 24 godzin przed terminem.

### Panel administracyjny
- Widok grafiku dziennego i tygodniowego.
- Zmiana statusów wizyt.
- Dodawanie i edycja usług oraz możliwość ich wyłączania.
- Zarządzanie godzinami pracy lekarzy.
- Obsługa urlopów i dni, w których gabinet jest zamknięty.
- Statystyki dotyczące liczby wizyt, przychodów, obłożenia i odwołań.
- Możliwość przywrócenia danych demonstracyjnych.

## Technologie

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Tailwind CSS 4
- VeeValidate + Zod
- date-fns + @date-fns/tz
- MSW
- Vitest + Vue Test Utils
- ESLint + oxlint + Prettier

## Testy

Projekt zawiera około 270 testów w Vitest.

Testy obejmują między innymi:
- Obliczanie dostępnych terminów i wykrywanie kolizji.
- Obsługę wizyt, godzin pracy i blokad w grafiku.
- Walidację formularzy.
- Obliczanie statystyk.
- Obsługę błędów API.
- Działanie wybranych widoków i komponentów.

## Dane demonstracyjne i ograniczenia
- Aplikacja korzysta z fikcyjnych danych i mock API.
- Dane rezerwacji są przechowywane w localStorage, dzięki czemu pozostają dostępne po odświeżeniu strony.
- Powiadomienia SMS i e-mail nie są faktycznie wysyłane.
- Statystyki przychodów korzystają z aktualnego cennika i nie uwzględniają historii zmian cen.
- Logowanie do panelu jest demonstracyjne (login: `admin`, hasło: `admin`).
- Pozycje i dane pacjentów, lekarzy oraz gabinetu są fikcyjne.
