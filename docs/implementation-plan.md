# Umsetzungsplan

## Technische Leitidee

Das Plugin wird als TypeScript-Projekt mit gebuendeltem Single-File-Output entwickelt. Die Wirtschaftssimulation bleibt dabei moeglichst rein und testbar, waehrend OpenRCT2-spezifische Hooks, Storage-Zugriffe und UI in separaten Schichten liegen.

## Zielstruktur

```text
OpenRCT2-WorldParkLeague/
  docs/
  scripts/
    build.mjs
    install-plugin.ps1
  src/
    index.ts
    config.ts
    types.ts
    domain/
    state/
    ui/
  tests/
  dist/
```

## Plugin-Architektur

### 1. State Layer

Persistenter Zustand pro Save ueber `context.getParkStorage()`.

Zu speichern:

- globale Weltlage
- Konkurrenzparks
- News-Historie
- Spieler-Beteiligungen
- letzter simulierter Monat
- Award-Status
- temporare Event-Modifikatoren

### 2. Simulation Layer

Monatliche Aktualisierung der Welt.

Ausloeser:

- Vergleich von `date.monthsElapsed`
- nur simulieren, wenn ein neuer Monat begonnen hat

Aufgaben:

- globale Wirtschaft updaten
- Events ausrollen
- Rivalen simulieren
- Marktanteile neu berechnen
- Spielerbonus neu bestimmen
- News schreiben

Aktueller Stand:

- implementiert
- durch Unit-Tests fuer Rivalen-Generator und Monats-Simulation abgesichert
- ergaenzt um schnellere Live-Pulses zwischen den Monats-Simulationen fuer haeufigere League-Updates
- taegliche Daten-Pulses jetzt von woechentlichen Live-Event-Fenstern getrennt, damit Bewegungen smooth bleiben

### 3. Integration Layer

OpenRCT2-Hooks und Spielwirkung.

Geplante Integrationen:

- `interval.day` fuer Monatswechsel-Erkennung
- `park.guest.softcap.calculate` fuer Markt-/Ranking-Effekt auf Besucher
- `park.postMessage(...)` fuer News-Meldungen
- `ui.registerMenuItem(...)` fuer Plugin-Zugang

Aktueller Stand:

- `interval.day` implementiert
- `park.guest.softcap.calculate` implementiert
- `ui.registerMenuItem(...)` implementiert

### 4. UI Layer

Ein Hauptfenster mit:

- Leaderboard
- Newsfeed
- Spielereffekten
- Vergleichsansicht gegen Zielparks
- Investment- und Portfolio-Zugriff direkt im Ligafenster

Version 1 soll funktional sein, nicht luxurioes.

Aktueller Stand:

- operatives League-Fenster mit vollem Leaderboard, Rivalen-Details, Vergleichsansicht, Portfolio und News implementiert
- Governance-Zeilen fuer Board-, Investor- und Mandatsstatus implementiert
- flexible Investment-Aktionen mit 5/10/15%-Kaeufen, Teilverkaeufen und Einflussstufen implementiert
- manuelle Simulations-/Reset-Steuerung aus dem Produktions-UI entfernt; das Fenster laeuft mit der echten Spielzeit mit

## Phasen

## Phase 0: Repo und Spezifikation

Ergebnis:

- Dokumentation steht
- TypeScript-Tooling steht
- Install-Skript existiert
- Tests und Build laufen

## Phase 1: Persistenter Weltzustand

Aufgaben:

- Initialzustand erzeugen
- Rivalenliste generieren
- Regionen, Tiers und Startwerte definieren
- Parkdaten im Save speichern

Definition of done:

- neues Save bekommt ein stabiles World-State-Objekt
- Reload verliert keine Wirtschaftsdaten

Status:

- erledigt

## Phase 2: Monatssimulation

Aufgaben:

- Monatswechsel erkennen
- globale Nachfrage berechnen
- Rivalen fortschreiben
- Rangliste erzeugen
- News-Eintraege erstellen

Definition of done:

- jede Ingame-Monatswende produziert konsistente Updates

Status:

- als erste produktionsfaehige Version umgesetzt

## Phase 3: Spielerintegration

Aufgaben:

- Spieler-Score aus echten Parkdaten berechnen
- Rank-basierten Guest-Cap-Modifikator anwenden
- Award- und Event-Boni einrechnen

Definition of done:

- der Spieler spuert die Konkurrenz direkt im Parkfluss

Status:

- erste Version umgesetzt

## Phase 4: UI

Aufgaben:

- Hauptfenster mit Leaderboard
- News-Liste
- Details fuer selektierten Rivalen
- Anzeige der aktuellen Spielerboni

Definition of done:

- wichtigste Weltinfos sind im Spiel lesbar

Status:

- erste Version umgesetzt

## Phase 5: Investments und Mergers

Aufgaben:

- einfache Beteiligungen
- Dividenden und Verluste
- Mergers, Insolvenzen, Uebernahmen
- News-Verknuepfung

Definition of done:

- das Meta-Game besitzt echte strategische Entscheidungen

Status:

- produktionsfaehige Version umgesetzt
- inklusive Board-Votes, Kapitalmassnahmen, Equity Raises, Buybacks und aktiven Board-Programmen im Capital Desk
- inklusive Kaufen, Verkaufen, Dividenden, Forced Exits, Mergers und Bankrott-Folgen
- erweitert um Teilverkaeufe, groessere Lots und strategische Beteiligungsrollen

## Phase 6: Balancing

Aufgaben:

- Snowballing testen
- Catch-up-Druck feinjustieren
- Award-Staerke pruefen
- Krisenwahrscheinlichkeiten anpassen

Definition of done:

- Platz 1 bleibt stark, aber nicht unangreifbar

Status:

- teilweise umgesetzt
- regionale Marktprofile, Sicherheitsdebatten und Strategie-Pivots sind eingebaut
- Governance-Druck fuer dominante Spielerparks ist als erste Gegenmechanik eingebaut
- Balancing gegen reale Spielverlaeufe bleibt als naechste Iterationswelle offen

## Phase 7: Player Governance

Aufgaben:

- Board-Mandate fuer den Spielerpark
- wiederkehrende Reviews und Erfolgs-/Misserfolgsbewertung
- Einfluss auf den Guest-Cap als sanfter Druck- und Bonuskanal
- spaetere Erweiterung auf Abstimmungen, Kapitalmassnahmen und Richtungsentscheidungen

Definition of done:

- der Spielerpark hat eine eigene Management-Ebene, die Dominanz belohnt, aber auch anspruchsvoller macht

Status:

- erste produktionsfaehige Version umgesetzt

## Phase 8: Owner Finance und vereinfachter Stock Market

Aufgaben:

- persoenliche Eigentuemer-Finanzen getrennt von der Parkkasse einfuehren
- monatliches Gehalt / Board-Salary fuer den Spieler definieren
- persoenliches Cash, persoenliches Net Worth und persoenliche Holdings modellieren
- einfachen Rivalen-Aktienmarkt aufsetzen, der auf bereits vorhandenen Rivalenwerten basiert
- UI fuer `Owner / Market` mit persoenlichem Portfolio und persoenlichen Kauf-/Verkaufsaktionen bauen
- bestehende Investments per Migration zu Owner Holdings umdeuten statt ein zweites Portfolio-System aufzubauen

Definition of done:

- der Spieler hat eine nachvollziehbare Eigentuemer-Ebene neben der Parkkasse
- persoenliche Investitionen fuehlen sich wie ein eigenes Meta-Game an
- Salary, Dividenden und persoenliche Holdings sind fuer den Spieler klar lesbar
- es existiert nur ein Rivalen-Investment-System, nicht zwei parallele Portfolios

Status:

- noch offen
- fachlich vorbereitet, weil Rivalenwerte, Board-/Equity-Logik und bestehende Beteiligungsmodelle schon existieren
- Architekturentscheidung dokumentiert in `docs/owner-finance-design.md`

## Phase 9: Advanced Brokerage (optional / spaeter)

Aufgaben:

- Margin Buying nur dann einfuehren, wenn der Basismarkt stabil und gut erklaert ist
- Short Selling nur mit klaren Regeln fuer Merger, Bankrotte, Delistings und Margin Calls pruefen
- Maintenance-Margin, Borrow-Fee und Forced Closeouts modellieren

Definition of done:

- komplexere Handelsmechaniken fuehlen sich nicht unfair oder unlesbar an

Status:

- bewusst nicht Teil des naechsten Kernscopes
- nur als spaete Ausbauphase vorgesehen

## Technische Risiken

- Guest-Cap-Eingriff darf das Basisspiel nicht unlesbar machen
- zu viel Zufall kann sich unfair anfuehlen
- zu wenig Catch-up friert die Rangliste ein
- zu aggressive Catch-up-Werte bestrafen Erfolg zu stark
- grosse News-Ereignisse muessen lesbar und selten genug bleiben

## Erste konkrete Aufgabenliste

1. Investment-Ertraege, Cashflow und Snowballing gegen echte Parks balancieren
2. Investor- und Board-Mechaniken ueber echte Saves und Balancing-Runden feinjustieren
3. Owner-Finance-Scope sauber schneiden: persoenliches Cash, Salary, Net Worth und Holdings
4. Bestehende Treasury-Investments gegen spaetere persoenliche Holdings abgrenzen
5. Einfachen Rivalen-Aktienmarkt ohne Margin/Shorting konzipieren
6. Score-, Markt- und Event-Diagnostik im UI weiter vertiefen
7. Groessere Ingame-Testlaeufe und Formelfeinjustierung durchfuehren
8. Spaetere Meta-Systeme wie Einflussrechte oder Synergien vorbereiten

## Entscheidung fuer den Start

Wir beginnen bewusst nicht mit Margin Buying, Short Selling oder einem vollwertigen Orderbuch.

Wir beginnen mit dem Kern:

- Rivalen
- Marktanteile
- News
- Besucherwirkung
- Catch-up

Der naechste logische Ausbau ist deshalb nicht maximale Finanzkomplexitaet, sondern:

- persoenliche Finanzen
- Salary / Eigentuemer-Ebene
- einfacher Rivalen-Aktienmarkt
- klares Owner-Portfolio

Wenn dieser Kern funktioniert, kann der Rest organisch darauf wachsen.
