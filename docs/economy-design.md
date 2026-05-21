# Wirtschaftslogik

## Ziel der Simulation

Das Plugin soll eine glaubwuerdige, aber spielbare Freizeitpark-Wirtschaft simulieren. Das System muss genug Tiefe haben, um spannend zu sein, darf aber nicht in unlesbaren Zahlen oder unfairer Zufallslast enden.

## Grundmodell

Jeder Monat besteht aus vier Ebenen:

1. Weltlage aktualisieren
2. Konkurrenzparks simulieren
3. Marktanteile neu verteilen
4. Spielerwirkungen anwenden

## Datenmodell fuer Konkurrenzparks

Jeder simulierte Park besitzt mindestens:

- `id`
- `name`
- `region`
- `tier`
- `prestige`
- `operations`
- `marketing`
- `innovation`
- `guestAppeal`
- `financeHealth`
- `debt`
- `cashReserve`
- `volatility`
- `risk`
- `marketShare`
- `companyValue`
- `monthlyRevenue`
- `monthlyProfit`
- `ownershipStatus`
- `momentum`
- `recentNewsTag`

## Weltvariablen

Die Weltwirtschaft selbst besitzt:

- `economyIndex`
- `tourismIndex`
- `competitionHeat`
- `seasonality`
- `capitalMarketMood`
- `globalDemand`
- `awardSeason`
- `newsFeed`

## Nachfrageformel

Globale Nachfrage ist nicht statisch. Sie soll durch Wirtschaft, Saison, Stimmung und Events schwanken.

Vorschlag:

```text
globalDemand =
  baseDemand
  * seasonFactor
  * economyIndex
  * tourismIndex
  * eventDemandMultiplier
```

### Erklaerung

- `baseDemand`: Grundgroesse des Parkmarkts
- `seasonFactor`: Sommer staerker, Herbst schwaecher
- `economyIndex`: globale Konjunktur
- `tourismIndex`: Freizeit- und Reiselaune
- `eventDemandMultiplier`: z. B. Boom, Krise, Grossereignis

## Attraktivitaets-Score pro Park

Jeder Park erhaelt pro Monat einen Markt-Score.

Vorschlag:

```text
parkScore =
  prestigeWeight
  + operationsWeight
  + marketingWeight
  + innovationWeight
  + financialConfidenceWeight
  + momentumWeight
  + awardWeight
  + eventWeight
```

Konkrete erste Gewichte:

- Prestige: 24 %
- Operations: 18 %
- Marketing: 14 %
- Innovation: 12 %
- Finanzkraft: 10 %
- Momentum: 8 %
- Awards: 8 %
- Sondereffekte: 6 %

## Spieler-Score

Der Spielerpark nutzt echte OpenRCT2-Daten, soweit verfuegbar:

- Park Rating
- Guest Count
- Company Value
- Ride Count
- durchschnittliche Ride-Qualitaet
- Anzahl profitabler Hauptattraktionen
- Eintrittspreis-Positionierung
- aktuelle Awards

Der Spieler-Score darf nicht nur aus Parkgroesse bestehen. Sonst gewinnt immer nur der groesste Park.

## Marktanteile

Alle Parks teilen sich dieselbe globale Nachfrage.

Vorschlag:

```text
marketShare_i = score_i / sum(allScores)
visitors_i = globalDemand * marketShare_i
```

Spaeter kann das durch eine weichere Softmax-Variante ersetzt werden, falls die Verteilung zu hart oder zu flach wirkt.

## Spielerwirkung auf OpenRCT2

Weil wir keine echten Fremdparks simulieren, muss die Weltwirkung auf den Spieler ueber OpenRCT2-Mechaniken spuerbar werden.

Version-1-Hebel:

- Anpassung des `suggestedGuestMaximum`
- Besucherbonus oder -malus durch Ranking
- Zusatzschub durch Awards
- temporaere Eventmodifikatoren
- News-Meldungen ueber `park.postMessage`

### Gast-Cap-Modifikator

Beispiel:

```text
guestCapModifier =
  0.90
  + rankBonus
  + prestigeBonus
  + awardBonus
  + eventBonus
```

Mit harten Grenzen:

- Minimum: `0.75`
- Standardbereich: `0.90` bis `1.20`
- starkes Ausnahme-Maximum: `1.35`

So fuehlt sich Platz 1 gut an, ohne das Spiel voellig zu sprengen.

## Catch-up-System

Das ist ein Kernfeature. Wenn der Spieler fuehrt, duerfen Rivalen nicht einfach stagnieren.

### Ziele des Catch-up-Systems

- die Rangliste bleibt lebendig
- Top-Parks muessen ihre Position verteidigen
- starke Rivalen reagieren auf Dominanz des Spielers
- schwache Parks koennen sich gelegentlich neu erfinden

### Catch-up-Trigger

Rubber-band-Logik wird staerker, wenn:

- der Spieler Rang 1 ist
- der Spieler ueber mehrere Monate fuehrt
- der Abstand in Marktanteilen zu gross wird
- dieselben Rivalen dauerhaft abstuerzen

### Catch-up-Effekte fuer Rivalen

- zusaetzlicher Marketing-Boost
- leichter Innovationssprung
- besserer Kapitalzugang
- voruebergehender Prestigeanstieg
- Fusionen oder Uebernahmen als Schockevent

### Beispielhafte Formel

```text
catchUpPressure =
  clamp(playerLeadShare * 0.35 + monthsAtRankOne * 0.01, 0, 0.18)
```

Dann fuer geeignete Rivalen:

```text
rivalGrowthBonus = catchUpPressure * rivalAmbitionFactor
```

## Momentum statt reiner Zufall

Parks sollen nicht komplett willkuerlich springen. Deshalb bekommt jeder Park Momentum.

- gute Monate erhoehen Momentum
- mehrere schlechte Monate senken Momentum
- hohe Verschuldung macht Erholung schwerer
- grosse Awards oder Mergers koennen Momentum resetten oder drehen

Das sorgt fuer lesbare Storylines.

## Events

Events sind nicht nur Flavor. Sie muessen mechanische Folgen haben.

### Weltweite Events

- Tourismus-Boom
- Rezession
- Hitzewelle
- Regenmonat
- Medienhype fuer Themenparks
- Sicherheitsdebatte in der Branche

### Konkurrenz-Events

- Park gewinnt internationalen Award
- neues Flagship-Ride-Projekt
- Preis-Skandal
- Unfall oder Sicherheitsvorfall
- aggressive Marketingoffensive
- Managementwechsel

### Strukturelle Events

- Fusion zweier Parks
- Uebernahme eines schwachen Parks
- Insolvenz
- Gruendung eines neuen Challenger-Parks

## Fusionen und Uebernahmen

Das soll selten sein, aber stark wirken.

### Trigger fuer Uebernahmen

- Zielpark ist stark verschuldet
- Kaeufer hat hohe Finanzkraft
- beide Parks sind strategisch kompatibel
- globale Kapitalmarktstimmung ist positiv

### Wirkungen

- kombiniertes Prestige
- Teil der Marktanteile wird gebuendelt
- kurzfristiger Synergie-Bonus
- moeglicher Kultur- oder Integrationsmalus
- News-Eintrag

### Spielwirkung

Wenn ein grosser Rivale einen anderen Park schluckt, steigt der Konkurrenzdruck fuer den Spieler sofort.

## Investments des Spielers

Spielerbeteiligungen sollen weder Free-Money noch reine Lotterie sein.

### Einfache erste Version

- Kauf kleiner Anteile an Rivalen
- monatliche Dividende aus Gewinn
- Buchverlust bei Krisen oder Schulden
- Totalverlust bei Insolvenz

### Dividendenmodell

```text
dividend =
  parkMonthlyProfit
  * dividendPayoutRatio
  * ownershipShare
```

### Risikomodell

- hohe Verschuldung reduziert Dividenden
- hohe Volatilitaet vergroessert Schwankungen
- Skandale koennen Dividenden auf null setzen

## Awards

Awards erzeugen Prestige, Besucher und News.

Erste Award-Kandidaten:

- Best Park of the Year
- Fastest Rising Park
- Best Guest Experience
- Most Innovative Park

### Award-Wirkung

- temporarer Prestige-Bonus
- temporarer Marketing-Bonus
- Besucherbonus fuer den Sieger
- zusaetzliche Schlagzeile im Newsfeed

## Balancing-Regeln

Diese Regeln sollen Snowballing verhindern:

- Top-Parks erhalten niemals nur Vorteile
- groessere Parks tragen groessere Reputationsrisiken
- Fuehrung aktiviert Catch-up-Druck der Konkurrenz
- hohe Marktanteile machen Preiserhoehungen riskanter
- Krisen koennen auch starke Parks treffen

## MVP-Scope der Wirtschaft

Version 1 braucht:

- 12 bis 16 simulierte Konkurrenzparks
- monatliche Simulation
- globale Nachfrage
- Rangliste
- Newsfeed
- Catch-up-System
- 3 bis 5 Kern-Events
- 1 jaehrlichen Award
- einfache Beteiligungen
- Besucherwirkung auf den Spieler

## Nicht im ersten Schritt

- echte Boerse mit Kursgraphen
- mehrere parallel spielbare Fremdparks
- vollwertige Investor-Abstimmungen
- komplexe Vertragssysteme
- sehr viele Untermenues

Erst muss die Kernwirtschaft Spass machen.
