# Extreme Policy Manager by Elektryczny Krzysztof

Mała aplikacja Bun do pobierania plików `.pol` ze switcha Extreme Networks przez SSH/SFTP i prezentowania ich w czytelnej formie.

## Uruchomienie

Wymagany jest Bun 1.1+.

```bash
bun install
bun run dev
```

Otwórz [http://localhost:3333](http://localhost:3333) albo `http://ADRES_SERWERA:3333` z innego hosta.

Domyślnie serwer nasłuchuje na `0.0.0.0:3333`, czyli na wszystkich interfejsach serwera. Jeśli aplikacja jest dostępna spoza zaufanej sieci, ogranicz port regułami firewalla i uruchom ją za HTTPS.

### Docker

Projekt zawiera `Dockerfile` i `docker-compose.yml`. Zbudowanie oraz uruchomienie kontenera:

```bash
docker compose up -d --build
```

Aplikacja będzie dostępna pod `http://ADRES_SERWERA:3333`. Logi:

```bash
docker compose logs -f extreme-policy-manager
```

Zatrzymanie kontenera:

```bash
docker compose down
```

## Jak działa

1. Formularz wysyła dane połączenia do lokalnego backendu Bun.
2. Backend łączy się ze switchem przez SSH2 i otwiera SFTP.
3. Z podanego katalogu pobierane są wyłącznie pliki kończące się na `.pol`.
4. Parser rozbija każdą regułę ExtremeXOS na: `name`, `condition`, `source address`, `source port`, `destination address`, `destination port`, `protocol` i `action`. Pola rozdzielane średnikami mogą znajdować się w osobnych liniach albo w jednej linii; obsługiwane są warunki `if`, `if match all` i `if match any`.
5. Zakładka „Oryginalny tekst” zachowuje pełną zawartość pliku.
6. W rozszerzonym widoku można włączyć edycję pól, dodawać reguły przed lub po dowolnym wierszu, usuwać je po potwierdzeniu oraz wysłać wygenerowaną politykę przez SFTP. Kolejność `draftRules` jest zachowana w eksporcie. Nowy plik jest zapisywany jako `vlan<numer>-<ingress|egress>-YYYY-MM-DD-HH-MM-SS.pol` w wybranym katalogu.
7. Podczas pobierania backend wykonuje również `show access-list` i pokazuje wartość `Dir` obok nazwy wybranej polityki.
8. Zakładka „Mapa połączeń” rysuje source/destination dla reguł polityki i pozwala filtrować po IP, porcie oraz protokole. Najechanie na linię podświetla całe połączenie i pokazuje jego szczegóły.
9. Zakładka „Super Filter” przeszukuje reguły ze wszystkich pobranych polityk po IP, porcie i protokole. Reguła trafia do wyników, jeśli pasuje do co najmniej jednego uzupełnionego filtra; wynik można również pokazać na wspólnej mapie połączeń z informacją o polityce źródłowej.
10. W prawym górnym rogu można zmienić motyw interfejsu: Forest, Blue, Violet, Solarized Dark, Solarized Light lub Retro-Future. Wybrany motyw jest zapamiętywany lokalnie w przeglądarce.
11. Obok motywu dostępny jest wybór języka interfejsu `EN`, `DE`, `PL`. Tłumaczone są również widoki generowane dynamicznie, takie jak edycja reguł, mapa połączeń i Super Filter.
12. Zakładka „Terminal” otwiera po udanym logowaniu drugą, interaktywną sesję SSH przez xterm.js. Sesja terminala działa niezależnie od połączenia używanego do SFTP i pobierania polityk.
13. Zakładka „Claroty” korzysta z API User i tokenu Bearer wygenerowanego w Claroty. Ustaw `CLAROTY_API_USER` oraz `CLAROTY_API_TOKEN` w lokalnym pliku `.env` (na podstawie `.env.example`). Token jest używany wyłącznie po stronie backendu i nie trafia do przeglądarki ani logów. Backend wywołuje `POST /api/v1/devices/` z filtrem `ip_list` oraz wymaganym zestawem pól urządzenia, a zwrócone dane prezentuje jako czytelne pola i zagnieżdżone listy. Bazowy adres API można zmienić przez `CLAROTY_API_URL`.
14. W zakładce „Claroty” dostępna jest opcja „Wyłącz weryfikację certyfikatu TLS”. Jest domyślnie wyłączona i powinna być używana tylko dla zaufanego endpointu z problemem certyfikatu. Wyłączenie działa wyłącznie dla pojedynczego żądania.

Hasło lub klucz prywatny nie są zapisywane na dysku ani w localStorage. W produkcji aplikację należy uruchomić za HTTPS i ograniczyć dostęp do niej do sieci administracyjnej.

Upload nie nadpisuje oryginalnego pliku `.pol`: z nazwy źródłowej zachowuje tylko `vlan` i następujący po nim numer, dodaje kierunek ACL jeden raz oraz bieżący znacznik czasu w strefie `EXPORT_TIME_ZONE` (domyślnie `Europe/Warsaw`) w formacie `YYYY-MM-DD-HH-MM-SS`. Przykładowo `VLAN_123-...pol` staje się `vlan123-ingress-YYYY-MM-DD-HH-MM-SS.pol`. Do zapisu wymagane są uprawnienia SFTP umożliwiające tworzenie plików w wybranym katalogu.

## Uwagi dotyczące Extreme Networks

Domyślny katalog formularza to `/usr/local/cfg`, ale ścieżka zależy od modelu i wersji ExtremeXOS. Jeśli urządzenie nie udostępnia podsystemu SFTP, aplikacja zgłosi błąd — wtedy trzeba użyć katalogu/trybu transferu dostępnego na danym modelu albo dodać adapter oparty o CLI/SCP.
