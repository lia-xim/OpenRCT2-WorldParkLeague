# Owner Finance und Investment-Architektur

## Aktueller Stand nach Gameplay-Review

Diese Datei dokumentiert den urspruenglichen Owner-Finance-Ansatz. Nach Live-Feedback wurde die Kernentscheidung fuer Version `0.22.0` bewusst geaendert:

- Das Plugin nutzt weiterhin **kein zweites paralleles Investment-System**.
- Rivalen-Investments bleiben ein einziges League-Portfolio.
- Die relevanten Cashflows laufen aber wieder ueber die **Parkkasse**, nicht ueber separates Owner Cash.
- Grund: separates Owner Cash war zwar sauber modellierbar, erzeugte aber zu wenig Spielspannung, weil Verluste und Gewinne den echten Parkbau kaum beeinflusst haben.
- Kauf, Verkauf, Dividenden, Exits, Prestige-Cash und Rivalen-Challenge-Strafen betreffen deshalb die Parkkasse.
- `owner`-State bleibt vorerst aus Save-Kompatibilitaetsgruenden als Legacy-/Summary-Struktur erhalten, ist aber nicht mehr die zentrale Gameplay-Wallet.

Die folgenden Abschnitte bleiben als historische Designnotiz erhalten und beschreiben nicht mehr vollstaendig den aktuellen Runtime-Stand.

## Ziel dieser historischen Notiz

Die folgenden Abschnitte halten die fruehere Architekturidee fest:

- wie wir persoenliche Finanzen einfuehren
- wie wir das bestehende Investment-System umbauen
- welche Geldstroeme Park-gesteuert bleiben
- welche Geldstroeme auf Eigentuemer-Ebene laufen

Die wichtigste Erkenntnis:

**Wir bauen kein zweites paralleles Investment-System.**

Stattdessen gibt es:

- genau **ein** Rivalen-Investment-System
- dieses System wird fachlich auf die **Eigentuemer-/Owner-Ebene** verschoben
- die **Parkkasse** bleibt fuer Parkbetrieb und eigene Unternehmensfinanzen zustaendig

## Kernentscheidung

### Was wir vermeiden wollen

Nicht sinnvoll waere:

- `Treasury Investments` fuer den Park
- `Personal Investments` fuer den Eigentuemer

Das fuehrt zu:

- doppelter UI
- doppelter Logik
- unklaren Geldfluessen
- mehr QA-Last
- hoeherer Verwirrung fuer Spieler

### Was wir stattdessen tun

Wir fuehren nur **ein** Investment-System weiter:

- Rivalen-Anteile gehoeren kuenftig zum **Owner Portfolio**
- Kauf und Verkauf laufen ueber **Owner Cash**
- Dividenden und Exits zahlen an **Owner Cash**
- persoenlicher Net Worth ergibt sich aus:
  - Owner Cash
  - Wert der Owner Holdings
  - ggf. spaeteren Owner-Liabilities

Die Parkfirma selbst investiert damit **nicht** mehr in Rivalen.

## Trennung der Geldsphaeren

### 1. Park Treasury

Die Parkkasse ist weiter fuer die Parkfirma da:

- Baukosten
- Betriebskosten
- Lohnkosten / Forschung / Marketing des Parks
- Board-Proposals
- Debt / Loan / Zinslast
- Equity Raises fuer den eigenen Park
- Buybacks des eigenen Parks
- direkte Park-relevante Rewards, falls sie als Firmenmittel gemeint sind

### 2. Owner Finance

Die Eigentuemer-Ebene ist fuer die Meta-Oekonomie da:

- persoenliches Cash
- Salary / Board Compensation
- persoenliche Holdings in Rivalen
- persoenliche Dividenden
- persoenliche Verkaufserloese
- persoenliches Net Worth

## Was mit dem bereits gebauten Investment-System passiert

Die bereits vorhandenen Rivalen-Investments werden **nicht geloescht** und **nicht verdoppelt**.

Stattdessen werden sie fachlich umgedeutet:

- bisherige `player.investments` werden zu `owner holdings`
- bisherige Investment-Summary wird zur `owner portfolio summary`
- Cashflows aus diesen Holdings laufen kuenftig auf `owner cash`

Das ist eine Migration, keine komplette Neuerfindung.

## Migration fuer bestehende Saves

### Migrationsziel

Bestehende Spielstaende sollen:

- ihre Holdings behalten
- keine Positionen verlieren
- keine doppelte Vermoegensebene bekommen

### Geplanter Migrationspfad

Beim Schema-Upgrade:

1. bestehende Rivalen-Holdings bleiben erhalten
2. diese Holdings werden owner-seitig interpretiert
3. ein neues Feld `ownerCash` wird angelegt
4. kuenftige Dividenden / Sales / Reward-Payouts aus Holdings gehen auf `ownerCash`
5. bisherige Park-Cash-Investment-Pfade werden abgeschaltet

### Wichtige Konsequenz

Alt-Saves koennen nach der Umstellung kurzfristig noch Holdings besitzen, die urspruenglich aus Parkgeld gekauft wurden.

Das ist akzeptabel, solange wir danach konsequent sagen:

- ab jetzt ist das dein Owner-Portfolio
- neue Trades laufen nur noch owner-seitig

## Warum diese Loesung die beste ist

### Gegenueber einem einzigen komplett gemeinsamen Geldtopf

Ein einziger Geldtopf waere zwar einfacher, aber wuerde die Spielrollen vermischen:

- Parkfirma
- Vorstand / Board
- Eigentuemer
- Kapitalmarkt

Das fuehrt spaeter zu Designproblemen bei:

- Salary
- Buybacks
- Equity Raises
- persoenlichem Trading
- Margin / Shorting

### Gegenueber zwei parallelen Investment-Systemen

Zwei Investment-Systeme waeren formal sauber trennbar, aber spielerisch unnoetig kompliziert.

Der Spieler muesste dann fragen:

- warum investiert mein Park hier
- warum investiere ich persoenlich dort
- warum gibt es zwei Portfolios
- welches Geld ist wofuer zustaendig

Das wuerde dem Plugin eher schaden als helfen.

### Deshalb ist der beste Kompromiss

- **zwei Geldsphaeren**
- aber **nur ein Investment-System**

Das ist sowohl spielerisch klar als auch technisch sauber.

## Vergleich mit starken Tycoon-/Management-Vorbildern

### Game Dev Tycoon

Game Dev Tycoon bleibt bewusst einfach:

- ein Unternehmen
- ein Geldtopf
- Konkurrenz ist simuliert, aber nicht als persoenlicher Kapitalmarkt spielbar

Staerke:

- sehr lesbar
- sehr wenig Friktion

Schwaeche:

- wenig Eigentuemer-/Finanzmarkt-Tiefe

### Railroad Tycoon

Railroad Tycoon ist naeher an unserem Wunschbild:

- Unternehmensfinanzen
- persoenliche Aktien-/Kapitalmarkt-Perspektive
- Konkurrenz ueber Firmen statt nur Tabellen

Staerke:

- starker Tycoon-Fantasy-Layer
- Wettbewerb fuehlt sich echter an

Schwaeche:

- hoher Komplexitaetssprung, wenn Margin/Shorting dazukommt

### Capitalism-/Corporate-Tycoon-artige Spiele

Diese Spiele trennen fast immer:

- Firmenvermoegen
- Eigentuemervermoegen

Das ist ein starkes Muster, wenn man eine wirkliche Kapitalmarkt-/Eigentuemer-Ebene will.

## Scope fuer die naechste Ausbaustufe

### Phase A: Einfache Owner Finance

Ziel:

- `ownerCash`
- `ownerSalary`
- `ownerNetWorth`
- bestehende Holdings als Owner Holdings

### Phase B: Owner Portfolio UI

Ziel:

- eigenes `Owner / Market`-Fenster oder Tab
- persoenliches Cash sichtbar
- Salary sichtbar
- Holdings sichtbar
- Dividenden und letzter Cashflow sichtbar

### Phase C: Vereinfachter Stock Market

Ziel:

- persoenlicher Kauf/Verkauf von Rivalenanteilen
- Preise weiter auf Basis vorhandener Rivalen-Werte
- kein Orderbuch
- keine komplexe Markt-Mikrostruktur

### Phase D: Spaetere Erweiterungen

Optional, aber nicht fuer den ersten Wurf:

- Margin Buying
- Short Selling
- Borrow Fees
- Margin Calls
- Forced Closeouts

## Was wir bewusst noch nicht tun

Wir bauen **vorerst nicht**:

- zwei getrennte Rivalen-Investment-Systeme
- ein vollwertiges Orderbuch
- Margin Buying als ersten Schritt
- Short Selling als ersten Schritt

Diese Dinge sind nicht verboten, aber nicht der richtige naechste Scope.

## Offene Designfragen

Diese Fragen gehoerten zum alten Owner-Finance-Scope und sind aktuell nicht Release-blockierend:

1. Wie hoch ist das monatliche Owner Salary und wodurch wird es beeinflusst?
2. Welche Rewards zahlen an `ownerCash` und welche an die Parkkasse?
3. Wie benennen wir die UI so, dass `Owner Money` und `Park Money` nicht verwechselt werden?
4. Sollen Dividenden aus dem eigenen Park irgendwann auch owner-seitig modelliert werden?
5. Wie streng trennen wir persoenliche und Park-seitige Rewards / Challenge-Payouts?

## Aktuelle Empfehlung nach Gameplay-Review

Die beste aktuelle Runtime-Loesung ist:

1. Rivalen-Holdings als ein einziges League-Portfolio behalten
2. Kauf, Verkauf, Dividenden, Exits, Challenges und Prestige-Cash ueber die echte Parkkasse laufen lassen
3. Keine zweite Owner-Cash-Wallet als Kernsystem verwenden
4. `owner`-State nur noch als Legacy-/Summary-Struktur stabil halten
5. Difficulty, Ziele, negative Investment-Events und Rivalen-Druck zuerst balancen

Erst wenn der Park-Cash-Markt schwer genug, lesbar und stabil ist, sollte ueber Margin oder Shorting gesprochen werden.
