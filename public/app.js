const form = document.querySelector("#connection-form");
const authType = document.querySelector("#auth-type");
const passwordField = document.querySelector("#password-field");
const privateKeyField = document.querySelector("#private-key-field");
const passphraseField = document.querySelector("#passphrase-field");
const button = document.querySelector("#connect-button");
const buttonLabel = document.querySelector("#connect-label");
const emptyState = document.querySelector("#empty-state");
const loadedView = document.querySelector("#loaded-view");
const errorState = document.querySelector("#error-state");
const errorMessage = document.querySelector("#error-message");
const resultMeta = document.querySelector("#result-meta");
const resultsPanel = document.querySelector(".results-panel");
const expandViewButton = document.querySelector("#expand-view");
const expandViewLabel = document.querySelector("#expand-label");
const fileList = document.querySelector("#file-list");
const fileDetail = document.querySelector("#file-detail");
const statsRow = document.querySelector("#stats-row");
const fileCount = document.querySelector("#file-count");
const workspaceTabs = document.querySelector("#workspace-tabs");
const policiesWorkspaceTab = document.querySelector("#policies-workspace-tab");
const superFilterWorkspaceTab = document.querySelector("#super-filter-workspace-tab");
const terminalWorkspaceTab = document.querySelector("#terminal-workspace-tab");
const superFilterView = document.querySelector("#super-filter-view");
const terminalView = document.querySelector("#terminal-view");
const terminalContainer = document.querySelector("#terminal-container");
const terminalStatus = document.querySelector("#terminal-status");
const terminalReconnect = document.querySelector("#terminal-reconnect");
const themeSelect = document.querySelector("#theme-select");
const languageSelect = document.querySelector("#language-select");

let files = [];
let selectedFile = null;
let editMode = false;
let draftRules = null;
let superFilterInitialized = false;
let lastErrorMessage = "";
let activeConnectionPayload = null;
let terminalSocket = null;
let terminalInstance = null;
let terminalFitAddon = null;
let terminalState = "idle";
let terminalConnectionAttempt = 0;
let terminalFitFrame = 0;

const THEME_STORAGE_KEY = "acl-editor-theme";
const THEME_VALUES = new Set(["forest", "blue", "violet", "solarized-dark", "solarized-light", "retro-future"]);
const THEME_COLORS = {
  forest: "#0e1716",
  blue: "#0d1420",
  violet: "#15111f",
  "solarized-dark": "#002b36",
  "solarized-light": "#fdf6e3",
  "retro-future": "#100b24",
};

const TRANSLATIONS = {
  en: {
    ui: {
      localConnection: "local connection", theme: "Theme", language: "Language", themeAria: "Choose color theme",
      languageAria: "Choose interface language", optional: "(optional)", noActiveConnection: "No active connection",
      expandTable: "Expand table view", closeExpanded: "Close expanded view", expandView: "Expand view", closeView: "Close view",
      modules: "ACL Editor modules", pageTitle: "Extreme Policy Manager",
    },
    connection: {
      title: "Connection", host: "Switch host / IP", port: "Port", username: "Username", authMethod: "Authentication method",
      passwordAuth: "SSH password", privateKeyAuth: "Private key", password: "Password", privateKey: "Private PEM key",
      passphrase: "Key passphrase", remoteDirectory: "Remote directory", remoteHint: "Only .pol files are fetched from this directory.",
      connect: "Connect and fetch files", connecting: "Connecting to switch…", security: "Credentials are used only for this request and are not stored.",
    },
    workspace: { policies: "Policies", superFilter: "Super Filter", terminal: "Terminal" },
    terminal: {
      kicker: "SSH TERMINAL", title: "Terminal", connecting: "Opening a second SSH session…", connected: "Connected to the switch via a separate SSH session.",
      reconnecting: "Reconnecting…", reconnect: "Reconnect", disconnected: "SSH terminal session closed.", unavailable: "xterm.js could not be loaded.",
      aria: "Interactive SSH terminal", connectionError: "Could not open the SSH terminal session.",
    },
    empty: { title: "Your files will appear here", description: "Enter switch details on the left to begin downloading. File contents stay in this browser session." },
    files: { title: "POL FILES", placeholder: "Select a file from the list to view its contents.", noFiles: "No .pol files in this directory.", noDate: "no date", rules: "{count} rules" },
    error: {
      title: "Could not fetch files", connection: "Connection error", unknown: "Unknown error.", invalidForm: "Invalid form data.", host: "Enter the switch IP address or hostname.",
      username: "Enter the SSH username.", remotePath: "The remote directory must be an absolute path, e.g. /usr/local/cfg.", portRange: "The port must be a number from 1 to 65535.",
      password: "Enter the SSH password.", privateKey: "Paste the SSH private key.", missingPolicy: "No policy name to save.", emptyPolicy: "An empty policy cannot be uploaded.",
      tooLarge: "The policy is too large (maximum 2 MB).", readForm: "Could not read the form data.", readUpload: "Could not read the uploaded file data.",
      fetch: "Could not fetch files. Check the host, credentials, directory, and whether the switch provides SFTP.", upload: "Could not upload the updated policy. Check SFTP permissions and the remote directory.",
    },
    stats: { files: "FILES", rules: "RULES", lines: "LINES", size: "SIZE" },
    detail: {
      direction: "Direction", finishEditing: "Finish editing", editFields: "Edit fields", upload: "Upload to switch", copyRaw: "Copy raw",
      copied: "Copied ✓", readable: "Readable view", graph: "Connection map", original: "Original text", uploadInProgress: "Uploading…",
      uploadSuccess: "Uploaded successfully: {name}", lastUpload: "Last upload: {name}", uploadUnknownError: "Unknown upload error.",
    },
    table: {
      line: "LINE", name: "NAME", condition: "CONDITION", sourceAddress: "SOURCE ADDRESS", sourcePort: "SOURCE PORT",
      destinationAddress: "DESTINATION ADDRESS", destinationPort: "DESTINATION PORT", protocol: "PROTOCOL", action: "ACTION", operations: "OPERATIONS",
      empty: "empty", searchPlaceholder: "Search any rule field…", searchAria: "Search in file", addAtEnd: "+ Add at end",
      addBefore: "Add rule before this row", addAfter: "Add rule after this row", delete: "Delete this rule", deleteConfirm: "Are you sure you want to delete rule “{name}”?",
      noMatches: "No rules match the search.",
    },
    graph: {
      title: "Source to destination connection map", policy: "Policy", rule: "Rule {index}", source: "Source", destination: "Destination", action: "Action",
      any: "any", ipLabel: "IP", portField: "PORT", protocolLabel: "PROTOCOL", portLabel: "port", ipPlaceholder: "e.g. 10.0.0.1", portPlaceholder: "e.g. 443", protocolPlaceholder: "e.g. tcp", aria: "Interactive connection map",
      empty: "No connections match the filters.", count: "{visible} / {total} connections", sourceSide: "SOURCE", destinationSide: "DESTINATION",
    },
    superFilter: {
      kicker: "GLOBAL QUERY", title: "Super Filter", description: "Search rules across all downloaded policies. A rule is included when it matches at least one completed filter.",
      map: "Connection map", hideMap: "Hide connection map", search: "Search rules", noQuery: "No query has been run",
      initial: "Complete at least one field and click “Search rules”.", missingFilter: "Enter an IP, port, or protocol to start searching.",
      result: "{count} rules from {policies} policies", noMatches: "No rules match the entered filters.", policy: "POLICY", line: "LINE", name: "NAME",
      condition: "CONDITION", sourceAddress: "SOURCE IP", sourcePort: "SOURCE PORT", destinationAddress: "DESTINATION IP",
      destinationPort: "DESTINATION PORT", protocol: "PROTOCOL", action: "ACTION", graphAria: "Super Filter result connection map",
    },
    footer: { security: "SSH credentials stay in memory only" },
  },
  de: {
    ui: {
      localConnection: "lokale Verbindung", theme: "Design", language: "Sprache", themeAria: "Farbschema auswählen",
      languageAria: "Sprache der Benutzeroberfläche auswählen", optional: "(optional)", noActiveConnection: "Keine aktive Verbindung",
      expandTable: "Tabellenansicht erweitern", closeExpanded: "Erweiterte Ansicht schließen", expandView: "Ansicht erweitern", closeView: "Ansicht schließen",
      modules: "ACL-Editor-Module", pageTitle: "Extreme Policy Manager",
    },
    connection: {
      title: "Verbindung", host: "Switch-Host / IP", port: "Port", username: "Benutzername", authMethod: "Authentifizierungsmethode",
      passwordAuth: "SSH-Passwort", privateKeyAuth: "Privater Schlüssel", password: "Passwort", privateKey: "Privater PEM-Schlüssel",
      passphrase: "Passphrase des Schlüssels", remoteDirectory: "Entferntes Verzeichnis", remoteHint: "Aus diesem Verzeichnis werden nur .pol-Dateien abgerufen.",
      connect: "Verbinden und Dateien abrufen", connecting: "Verbindung zum Switch wird hergestellt…", security: "Anmeldedaten werden nur für diese Anfrage verwendet und nicht gespeichert.",
    },
    workspace: { policies: "Richtlinien", superFilter: "Super Filter", terminal: "Terminal" },
    terminal: {
      kicker: "SSH-TERMINAL", title: "Terminal", connecting: "Eine zweite SSH-Sitzung wird geöffnet…", connected: "Über eine separate SSH-Sitzung mit dem Switch verbunden.",
      reconnecting: "Verbindung wird wiederhergestellt…", reconnect: "Erneut verbinden", disconnected: "Die SSH-Terminalsitzung wurde geschlossen.", unavailable: "xterm.js konnte nicht geladen werden.",
      aria: "Interaktives SSH-Terminal", connectionError: "Die SSH-Terminalsitzung konnte nicht geöffnet werden.",
    },
    empty: { title: "Ihre Dateien werden hier angezeigt", description: "Geben Sie links die Switch-Daten ein, um den Abruf zu starten. Die Dateiinhalte bleiben in dieser Browsersitzung." },
    files: { title: "POL-DATEIEN", placeholder: "Wählen Sie eine Datei aus, um ihren Inhalt anzuzeigen.", noFiles: "Keine .pol-Dateien in diesem Verzeichnis.", noDate: "kein Datum", rules: "{count} Regeln" },
    error: {
      title: "Dateien konnten nicht abgerufen werden", connection: "Verbindungsfehler", unknown: "Unbekannter Fehler.", invalidForm: "Ungültige Formulardaten.", host: "Geben Sie die IP-Adresse oder den Hostnamen des Switches ein.",
      username: "Geben Sie den SSH-Benutzernamen ein.", remotePath: "Das entfernte Verzeichnis muss ein absoluter Pfad sein, z. B. /usr/local/cfg.", portRange: "Der Port muss eine Zahl zwischen 1 und 65535 sein.",
      password: "Geben Sie das SSH-Passwort ein.", privateKey: "Fügen Sie den privaten SSH-Schlüssel ein.", missingPolicy: "Kein Richtlinienname zum Speichern vorhanden.", emptyPolicy: "Eine leere Richtlinie kann nicht hochgeladen werden.",
      tooLarge: "Die Richtlinie ist zu groß (maximal 2 MB).", readForm: "Formulardaten konnten nicht gelesen werden.", readUpload: "Daten der hochzuladenden Datei konnten nicht gelesen werden.",
      fetch: "Dateien konnten nicht abgerufen werden. Prüfen Sie Host, Anmeldedaten, Verzeichnis und ob der Switch SFTP bereitstellt.", upload: "Die aktualisierte Richtlinie konnte nicht hochgeladen werden. Prüfen Sie SFTP-Berechtigungen und das entfernte Verzeichnis.",
    },
    stats: { files: "DATEIEN", rules: "REGELN", lines: "ZEILEN", size: "GRÖSSE" },
    detail: {
      direction: "Richtung", finishEditing: "Bearbeitung beenden", editFields: "Felder bearbeiten", upload: "Auf Switch hochladen", copyRaw: "Raw kopieren",
      copied: "Kopiert ✓", readable: "Lesbare Ansicht", graph: "Verbindungsdiagramm", original: "Originaltext", uploadInProgress: "Wird hochgeladen…",
      uploadSuccess: "Erfolgreich hochgeladen: {name}", lastUpload: "Letzter Upload: {name}", uploadUnknownError: "Unbekannter Upload-Fehler.",
    },
    table: {
      line: "ZEILE", name: "NAME", condition: "BEDINGUNG", sourceAddress: "QUELLADRESSE", sourcePort: "QUELLPORT",
      destinationAddress: "ZIELADRESSE", destinationPort: "ZIELPORT", protocol: "PROTOKOLL", action: "AKTION", operations: "AKTIONEN",
      empty: "leer", searchPlaceholder: "Beliebiges Regelfeld durchsuchen…", searchAria: "Datei durchsuchen", addAtEnd: "+ Am Ende hinzufügen",
      addBefore: "Regel vor dieser Zeile hinzufügen", addAfter: "Regel nach dieser Zeile hinzufügen", delete: "Diese Regel löschen", deleteConfirm: "Möchten Sie die Regel „{name}“ wirklich löschen?",
      noMatches: "Keine Regeln entsprechen der Suche.",
    },
    graph: {
      title: "Verbindungsdiagramm von Quelle zu Ziel", policy: "Richtlinie", rule: "Regel {index}", source: "Quelle", destination: "Ziel", action: "Aktion",
      any: "beliebig", ipLabel: "IP", portField: "PORT", protocolLabel: "PROTOKOLL", portLabel: "Port", ipPlaceholder: "z. B. 10.0.0.1", portPlaceholder: "z. B. 443", protocolPlaceholder: "z. B. tcp", aria: "Interaktives Verbindungsdiagramm",
      empty: "Keine Verbindungen entsprechen den Filtern.", count: "{visible} / {total} Verbindungen", sourceSide: "QUELLE", destinationSide: "ZIEL",
    },
    superFilter: {
      kicker: "GLOBALE SUCHE", title: "Super Filter", description: "Durchsuchen Sie Regeln aus allen abgerufenen Richtlinien. Eine Regel wird angezeigt, wenn sie mindestens einem ausgefüllten Filter entspricht.",
      map: "Verbindungsdiagramm", hideMap: "Verbindungsdiagramm ausblenden", search: "Regeln suchen", noQuery: "Noch keine Suche ausgeführt",
      initial: "Füllen Sie mindestens ein Feld aus und klicken Sie auf „Regeln suchen“.", missingFilter: "Geben Sie eine IP, einen Port oder ein Protokoll ein, um die Suche zu starten.",
      result: "{count} Regeln aus {policies} Richtlinien", noMatches: "Keine Regeln entsprechen den eingegebenen Filtern.", policy: "RICHTLINIE", line: "ZEILE", name: "NAME",
      condition: "BEDINGUNG", sourceAddress: "QUELL-IP", sourcePort: "QUELLPORT", destinationAddress: "ZIEL-IP",
      destinationPort: "ZIELPORT", protocol: "PROTOKOLL", action: "AKTION", graphAria: "Verbindungsdiagramm des Super-Filter-Ergebnisses",
    },
    footer: { security: "SSH-Anmeldedaten bleiben nur im Speicher" },
  },
  pl: {
    ui: {
      localConnection: "lokalne połączenie", theme: "Motyw", language: "Język", themeAria: "Wybierz kolorystykę strony",
      languageAria: "Wybierz język interfejsu", optional: "(opcjonalne)", noActiveConnection: "Brak aktywnego połączenia",
      expandTable: "Rozszerz widok tabeli", closeExpanded: "Zamknij rozszerzony widok", expandView: "Rozszerz widok", closeView: "Zamknij widok",
      modules: "Moduły ACL Editor", pageTitle: "Extreme Policy Manager",
    },
    connection: {
      title: "Połączenie", host: "Host / IP switcha", port: "Port", username: "Użytkownik", authMethod: "Metoda uwierzytelniania",
      passwordAuth: "Hasło SSH", privateKeyAuth: "Klucz prywatny", password: "Hasło", privateKey: "Klucz prywatny PEM",
      passphrase: "Hasło klucza", remoteDirectory: "Katalog zdalny", remoteHint: "Pobierane są tylko pliki z rozszerzeniem .pol z tego katalogu.",
      connect: "Połącz i pobierz pliki", connecting: "Łączenie ze switchem…", security: "Dane uwierzytelniające są używane tylko dla tego żądania i nie są zapisywane.",
    },
    workspace: { policies: "Polityki", superFilter: "Super Filter", terminal: "Terminal" },
    terminal: {
      kicker: "TERMINAL SSH", title: "Terminal", connecting: "Otwieranie drugiej sesji SSH…", connected: "Połączono ze switchem przez oddzielną sesję SSH.",
      reconnecting: "Ponowne łączenie…", reconnect: "Połącz ponownie", disconnected: "Sesja terminala SSH została zamknięta.", unavailable: "Nie udało się załadować xterm.js.",
      aria: "Interaktywny terminal SSH", connectionError: "Nie udało się otworzyć sesji terminala SSH.",
    },
    empty: { title: "Twoje pliki pojawią się tutaj", description: "Wpisz dane switcha po lewej i rozpocznij pobieranie. Zawartość plików pozostaje w tej sesji przeglądarki." },
    files: { title: "PLIKI .POL", placeholder: "Wybierz plik z listy, aby zobaczyć jego zawartość.", noFiles: "Brak plików .pol w tym katalogu.", noDate: "brak daty", rules: "{count} reguł" },
    error: {
      title: "Nie udało się pobrać plików", connection: "Błąd połączenia", unknown: "Nieznany błąd.", invalidForm: "Nieprawidłowe dane formularza.", host: "Podaj adres IP lub nazwę hosta switcha.",
      username: "Podaj nazwę użytkownika SSH.", remotePath: "Katalog zdalny musi być ścieżką absolutną, np. /usr/local/cfg.", portRange: "Port musi być liczbą od 1 do 65535.",
      password: "Podaj hasło SSH.", privateKey: "Wklej klucz prywatny SSH.", missingPolicy: "Brak nazwy polityki do zapisania.", emptyPolicy: "Nie można wysłać pustej polityki.",
      tooLarge: "Polityka jest zbyt duża (maksymalnie 2 MB).", readForm: "Nie udało się odczytać danych formularza.", readUpload: "Nie udało się odczytać danych wysyłanego pliku.",
      fetch: "Nie udało się pobrać plików. Sprawdź host, dane logowania, katalog i to, czy switch udostępnia SFTP.", upload: "Nie udało się wysłać zaktualizowanej polityki. Sprawdź uprawnienia SFTP i katalog zdalny.",
    },
    stats: { files: "PLIKÓW", rules: "REGUŁ", lines: "LINII", size: "ROZMIAR" },
    detail: {
      direction: "Kierunek", finishEditing: "Zakończ edycję", editFields: "Edytuj pola", upload: "Wyślij na switch", copyRaw: "Kopiuj raw",
      copied: "Skopiowano ✓", readable: "Widok czytelny", graph: "Mapa połączeń", original: "Oryginalny tekst", uploadInProgress: "Wysyłanie…",
      uploadSuccess: "Wysłano poprawnie: {name}", lastUpload: "Ostatni upload: {name}", uploadUnknownError: "Nieznany błąd wysyłania.",
    },
    table: {
      line: "LINIA", name: "NAZWA", condition: "WARUNEK", sourceAddress: "ADRES ŹRÓDŁOWY", sourcePort: "PORT ŹRÓDŁOWY",
      destinationAddress: "ADRES DOCELOWY", destinationPort: "PORT DOCELOWY", protocol: "PROTOKÓŁ", action: "AKCJA", operations: "OPERACJE",
      empty: "puste", searchPlaceholder: "Szukaj po dowolnym polu reguły…", searchAria: "Szukaj w pliku", addAtEnd: "+ Dodaj na końcu",
      addBefore: "Dodaj regułę przed tym wierszem", addAfter: "Dodaj regułę po tym wierszu", delete: "Usuń tę regułę", deleteConfirm: "Czy na pewno usunąć regułę „{name}”?",
      noMatches: "Brak reguł pasujących do wyszukiwania.",
    },
    graph: {
      title: "Mapa połączeń source do destination", policy: "Polityka", rule: "Reguła {index}", source: "Źródło", destination: "Cel", action: "Akcja",
      any: "dowolny", ipLabel: "IP", portField: "PORT", protocolLabel: "PROTOKÓŁ", portLabel: "port", ipPlaceholder: "np. 10.0.0.1", portPlaceholder: "np. 443", protocolPlaceholder: "np. tcp", aria: "Interaktywny wykres połączeń",
      empty: "Brak połączeń spełniających filtry.", count: "{visible} / {total} połączeń", sourceSide: "SOURCE", destinationSide: "DESTINATION",
    },
    superFilter: {
      kicker: "GLOBALNE WYSZUKIWANIE", title: "Super Filter", description: "Przeszukaj reguły ze wszystkich pobranych polityk. Wystarczy, że reguła pasuje do co najmniej jednego uzupełnionego filtra.",
      map: "Mapa połączeń", hideMap: "Ukryj mapę połączeń", search: "Szukaj reguł", noQuery: "Brak wykonanego zapytania",
      initial: "Uzupełnij co najmniej jedno pole i kliknij „Szukaj reguł”.", missingFilter: "Wprowadź IP, port albo protokół, aby rozpocząć wyszukiwanie.",
      result: "{count} reguł z {policies} polityk", noMatches: "Brak reguł pasujących do podanych filtrów.", policy: "POLITYKA", line: "LINIA", name: "NAZWA",
      condition: "WARUNEK", sourceAddress: "IP ŹRÓDŁOWE", sourcePort: "PORT ŹRÓDŁOWY", destinationAddress: "IP DOCELOWE",
      destinationPort: "PORT DOCELOWY", protocol: "PROTOKÓŁ", action: "AKCJA", graphAria: "Wizualizacja wyniku Super Filter",
    },
    footer: { security: "SSH credentials stay in memory only" },
  },
  tlh: {
    ui: {
      localConnection: "rarlu' taH", theme: "nguv", language: "Hol", themeAria: "nguv yIwIv",
      languageAria: "Hol yIwIv", optional: "(pagh)", noActiveConnection: "rarlu'be'",
      expandTable: "pat yIvaS", closeExpanded: "pat yISoQmoH", expandView: "legh yIvaS", closeView: "legh yISoQmoH",
      modules: "ACL mIw", pageTitle: "Extreme Policy Manager - tlhIngan Hol",
    },
    connection: {
      title: "rarlu'", host: "QumwI' juH / IP", port: "lojmIt", username: "lo'wI' pong", authMethod: "yI'el mIw",
      passwordAuth: "SSH pegh mu'", privateKeyAuth: "pegh ngaSwI'", password: "pegh mu'", privateKey: "pegh ngaSwI' PEM",
      passphrase: "pegh mu' bIH", remoteDirectory: "Hop Daq", remoteHint: "Daqvamvo' .pol nav neH yIlel.",
      connect: "yIrarlu' 'ej nav yIlel", connecting: "QumwI'vaD rarlu'…", security: "peghmeyvam neH lo'lu'; polHa'lu'be'.",
    },
    workspace: { policies: "pabmey", superFilter: "Super wIv", terminal: "Qum Daq" },
    terminal: {
      kicker: "SSH QUM DAQ", title: "Qum Daq", connecting: "cha'DIch SSH rarlu'…", connected: "QumwI'vaD latlh SSH rarlu'.",
      reconnecting: "rarlu'qa'…", reconnect: "rarlu'qa'", disconnected: "SSH Qum Daq mej.", unavailable: "xterm.js luj.",
      aria: "SSH Qum Daq jI'IjlaH", connectionError: "SSH Qum Daq vIchenmoHlaHbe'.",
    },
    empty: { title: "navmeylIj naQaq", description: "poS DaqDaq QumwI' De' yIghItlh. vaj navmey yIlel. DaH peghmey bIH neH." },
    files: { title: "POL NAVMEY", placeholder: "nav yIwIv 'ej yIlaD.", noFiles: "pagh .pol nav DaqvamDaq.", noDate: "poH pagh", rules: "{count} pabmey" },
    error: {
      title: "navmey vIlellaHbe'", connection: "rarlu'Ha'", unknown: "Sovbe'lu'.", invalidForm: "De' mIw ta'Ha'.", host: "QumwI' juH yIghItlh.",
      username: "SSH lo'wI' pong yIghItlh.", remotePath: "Hop Daq chImHa' yIghItlh, /usr/local/cfg rur.", portRange: "lojmIt 1-65535 Daq yIwIv.",
      password: "SSH pegh mu' yIghItlh.", privateKey: "SSH pegh ngaSwI' yI'ang.", missingPolicy: "pab pong tu'lu'be'.", emptyPolicy: "chIm pab yIlelbe'.",
      tooLarge: "pab tInqu' (2 MB neH).", readForm: "De' mIw laDlaHbe'.", readUpload: "nav De' laDlaHbe'.",
      fetch: "navmey vIlelbe'laH. QumwI', peghmey, Daq, SFTP yIlegh.", upload: "pab chu' yIlelbe'laH. SFTP ngevmeH lojmItmey yIlegh.",
    },
    stats: { files: "NAVMEY", rules: "PABMEY", lines: "TLHICHMEY", size: "'AB" },
    detail: {
      direction: "He", finishEditing: "ghItlh ta'", editFields: "yIchoH", upload: "QumwI'vaD yIlel", copyRaw: "raw yIqoS",
      copied: "qoSlu' ✓", readable: "yIlaD", graph: "rarlu'ghach map", original: "wa'DIch ghItlh", uploadInProgress: "yIleltaH…",
      uploadSuccess: "Qapla': {name}", lastUpload: "Qapta'ghach: {name}", uploadUnknownError: "yIlelHa'lu'.",
    },
    table: {
      line: "TLHICH", name: "PONG", condition: "meq", sourceAddress: "mung IP", sourcePort: "mung lojmIt",
      destinationAddress: "Daq IP", destinationPort: "Daq lojmIt", protocol: "Qum mIw", action: "vang", operations: "ta'mey",
      empty: "pagh", searchPlaceholder: "pabmey Hoch yInej…", searchAria: "navDaq yInej", addAtEnd: "+ bID yIchel",
      addBefore: "pabvam tlhop yIchel", addAfter: "pabvam 'aqroS yIchel", delete: "pabvam yIteq", deleteConfirm: "pab “{name}” yIteq'a'?",
      noMatches: "pabmey pIm tu'lu'be'.",
    },
    graph: {
      title: "mungvo' Daq rarlu'ghach map", policy: "pab", rule: "pab {index}", source: "mung", destination: "Daq", action: "vang",
      any: "Hoch", ipLabel: "IP", portField: "LOJMIT", protocolLabel: "QUM M I W", portLabel: "lojmIt", ipPlaceholder: "10.0.0.1 rur", portPlaceholder: "443 rur", protocolPlaceholder: "tcp rur", aria: "rarlu'ghach map",
      empty: "rarlu'ghach pIm tu'lu'be'.", count: "{visible} / {total} rarlu'ghach", sourceSide: "MUNG", destinationSide: "DAQ",
    },
    superFilter: {
      kicker: "Hoch PAB NEJ", title: "Super wIv", description: "pabmey Hoch nav. wIv wa' Qapchugh pab yI'ang.",
      map: "rarlu'ghach map", hideMap: "map yISo'", search: "pab yInej", noQuery: "nejta'be'",
      initial: "wa' neH yIghItlh 'ej “pab yInej” yIwIv.", missingFilter: "IP, lojmIt pagh Qum mIw yIghItlh.",
      result: "{count} pab {policies} pabmeyvo'", noMatches: "pab pIm tu'lu'be'.", policy: "PAB", line: "TLHICH", name: "PONG",
      condition: "MEQ", sourceAddress: "MUNG IP", sourcePort: "MUNG LOJMIT", destinationAddress: "DAQ IP",
      destinationPort: "DAQ LOJMIT", protocol: "QUM M I W", action: "VANG", graphAria: "Super wIv rarlu'ghach map",
    },
    footer: { security: "SSH peghmey polHa'lu'be'" },
  },
};

const LANGUAGE_STORAGE_KEY = "acl-editor-language";
const LANGUAGE_VALUES = new Set(["en", "de", "pl", "tlh"]);
let currentLanguage = "pl";
let superFilterState = { ip: "", port: "", protocol: "", results: [], hasSearched: false, graphVisible: false };

function t(key, variables = {}) {
  const value = key.split(".").reduce((result, part) => result?.[part], TRANSLATIONS[currentLanguage]) ?? key;
  return String(value).replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? ""));
}

const SERVER_ERROR_PREFIXES = [
  ["Nieprawidłowe dane formularza.", "error.invalidForm"],
  ["Podaj adres IP lub nazwę hosta switcha.", "error.host"],
  ["Podaj nazwę użytkownika SSH.", "error.username"],
  ["Katalog zdalny musi być ścieżką absolutną, np. /usr/local/cfg.", "error.remotePath"],
  ["Port musi być liczbą od 1 do 65535.", "error.portRange"],
  ["Podaj hasło SSH.", "error.password"],
  ["Wklej klucz prywatny SSH.", "error.privateKey"],
  ["Brak nazwy polityki do zapisania.", "error.missingPolicy"],
  ["Nie można wysłać pustej polityki.", "error.emptyPolicy"],
  ["Polityka jest zbyt duża (maksymalnie 2 MB).", "error.tooLarge"],
  ["Nie udało się odczytać danych formularza.", "error.readForm"],
  ["Nie udało się odczytać danych wysyłanego pliku.", "error.readUpload"],
  ["Nie udało się pobrać plików. Sprawdź host, dane logowania, katalog i to, czy switch udostępnia SFTP.", "error.fetch"],
  ["Nie udało się wysłać zaktualizowanej polityki. Sprawdź uprawnienia SFTP i katalog zdalny.", "error.upload"],
];

function localizeServerError(message) {
  const source = String(message ?? "");
  const match = SERVER_ERROR_PREFIXES.find(([prefix]) => source === prefix || source.startsWith(`${prefix} (`));
  return match ? `${t(match[1])}${source.slice(match[0].length)}` : source;
}

function applyStaticLanguage() {
  document.documentElement.lang = currentLanguage;
  document.title = t("ui.pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  refreshTerminalLabels();
}

function applyLanguage(language, persist = true) {
  currentLanguage = LANGUAGE_VALUES.has(language) ? language : "pl";
  languageSelect.value = currentLanguage;
  applyStaticLanguage();
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    } catch {
      // Storage can be unavailable in a restricted browser session.
    }
  }
  const superFilterVisible = superFilterInitialized && !superFilterView.classList.contains("hidden");
  superFilterInitialized = false;
  superFilterView.innerHTML = "";
  if (files.length) {
    renderStats();
    renderFileList();
    renderDetail();
  }
  if (!errorState.classList.contains("hidden") && lastErrorMessage) {
    errorMessage.textContent = localizeServerError(lastErrorMessage);
  }
  if (superFilterVisible) {
    superFilterView.classList.remove("hidden");
    renderSuperFilterView();
  }
}

let savedLanguage = "pl";
try {
  savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "pl";
} catch {
  savedLanguage = "pl";
}
applyLanguage(savedLanguage, false);
languageSelect.addEventListener("change", () => applyLanguage(languageSelect.value));

function applyTheme(theme, persist = true) {
  const nextTheme = THEME_VALUES.has(theme) ? theme : "forest";
  document.documentElement.dataset.theme = nextTheme;
  themeSelect.value = nextTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[nextTheme]);
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Storage can be unavailable in a restricted browser session.
    }
  }
}

let savedTheme = "forest";
try {
  savedTheme = localStorage.getItem(THEME_STORAGE_KEY) ?? "forest";
} catch {
  savedTheme = "forest";
}
applyTheme(savedTheme, false);
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));

function setWorkspaceTab(tabName) {
  const superFilter = tabName === "super-filter";
  const terminal = tabName === "terminal";
  policiesWorkspaceTab.classList.toggle("active", !superFilter && !terminal);
  superFilterWorkspaceTab.classList.toggle("active", superFilter);
  terminalWorkspaceTab.classList.toggle("active", terminal);
  policiesWorkspaceTab.setAttribute("aria-selected", String(!superFilter && !terminal));
  superFilterWorkspaceTab.setAttribute("aria-selected", String(superFilter));
  terminalWorkspaceTab.setAttribute("aria-selected", String(terminal));
  loadedView.classList.toggle("hidden", superFilter || terminal);
  superFilterView.classList.toggle("hidden", !superFilter);
  terminalView.classList.toggle("hidden", !terminal);
  if (superFilter && !superFilterInitialized) renderSuperFilterView();
  if (terminal) {
    initializeTerminal();
    if (activeConnectionPayload && !terminalSocket) connectTerminalSession(activeConnectionPayload);
    fitTerminal();
  }
}

policiesWorkspaceTab.addEventListener("click", () => setWorkspaceTab("policies"));
superFilterWorkspaceTab.addEventListener("click", () => setWorkspaceTab("super-filter"));
terminalWorkspaceTab.addEventListener("click", () => setWorkspaceTab("terminal"));

function refreshTerminalLabels() {
  if (!terminalStatus || !terminalReconnect) return;
  const statusKey = {
    idle: "terminal.connecting",
    connecting: "terminal.connecting",
    connected: "terminal.connected",
    closed: "terminal.disconnected",
    error: "terminal.connectionError",
  }[terminalState] || "terminal.connecting";
  terminalStatus.textContent = t(statusKey);
  terminalStatus.classList.toggle("terminal-status-error", terminalState === "error");
  terminalReconnect.textContent = t("terminal.reconnect");
  terminalReconnect.disabled = !activeConnectionPayload || terminalState === "connecting";
}

function fitTerminal() {
  if (!terminalInstance || terminalView.classList.contains("hidden")) return;
  if (terminalFitFrame) cancelAnimationFrame(terminalFitFrame);
  terminalFitFrame = requestAnimationFrame(() => {
    terminalFitFrame = requestAnimationFrame(() => {
      terminalFitFrame = 0;
      if (!terminalInstance || terminalView.classList.contains("hidden")) return;
      try {
        if (terminalFitAddon) {
          terminalFitAddon.fit();
        } else {
          const cols = Math.max(20, Math.floor(terminalContainer.clientWidth / 8.4));
          const rows = Math.max(5, Math.floor(terminalContainer.clientHeight / 18));
          terminalInstance.resize(cols, rows);
        }
      } catch {
        // xterm can be measured before the terminal tab has completed its layout.
      }
    });
  });
}

function initializeTerminal() {
  if (terminalInstance) return true;
  const TerminalConstructor = window.Terminal;
  if (!TerminalConstructor) {
    terminalState = "error";
    refreshTerminalLabels();
    return false;
  }

  terminalInstance = new TerminalConstructor({
    cursorBlink: true,
    convertEol: true,
    scrollback: 5000,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 14,
    theme: {
      background: "#101a18",
      foreground: "#d9e8e1",
      cursor: "#c7f36b",
      selectionBackground: "#385b49",
    },
  });
  terminalInstance.open(terminalContainer);

  const FitAddonConstructor = window.FitAddon?.FitAddon;
  if (FitAddonConstructor) {
    terminalFitAddon = new FitAddonConstructor();
    terminalInstance.loadAddon(terminalFitAddon);
  }

  terminalInstance.onData((data) => {
    if (terminalSocket?.readyState === WebSocket.OPEN) {
      terminalSocket.send(JSON.stringify({ type: "input", data }));
    }
  });
  terminalInstance.onResize(({ cols, rows }) => {
    if (terminalSocket?.readyState === WebSocket.OPEN) {
      terminalSocket.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  });
  if (typeof ResizeObserver !== "undefined") {
    const terminalResizeObserver = new ResizeObserver(() => fitTerminal());
    terminalResizeObserver.observe(terminalContainer);
    terminalResizeObserver.observe(terminalView);
  }
  window.addEventListener("resize", fitTerminal);
  window.visualViewport?.addEventListener("resize", fitTerminal);
  fitTerminal();
  return true;
}

function closeTerminalSocket() {
  const socket = terminalSocket;
  terminalSocket = null;
  if (!socket) return;
  socket.onclose = null;
  socket.onerror = null;
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
}

function connectTerminalSession(connection) {
  if (!connection || !initializeTerminal()) return;
  closeTerminalSocket();
  const attempt = ++terminalConnectionAttempt;
  terminalState = "connecting";
  refreshTerminalLabels();
  terminalInstance.clear();

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  let socket;
  try {
    socket = new WebSocket(`${protocol}//${window.location.host}/api/terminal`);
  } catch (error) {
    terminalState = "error";
    refreshTerminalLabels();
    terminalInstance.writeln(`\r\n${t("terminal.connectionError")} ${error instanceof Error ? error.message : ""}`);
    return;
  }
  terminalSocket = socket;

  socket.addEventListener("open", () => {
    if (attempt !== terminalConnectionAttempt || socket !== terminalSocket) return;
    socket.send(JSON.stringify({ type: "connect", connection }));
  });
  socket.addEventListener("message", (event) => {
    if (attempt !== terminalConnectionAttempt || socket !== terminalSocket) return;
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === "output") {
      terminalInstance?.write(String(message.data ?? ""));
    } else if (message.type === "ready") {
      terminalState = "connected";
      refreshTerminalLabels();
      fitTerminal();
      terminalInstance?.focus();
    } else if (message.type === "error") {
      terminalState = "error";
      refreshTerminalLabels();
      terminalInstance?.writeln(`\r\n${t("terminal.connectionError")} ${String(message.message ?? "")}`);
    } else if (message.type === "closed") {
      terminalState = "closed";
      refreshTerminalLabels();
      terminalInstance?.writeln(`\r\n\r\n${t("terminal.disconnected")}`);
    }
  });
  socket.addEventListener("error", () => {
    if (attempt !== terminalConnectionAttempt || socket !== terminalSocket) return;
    terminalState = "error";
    refreshTerminalLabels();
  });
  socket.addEventListener("close", () => {
    if (attempt !== terminalConnectionAttempt || socket !== terminalSocket) return;
    terminalSocket = null;
    if (terminalState !== "error") terminalState = "closed";
    refreshTerminalLabels();
  });
}

terminalReconnect.addEventListener("click", () => {
  if (activeConnectionPayload) connectTerminalSession(activeConnectionPayload);
});

function setExpandedView(expanded) {
  resultsPanel.classList.toggle("expanded", expanded);
  document.body.classList.toggle("view-expanded", expanded);
  expandViewButton.setAttribute("aria-expanded", String(expanded));
  expandViewButton.title = expanded ? t("ui.closeExpanded") : t("ui.expandTable");
  expandViewLabel.textContent = expanded ? t("ui.closeView") : t("ui.expandView");
  expandViewButton.querySelector("span").textContent = expanded ? "×" : "⛶";
}

expandViewButton.addEventListener("click", () => {
  setExpandedView(!resultsPanel.classList.contains("expanded"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && resultsPanel.classList.contains("expanded")) {
    setExpandedView(false);
  }
});

function setAuthFields() {
  const useKey = authType.value === "privateKey";
  passwordField.classList.toggle("hidden", useKey);
  privateKeyField.classList.toggle("hidden", !useKey);
  passphraseField.classList.toggle("hidden", !useKey);
  passwordField.querySelector("input").required = !useKey;
  privateKeyField.querySelector("textarea").required = useKey;
}

function escapeText(value) {
  return String(value ?? "");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return t("files.noDate");
  const locale = currentLanguage === "de" ? "de-DE" : currentLanguage === "en" || currentLanguage === "tlh" ? "en-US" : "pl-PL";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function connectionPayload() {
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.port = Number(payload.port);
  return payload;
}

function cleanRuleValue(value) {
  return String(value ?? "").replace(/[{};\r\n]/g, " ").replace(/\s+/g, " ").trim();
}

function serializeRules(rules) {
  return rules.map((rule) => {
    const name = cleanRuleValue(rule.name) || "unnamed";
    const conditionValue = String(rule.condition ?? "").trim().toLowerCase();
    const condition = ["if", "if match all", "if match any"].includes(conditionValue) ? conditionValue : "if";
    const lines = [`entry ${name} {`, `    ${condition} {`];
    const fields = [
      ["sourceAddress", "source-address"],
      ["destinationAddress", "destination-address"],
      ["protocol", "protocol"],
      ["sourcePort", "source-port"],
      ["destinationPort", "destination-port"],
    ];
    for (const [property, label] of fields) {
      const value = cleanRuleValue(rule[property]);
      if (value) lines.push(`        ${label} ${value};`);
    }
    lines.push("    }");
    const action = String(rule.action ?? "").trim().toLowerCase();
    if (action === "permit" || action === "deny") {
      lines.push("    then {");
      lines.push(`        ${action};`);
      lines.push("    }");
    }
    lines.push("}");
    return lines.join("\n");
  }).join("\n\n") + "\n";
}

function currentPolicyContent() {
  return editMode && draftRules ? serializeRules(draftRules) : selectedFile?.content ?? "";
}

function createEmptyRule() {
  return {
    line: 0,
    name: "",
    condition: "",
    sourceAddress: "",
    sourcePort: "",
    destinationAddress: "",
    destinationPort: "",
    protocol: "",
    action: "",
  };
}

function refreshGeneratedRaw() {
  const rawPanel = fileDetail?.querySelector("#raw-panel");
  if (rawPanel) rawPanel.textContent = currentPolicyContent();
}

function showUploadStatus(message, isError = false) {
  const status = fileDetail.querySelector("#upload-status");
  if (!status) return;
  status.classList.remove("hidden", "upload-success", "upload-error");
  status.classList.add(isError ? "upload-error" : "upload-success");
  status.textContent = message;
}

async function uploadEditedPolicy() {
  if (!selectedFile || !draftRules) return;
  const uploadButton = fileDetail.querySelector("#upload-button");
  uploadButton.disabled = true;
  uploadButton.textContent = t("detail.uploadInProgress");
  try {
    const payload = connectionPayload();
    payload.policyName = selectedFile.name;
    payload.directions = selectedFile.directions ?? [];
    payload.content = serializeRules(draftRules);
    const response = await fetch("/api/pol-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.details ? `${data.error} (${data.details})` : data.error);
    showUploadStatus(t("detail.uploadSuccess", { name: data.name }), false);
    resultMeta.textContent = t("detail.lastUpload", { name: data.name });
  } catch (error) {
    showUploadStatus(localizeServerError(error instanceof Error ? error.message : t("detail.uploadUnknownError")), true);
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = t("detail.upload");
  }
}

function setLoading(loading) {
  button.disabled = loading;
  button.classList.toggle("loading", loading);
  buttonLabel.textContent = loading ? t("connection.connecting") : t("connection.connect");
}

function showError(message) {
  lastErrorMessage = String(message ?? "");
  emptyState.classList.add("hidden");
  loadedView.classList.add("hidden");
  errorState.classList.remove("hidden");
  errorMessage.textContent = localizeServerError(lastErrorMessage);
  resultMeta.textContent = t("error.connection");
}

function renderStats() {
  const totals = files.reduce((acc, file) => {
    acc.lines += file.parsed.stats.lines;
    acc.rules += file.parsed.stats.rules;
    acc.size += file.size;
    return acc;
  }, { lines: 0, rules: 0, size: 0 });
  statsRow.innerHTML = "";
  const stats = [
    [t("stats.files"), files.length],
    [t("stats.rules"), totals.rules],
    [t("stats.lines"), totals.lines],
    [t("stats.size"), formatBytes(totals.size)],
  ];
  for (const [label, value] of stats) {
    const item = document.createElement("div");
    item.className = "stat-card";
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    statsRow.append(item);
  }
}

function renderFileList() {
  fileList.innerHTML = "";
  fileCount.textContent = files.length;
  if (!files.length) {
    const noFiles = document.createElement("div");
    noFiles.className = "no-files";
    noFiles.textContent = t("files.noFiles");
    fileList.append(noFiles);
    return;
  }

  for (const file of files) {
    const item = document.createElement("button");
    item.className = `file-item${selectedFile?.name === file.name ? " active" : ""}`;
    item.type = "button";
    item.innerHTML = `<span class="file-icon">POL</span><span class="file-item-copy"><strong></strong><small></small></span><span class="file-chevron">›</span>`;
    item.querySelector("strong").textContent = file.name;
    item.querySelector("small").textContent = `${formatBytes(file.size)} · ${t("files.rules", { count: file.parsed.stats.rules })}`;
    item.addEventListener("click", () => {
      selectedFile = file;
      editMode = false;
      draftRules = null;
      renderFileList();
      renderDetail();
    });
    fileList.append(item);
  }
}

function renderDetail() {
  if (!selectedFile) {
    fileDetail.innerHTML = `<div class="detail-placeholder">${t("files.placeholder")}</div>`;
    return;
  }

  fileDetail.innerHTML = `
    <div class="detail-head">
      <div><span class="file-icon large">POL</span><div class="detail-title"><div class="policy-title-row"><h3></h3><span class="direction-badge"><span>${t("detail.direction")}</span><strong id="policy-direction"></strong></span></div><p></p></div></div>
      <div class="detail-actions">
        <button class="edit-mode-button expanded-only" type="button" id="edit-mode-button">${editMode ? t("detail.finishEditing") : t("detail.editFields")}</button>
        <button class="upload-button expanded-only${editMode ? "" : " hidden"}" type="button" id="upload-button">${t("detail.upload")}</button>
        <button class="copy-button" type="button" id="copy-button">${t("detail.copyRaw")}</button>
      </div>
    </div>
    <div class="upload-status hidden" id="upload-status" aria-live="polite"></div>
    <div class="detail-tabs"><button class="detail-tab active" data-tab="structured">${t("detail.readable")}</button><button class="detail-tab" data-tab="graph">${t("detail.graph")}</button><button class="detail-tab" data-tab="raw">${t("detail.original")}</button></div>
    <div class="tab-panel" id="structured-panel"></div>
    <div class="tab-panel hidden" id="graph-panel"></div>
    <pre class="raw-panel hidden" id="raw-panel"></pre>`;
  fileDetail.querySelector("h3").textContent = selectedFile.name;
  fileDetail.querySelector("#policy-direction").textContent = selectedFile.directions?.length ? selectedFile.directions.join(" / ") : "—";
  fileDetail.querySelector("p").textContent = `${selectedFile.path} · ${formatDate(selectedFile.modifiedAt)} · ${formatBytes(selectedFile.size)}`;
  fileDetail.querySelector("#raw-panel").textContent = currentPolicyContent();
  renderStructured();

  fileDetail.querySelector("#edit-mode-button").addEventListener("click", () => {
    if (!editMode) {
      draftRules = selectedFile.parsed.rules.map((rule) => ({ ...rule }));
      editMode = true;
    } else {
      editMode = false;
    }
    renderDetail();
  });
  fileDetail.querySelector("#upload-button").addEventListener("click", uploadEditedPolicy);

  fileDetail.querySelectorAll(".detail-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      fileDetail.querySelectorAll(".detail-tab").forEach((element) => element.classList.remove("active"));
      tab.classList.add("active");
      const selectedTab = tab.dataset.tab;
      fileDetail.querySelector("#structured-panel").classList.toggle("hidden", selectedTab !== "structured");
      fileDetail.querySelector("#graph-panel").classList.toggle("hidden", selectedTab !== "graph");
      fileDetail.querySelector("#raw-panel").classList.toggle("hidden", selectedTab !== "raw");
      if (selectedTab === "graph") renderGraph();
    });
  });
  fileDetail.querySelector("#copy-button").addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(currentPolicyContent());
    event.currentTarget.textContent = t("detail.copied");
    setTimeout(() => { event.currentTarget.textContent = t("detail.copyRaw"); }, 1600);
  });
}

function renderStructured() {
  const panel = fileDetail.querySelector("#structured-panel");
  panel.innerHTML = "";
  const search = document.createElement("input");
  search.className = "entry-search";
  search.placeholder = t("table.searchPlaceholder");
  search.setAttribute("aria-label", t("table.searchAria"));
  const structuredToolbar = document.createElement("div");
  structuredToolbar.className = "structured-toolbar";
  structuredToolbar.append(search);
  if (editMode) {
    const addRuleButton = document.createElement("button");
    addRuleButton.className = "add-rule-button";
    addRuleButton.type = "button";
    addRuleButton.textContent = t("table.addAtEnd");
    addRuleButton.addEventListener("click", () => {
      draftRules.push(createEmptyRule());
      refreshGeneratedRaw();
      renderStructured();
    });
    structuredToolbar.append(addRuleButton);
  }
  panel.append(structuredToolbar);

  const tableScroll = document.createElement("div");
  tableScroll.className = "rules-table-scroll";
  tableScroll.innerHTML = `
    <div class="rules-table">
      <div class="rule-grid rule-header${editMode ? " editable" : ""}">
        <span>${t("table.line")}</span><span>${t("table.name")}</span><span>${t("table.condition")}</span><span>${t("table.sourceAddress")}</span>
        <span>${t("table.sourcePort")}</span><span>${t("table.destinationAddress")}</span><span>${t("table.destinationPort")}</span>
        <span>${t("table.protocol")}</span><span>${t("table.action")}</span>${editMode ? `<span>${t("table.operations")}</span>` : ""}
      </div>
      <div class="rules-body"></div>
    </div>`;
  panel.append(tableScroll);
  const rulesBody = tableScroll.querySelector(".rules-body");
  const fields = [
    ["line", t("table.line")],
    ["name", t("table.name")],
    ["condition", t("table.condition")],
    ["sourceAddress", t("table.sourceAddress")],
    ["sourcePort", t("table.sourcePort")],
    ["destinationAddress", t("table.destinationAddress")],
    ["destinationPort", t("table.destinationPort")],
    ["protocol", t("table.protocol")],
    ["action", t("table.action")],
  ];

  const draw = () => {
    rulesBody.innerHTML = "";
    const query = search.value.toLowerCase().trim();
    let visible = 0;
    const rules = editMode ? draftRules : selectedFile.parsed.rules;
    for (const [ruleIndex, rule] of rules.entries()) {
      const searchable = Object.values(rule).join(" ").toLowerCase();
      if (query && !searchable.includes(query)) continue;
      visible += 1;
      const row = document.createElement("div");
      row.className = `rule-grid rule-row${editMode ? " editable" : ""}`;
      for (const [field, label] of fields) {
        const cell = document.createElement("span");
        cell.className = `rule-cell rule-${field}`;
        cell.dataset.label = label;
        const value = rule[field] ?? "";
        if (!editMode || field === "line") {
          cell.textContent = field === "line" && value ? String(value).padStart(3, "0") : value;
        } else if (field === "condition" || field === "action") {
          const select = document.createElement("select");
          select.className = "rule-editor-input";
          const options = field === "condition" ? ["", "if", "if match all", "if match any"] : ["", "permit", "deny"];
          for (const option of options) {
            const element = document.createElement("option");
            element.value = option;
            element.textContent = option || t("table.empty");
            select.append(element);
          }
          select.value = value;
          select.addEventListener("change", () => {
            rule[field] = select.value;
            refreshGeneratedRaw();
          });
          cell.append(select);
        } else {
          const input = document.createElement("input");
          input.className = "rule-editor-input";
          input.value = value;
          input.addEventListener("input", () => {
            rule[field] = input.value;
            refreshGeneratedRaw();
          });
          cell.append(input);
        }
        if (field === "action" && rule.action) cell.classList.add(`action-${rule.action}`);
        row.append(cell);
      }
      if (editMode) {
        const operations = document.createElement("span");
        operations.className = "rule-cell rule-operations";

        const insertBefore = document.createElement("button");
        insertBefore.className = "row-operation-button insert-button";
        insertBefore.type = "button";
        insertBefore.textContent = "+↑";
        insertBefore.title = t("table.addBefore");
        insertBefore.addEventListener("click", () => {
          draftRules.splice(ruleIndex, 0, createEmptyRule());
          refreshGeneratedRaw();
          renderStructured();
        });

        const insertAfter = document.createElement("button");
        insertAfter.className = "row-operation-button insert-button";
        insertAfter.type = "button";
        insertAfter.textContent = "+↓";
        insertAfter.title = t("table.addAfter");
        insertAfter.addEventListener("click", () => {
          draftRules.splice(ruleIndex + 1, 0, createEmptyRule());
          refreshGeneratedRaw();
          renderStructured();
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "row-operation-button delete-button";
        deleteButton.type = "button";
        deleteButton.textContent = "×";
        deleteButton.title = t("table.delete");
        deleteButton.addEventListener("click", () => {
          const ruleName = rule.name?.trim() || `${t("table.line")} ${ruleIndex + 1}`;
          if (!window.confirm(t("table.deleteConfirm", { name: ruleName }))) return;
          draftRules.splice(ruleIndex, 1);
          refreshGeneratedRaw();
          renderStructured();
        });

        operations.append(insertBefore, insertAfter, deleteButton);
        row.append(operations);
      }
      rulesBody.append(row);
    }
    if (!visible) {
      const empty = document.createElement("div");
      empty.className = "no-matches";
      empty.textContent = t("table.noMatches");
      rulesBody.append(empty);
    }
  };
  search.addEventListener("input", draw);
  draw();
}

const GRAPH_COLORS = ["#c7f36b", "#ff9b61", "#8ed0c0", "#98a9ff", "#d1a7ff", "#e2c45d"];
const DENY_GRAPH_COLOR = "#ff3347";

function graphValue(value) {
  return String(value ?? "").trim() || t("graph.any");
}

function toGraphConnection(rule, index, policyName = "") {
  const source = {
    ip: graphValue(rule.sourceAddress),
    port: graphValue(rule.sourcePort),
    protocol: graphValue(rule.protocol),
  };
  const destination = {
    ip: graphValue(rule.destinationAddress),
    port: graphValue(rule.destinationPort),
    protocol: graphValue(rule.protocol),
  };
  return {
    rule,
    index,
    policyName,
    color: String(rule.action ?? "").trim().toLowerCase() === "deny"
      ? DENY_GRAPH_COLOR
      : GRAPH_COLORS[index % GRAPH_COLORS.length],
    source,
    destination,
    sourceKey: `${source.ip}|${source.port}|${source.protocol}`,
    destinationKey: `${destination.ip}|${destination.port}|${destination.protocol}`,
  };
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function drawConnectionGraph(svg, stage, hoverCard, connections) {
  stage.classList.remove("is-hovering");
  hoverCard.classList.add("hidden");
  svg.replaceChildren();
  const width = 1200;
  const nodeGap = 82;
  const height = Math.max(480, Math.max(connections.length, 1) * nodeGap + 150);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("height", String(height));

  const title = svgElement("title");
  title.textContent = t("graph.title");
  svg.append(title);

  const sourceNodes = [];
  const destinationNodes = [];
  const sourceIndex = new Map();
  const destinationIndex = new Map();
  for (const connection of connections) {
    if (!sourceIndex.has(connection.sourceKey)) {
      sourceIndex.set(connection.sourceKey, sourceNodes.length);
      sourceNodes.push(connection.source);
    }
    if (!destinationIndex.has(connection.destinationKey)) {
      destinationIndex.set(connection.destinationKey, destinationNodes.length);
      destinationNodes.push(connection.destination);
    }
  }

  const yFor = (index, count) => 92 + ((height - 150) * (index + 1)) / (count + 1);
  const sourceX = 260;
  const destinationX = width - 260;
  const links = svgElement("g", { class: "graph-links" });
  const nodes = svgElement("g", { class: "graph-nodes" });
  svg.append(links, nodes);

  const nodePosition = (key, side) => {
    const list = side === "source" ? sourceNodes : destinationNodes;
    const indexes = side === "source" ? sourceIndex : destinationIndex;
    const index = indexes.get(key);
    return {
      x: side === "source" ? sourceX : destinationX,
      y: yFor(index, list.length),
    };
  };

  const setHover = (connection, active) => {
    stage.classList.toggle("is-hovering", active);
    links.querySelectorAll(".graph-connection").forEach((element) => {
      element.classList.toggle("is-highlighted", active && element.dataset.index === String(connection?.index));
    });
    nodes.querySelectorAll(".graph-node").forEach((element) => {
      const related = active && (element.dataset.key === connection.sourceKey || element.dataset.key === connection.destinationKey);
      element.classList.toggle("is-related", Boolean(related));
    });
    if (!active) {
      hoverCard.classList.add("hidden");
      return;
    }
    hoverCard.querySelector("[data-hover='policy']").textContent = connection.policyName || "—";
    hoverCard.querySelector("[data-hover='rule']").textContent = connection.rule.name || t("graph.rule", { index: connection.index + 1 });
    hoverCard.querySelector("[data-hover='source']").textContent = `${connection.source.ip} · ${t("graph.portLabel")} ${connection.source.port} · ${connection.source.protocol}`;
    hoverCard.querySelector("[data-hover='destination']").textContent = `${connection.destination.ip} · ${t("graph.portLabel")} ${connection.destination.port} · ${connection.destination.protocol}`;
    hoverCard.querySelector("[data-hover='action']").textContent = connection.rule.action || "—";
    hoverCard.classList.remove("hidden");
  };

  for (const connection of connections) {
    const sourcePosition = nodePosition(connection.sourceKey, "source");
    const destinationPosition = nodePosition(connection.destinationKey, "destination");
    const bend = ((connection.index % 5) - 2) * 18;
    const midpoint = width / 2;
    const group = svgElement("g", {
      class: "graph-connection",
      "data-index": String(connection.index),
      "data-source-key": connection.sourceKey,
      "data-destination-key": connection.destinationKey,
    });
    const path = svgElement("path", {
      class: "graph-connection-line",
      d: `M ${sourcePosition.x} ${sourcePosition.y} C ${midpoint - 150} ${sourcePosition.y + bend}, ${midpoint + 150} ${destinationPosition.y - bend}, ${destinationPosition.x} ${destinationPosition.y}`,
      stroke: connection.color,
      "stroke-width": "3",
      fill: "none",
      "vector-effect": "non-scaling-stroke",
    });
    const lineTitle = svgElement("title");
    lineTitle.textContent = `${connection.policyName ? `${connection.policyName} · ` : ""}${connection.source.ip}:${connection.source.port} ${connection.source.protocol} → ${connection.destination.ip}:${connection.destination.port} ${connection.destination.protocol}`;
    group.append(path, lineTitle);
    group.addEventListener("mouseenter", () => setHover(connection, true));
    group.addEventListener("mouseleave", () => setHover(connection, false));
    links.append(group);
  }

  const drawNode = (node, side, index, count) => {
    const x = side === "source" ? sourceX : destinationX;
    const y = yFor(index, count);
    const group = svgElement("g", {
      class: `graph-node graph-node-${side}`,
      "data-key": `${node.ip}|${node.port}|${node.protocol}`,
    });
    const circle = svgElement("circle", { cx: String(x), cy: String(y), r: "9" });
    const ip = svgElement("text", {
      x: String(side === "source" ? x - 20 : x + 20),
      y: String(y - 4),
      "text-anchor": side === "source" ? "end" : "start",
      class: "graph-node-ip",
    });
    ip.textContent = node.ip;
    const meta = svgElement("text", {
      x: String(side === "source" ? x - 20 : x + 20),
      y: String(y + 17),
      "text-anchor": side === "source" ? "end" : "start",
      class: "graph-node-meta",
    });
    meta.textContent = `${t("graph.portLabel")} ${node.port} · ${node.protocol}`;
    group.append(circle, ip, meta);
    nodes.append(group);
  };

  sourceNodes.forEach((node, index) => drawNode(node, "source", index, sourceNodes.length));
  destinationNodes.forEach((node, index) => drawNode(node, "destination", index, destinationNodes.length));
}

function renderGraph() {
  const panel = fileDetail.querySelector("#graph-panel");
  if (!panel || !selectedFile) return;
  const rules = editMode && draftRules ? draftRules : selectedFile.parsed.rules;
  const connections = rules.map((rule, index) => toGraphConnection(rule, index, selectedFile.name));
  panel.innerHTML = `
    <div class="graph-toolbar">
      <label class="graph-filter"><span>${t("graph.ipLabel")}</span><input id="graph-ip-filter" placeholder="${t("graph.ipPlaceholder")}" /></label>
      <label class="graph-filter"><span>${t("graph.portField")}</span><input id="graph-port-filter" placeholder="${t("graph.portPlaceholder")}" /></label>
      <label class="graph-filter"><span>${t("graph.protocolLabel")}</span><input id="graph-protocol-filter" placeholder="${t("graph.protocolPlaceholder")}" /></label>
      <span class="graph-result-count" id="graph-result-count"></span>
    </div>
    <div class="graph-stage" id="graph-stage">
      <div class="graph-side-label graph-side-source">${t("graph.sourceSide")}</div><div class="graph-side-label graph-side-destination">${t("graph.destinationSide")}</div>
      <svg class="connection-graph" role="img" aria-label="${t("graph.aria")}"></svg>
      <div class="graph-hover-card hidden" role="tooltip">
        <span><b>${t("graph.policy")}</b><em data-hover="policy"></em></span>
        <strong data-hover="rule"></strong>
        <span><b>${t("graph.source")}</b><em data-hover="source"></em></span>
        <span><b>${t("graph.destination")}</b><em data-hover="destination"></em></span>
        <span><b>${t("graph.action")}</b><em data-hover="action"></em></span>
      </div>
      <div class="graph-empty hidden" id="graph-empty">${t("graph.empty")}</div>
    </div>`;

  const state = { ip: "", port: "", protocol: "" };
  const svg = panel.querySelector(".connection-graph");
  const stage = panel.querySelector("#graph-stage");
  const hoverCard = panel.querySelector(".graph-hover-card");
  const resultCount = panel.querySelector("#graph-result-count");
  const empty = panel.querySelector("#graph-empty");
  const inputs = {
    ip: panel.querySelector("#graph-ip-filter"),
    port: panel.querySelector("#graph-port-filter"),
    protocol: panel.querySelector("#graph-protocol-filter"),
  };

  const draw = () => {
    const visible = connections.filter((connection) => {
      const ip = `${connection.source.ip} ${connection.destination.ip}`.toLowerCase();
      const port = `${connection.source.port} ${connection.destination.port}`.toLowerCase();
      const protocol = `${connection.source.protocol} ${connection.destination.protocol}`.toLowerCase();
      return (!state.ip || ip.includes(state.ip)) && (!state.port || port.includes(state.port)) && (!state.protocol || protocol.includes(state.protocol));
    });
    resultCount.textContent = t("graph.count", { visible: visible.length, total: connections.length });
    empty.classList.toggle("hidden", visible.length > 0);
    drawConnectionGraph(svg, stage, hoverCard, visible);
  };

  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener("input", () => {
      state[key] = input.value.toLowerCase().trim();
      draw();
    });
  }
  draw();
}

function renderSuperFilterView() {
  superFilterInitialized = true;
  superFilterView.innerHTML = `
    <div class="super-filter-header">
      <div>
        <span class="section-kicker">${t("superFilter.kicker")}</span>
        <h2>${t("superFilter.title")}</h2>
        <p>${t("superFilter.description")}</p>
      </div>
      <button class="super-filter-visualize" id="super-filter-visualize" type="button" disabled>${t("superFilter.map")}</button>
    </div>
    <form class="super-filter-form" id="super-filter-form">
      <label class="graph-filter"><span>${t("graph.ipLabel")}</span><input id="super-filter-ip" placeholder="${t("graph.ipPlaceholder")}" /></label>
      <label class="graph-filter"><span>${t("graph.portField")}</span><input id="super-filter-port" placeholder="${t("graph.portPlaceholder")}" /></label>
      <label class="graph-filter"><span>${t("graph.protocolLabel")}</span><input id="super-filter-protocol" placeholder="${t("graph.protocolPlaceholder")}" /></label>
      <button class="primary-button super-filter-search" type="submit"><span class="button-icon">⌕</span>${t("superFilter.search")}</button>
    </form>
    <div class="super-filter-result-meta" id="super-filter-result-meta">${t("superFilter.noQuery")}</div>
    <div class="super-filter-results" id="super-filter-results">
      <div class="super-filter-empty">${t("superFilter.initial")}</div>
    </div>
    <div class="super-filter-graph hidden" id="super-filter-graph"></div>`;

  const formElement = superFilterView.querySelector("#super-filter-form");
  const resultMeta = superFilterView.querySelector("#super-filter-result-meta");
  const resultsElement = superFilterView.querySelector("#super-filter-results");
  const visualizeButton = superFilterView.querySelector("#super-filter-visualize");
  const graphElement = superFilterView.querySelector("#super-filter-graph");
  const filters = {
    ip: superFilterView.querySelector("#super-filter-ip"),
    port: superFilterView.querySelector("#super-filter-port"),
    protocol: superFilterView.querySelector("#super-filter-protocol"),
  };

  const allRules = () => files.flatMap((file) => file.parsed.rules.map((rule) => ({
    rule,
    policyName: file.name,
    directions: file.directions ?? [],
  })));

  const renderRows = (results) => {
    resultsElement.innerHTML = `
      <div class="super-filter-table-wrap">
        <div class="super-filter-table">
          <div class="super-rule-grid super-rule-header"><span>${t("superFilter.policy")}</span><span>${t("superFilter.line")}</span><span>${t("superFilter.name")}</span><span>${t("superFilter.condition")}</span><span>${t("superFilter.sourceAddress")}</span><span>${t("superFilter.sourcePort")}</span><span>${t("superFilter.destinationAddress")}</span><span>${t("superFilter.destinationPort")}</span><span>${t("superFilter.protocol")}</span><span>${t("superFilter.action")}</span></div>
          <div class="super-filter-body"></div>
        </div>
      </div>`;
    const body = resultsElement.querySelector(".super-filter-body");
    for (const item of results) {
      const row = document.createElement("div");
      row.className = "super-rule-grid super-rule-row";
      const values = [
        item.policyName,
        item.rule.line ? String(item.rule.line).padStart(3, "0") : "",
        item.rule.name,
        item.rule.condition,
        item.rule.sourceAddress,
        item.rule.sourcePort,
        item.rule.destinationAddress,
        item.rule.destinationPort,
        item.rule.protocol,
        item.rule.action,
      ];
      values.forEach((value, index) => {
        const cell = document.createElement("span");
        cell.textContent = value ?? "";
        cell.className = index === 9 ? `super-rule-action action-${String(value).toLowerCase()}` : "";
        row.append(cell);
      });
      body.append(row);
    }
  };

  const renderSuperFilterGraph = (results) => {
    graphElement.innerHTML = `
      <div class="graph-stage" id="super-filter-graph-stage">
        <div class="graph-side-label graph-side-source">${t("graph.sourceSide")}</div><div class="graph-side-label graph-side-destination">${t("graph.destinationSide")}</div>
        <svg class="connection-graph" role="img" aria-label="${t("superFilter.graphAria")}"></svg>
        <div class="graph-hover-card hidden" role="tooltip">
          <span><b>${t("graph.policy")}</b><em data-hover="policy"></em></span>
          <strong data-hover="rule"></strong>
          <span><b>${t("graph.source")}</b><em data-hover="source"></em></span>
          <span><b>${t("graph.destination")}</b><em data-hover="destination"></em></span>
          <span><b>${t("graph.action")}</b><em data-hover="action"></em></span>
        </div>
      </div>`;
    const stage = graphElement.querySelector("#super-filter-graph-stage");
    drawConnectionGraph(
      graphElement.querySelector(".connection-graph"),
      stage,
      graphElement.querySelector(".graph-hover-card"),
      results.map((item, index) => toGraphConnection(item.rule, index, item.policyName)),
    );
  };

  formElement.addEventListener("submit", (event) => {
    event.preventDefault();
    const filterValues = Object.fromEntries(Object.entries(filters).map(([key, input]) => [key, input.value.toLowerCase().trim()]));
    superFilterState.ip = filterValues.ip;
    superFilterState.port = filterValues.port;
    superFilterState.protocol = filterValues.protocol;
    superFilterState.hasSearched = true;
    superFilterState.graphVisible = false;
    const activeFilters = Object.values(filterValues).filter(Boolean);
    if (!activeFilters.length) {
      superFilterState.results = [];
      resultMeta.textContent = t("superFilter.missingFilter");
      resultsElement.innerHTML = `<div class="super-filter-empty">${t("superFilter.missingFilter")}</div>`;
      visualizeButton.disabled = true;
      graphElement.classList.add("hidden");
      visualizeButton.textContent = t("superFilter.map");
      return;
    }

    superFilterState.results = allRules().filter(({ rule }) => {
      const ip = `${rule.sourceAddress} ${rule.destinationAddress}`.toLowerCase();
      const port = `${rule.sourcePort} ${rule.destinationPort}`.toLowerCase();
      const protocol = String(rule.protocol ?? "").toLowerCase();
      return (filterValues.ip && ip.includes(filterValues.ip)) ||
        (filterValues.port && port.includes(filterValues.port)) ||
        (filterValues.protocol && protocol.includes(filterValues.protocol));
    });

    const policyCount = new Set(superFilterState.results.map((item) => item.policyName)).size;
    resultMeta.textContent = t("superFilter.result", { count: superFilterState.results.length, policies: policyCount });
    visualizeButton.disabled = superFilterState.results.length === 0;
    graphElement.classList.add("hidden");
    visualizeButton.textContent = t("superFilter.map");
    if (superFilterState.results.length) renderRows(superFilterState.results);
    else resultsElement.innerHTML = `<div class="super-filter-empty">${t("superFilter.noMatches")}</div>`;
  });

  visualizeButton.addEventListener("click", () => {
    const hidden = graphElement.classList.contains("hidden");
    graphElement.classList.toggle("hidden", !hidden);
    superFilterState.graphVisible = hidden;
    visualizeButton.textContent = hidden ? t("superFilter.hideMap") : t("superFilter.map");
    if (hidden) renderSuperFilterGraph(superFilterState.results);
  });

  filters.ip.value = superFilterState.ip;
  filters.port.value = superFilterState.port;
  filters.protocol.value = superFilterState.protocol;
  if (superFilterState.hasSearched) {
    const policyCount = new Set(superFilterState.results.map((item) => item.policyName)).size;
    const hasActiveFilters = Boolean(superFilterState.ip || superFilterState.port || superFilterState.protocol);
    resultMeta.textContent = superFilterState.results.length
      ? t("superFilter.result", { count: superFilterState.results.length, policies: policyCount })
      : hasActiveFilters ? t("superFilter.noMatches") : t("superFilter.missingFilter");
    visualizeButton.disabled = superFilterState.results.length === 0;
    if (superFilterState.results.length) renderRows(superFilterState.results);
    else resultsElement.innerHTML = `<div class="super-filter-empty">${hasActiveFilters ? t("superFilter.noMatches") : t("superFilter.missingFilter")}</div>`;
    if (superFilterState.graphVisible && superFilterState.results.length) {
      graphElement.classList.remove("hidden");
      visualizeButton.textContent = t("superFilter.hideMap");
      renderSuperFilterGraph(superFilterState.results);
    }
  }
}

authType.addEventListener("change", setAuthFields);
setAuthFields();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoading(true);
  errorState.classList.add("hidden");
  try {
    const formData = new FormData(form);
    const payload = connectionPayload();
    const response = await fetch("/api/pol-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.details ? `${data.error} (${data.details})` : data.error);
    activeConnectionPayload = payload;
    closeTerminalSocket();
    terminalState = "idle";
    files = data.files;
    selectedFile = files[0] ?? null;
    editMode = false;
    draftRules = null;
    emptyState.classList.add("hidden");
    errorState.classList.add("hidden");
    superFilterInitialized = false;
    superFilterView.innerHTML = "";
    superFilterState = { ip: "", port: "", protocol: "", results: [], hasSearched: false, graphVisible: false };
    workspaceTabs.classList.remove("hidden");
    setWorkspaceTab("policies");
    connectTerminalSession(activeConnectionPayload);
    loadedView.classList.remove("hidden");
    resultMeta.textContent = `${data.host} · ${data.directory}`;
    renderStats();
    renderFileList();
    renderDetail();
  } catch (error) {
    showError(error instanceof Error ? error.message : t("error.unknown"));
  } finally {
    setLoading(false);
  }
});
