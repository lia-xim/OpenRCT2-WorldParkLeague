# Balance Review

Diese Datei haelt den aktuellen wirtschaftlichen Review des Plugins fest. Ziel ist nicht perfekte Endbalance in einem Schritt, sondern ein nachvollziehbarer, reproduzierbarer Stand fuer produktionsnahe Iteration.

## Methodik

- Schneller Alltags-Check: `npm run analyze:balance:quick`
- Basis-Harness: `npm run analyze:balance`
- Such-/Optimierungs-Harness: `npm run analyze:balance:lab`
- Automatischer Tuning-Lauf mit Empfehlung: `npm run analyze:balance:autotune`
- Langer Release-Soak: `npm run analyze:balance:release`
- Alle Analyse-Skripte laufen ueber TypeScript mit und sind gegen nicht-finite Zustaende gehaertet.
- Die wichtigsten Reports werden jetzt automatisch nach `dist/` geschrieben:
  - `dist/balance-quick-latest.json`
  - `dist/balance-autotune-latest.json`
  - `dist/balance-release-latest.json`

Die aktuelle QA-Routine ist jetzt bewusst zweistufig:

- `analyze:balance:quick` fuer schnelle Iteration im Alltag
- `analyze:balance:release` fuer einen kontrollierten, aber noch in Entwicklerzeit praktikablen Release-Soak

Aktuell dokumentierte Referenzlaeufe:

- Schneller Snapshot:
  - `24` Monate
  - `12` Seeds
- Release-Referenz:
  - `36` Monate
  - `8` Seeds
- Spielerszenarien:
  - schwacher Sanierungspark
  - stabiles Mittelfeld
  - starker Herausforderer
  - dominanter Endgame-Park
- Investment-Test:
  - Kauf eines Rivalen auf Rang `3`
  - Haltedauer passend zum jeweiligen Lauf
  - Lots von `5%`, `10%` und `15%`
  - anschliessender Exit

## Aktuell angewendetes Balance-Profil

Das aktive Default-Profil im Plugin ist jetzt:

- `difficultyPreset = normal`
- `dominantLeadThreshold = 0.06`
- `maxCatchUpPressure = 0.36`
- `catchUpPlayerDominanceScale = 1.08`
- `catchUpPlayerGrowthScale = 0.026`
- `catchUpTenureScale = 0.014`
- `catchUpLocalRivalScale = 1.50`
- `spotlightGuestMultiplier = 1.5`
- `spotlightScoreBonus = 1`
- `featuredGuestMultiplier = 1.18`
- `breakoutGuestMultiplier = 1.06`
- `guestCapRankScale = 0.16`
- `guestCapShareScale = 0.46`
- `guestCapAwardBonus = 0.03`
- `guestCapUpperClamp = 1.16`
- `investmentSaleMultiplier = 0.60`
- `investmentDividendMultiplier = 0.42`
- `prestigeRewardCashMultiplier = 0.60`
- `prestigeRewardBoostMultiplier = 0.66`

Die letzte Welle wurde nicht nur aus Bauchgefuehl gesetzt, sondern mit Quick-Soaks gegen mehrere Szenarien geprueft. Neu ist dabei vor allem: schnelles Spielerwachstum erzeugt frueher Rivalen-Catch-up, lange Rang-1-Serien bekommen eine kleine Liga-Score-Pressure und Rivalen koennen gelegentliche Pressure-Campaigns gegen den Spieler ausloesen.

Die neue `0.22.0`-Welle legt darueber eine Difficulty-Schicht:

- `Casual` reduziert Objective-Druck, Rivalenangriffe und Investment-Schocks.
- `Normal` bleibt der Release-Default.
- `Hard` erhoeht Zielaufgaben, Strafhoehe, Rivalen-Catch-up und Marktrisiko.
- `Tycoon` ist bewusst aggressiver fuer Spieler, denen die Liga sonst zu leicht wird.

Wichtig: Difficulty veraendert keine zweite Parallelwirtschaft, sondern skaliert bestehende Systeme: Ziele, Rivalen-Challenges, Pressure-Campaigns, Catch-up und Investment-Risiko.

## Aktuelle Kernbeobachtungen

### Spielerleistung und Guest-Cap

Aus dem aktuellen Quick-Referenzlauf (`24` Monate, `12` Seeds) auf dem aktiven Profil:

- Schwacher Park:
  - durchschnittlicher Rang ca. `15.50`
  - durchschnittlicher People Share ca. `2.12%`
  - durchschnittlicher Guest-Cap-Modifikator ca. `0.983`
  - Dominanzrate im Feld ca. `4.9%`
- Mittelfeldpark:
  - durchschnittlicher Rang ca. `2.53`
  - durchschnittlicher People Share ca. `2.65%`
  - durchschnittlicher Guest-Cap-Modifikator ca. `1.195`
  - Dominanzrate ca. `13.2%`
- Starker Park:
  - durchschnittlicher Rang ca. `1.10`
  - durchschnittlicher People Share ca. `3.20%`
  - durchschnittlicher Guest-Cap-Modifikator ca. `1.557`
  - Dominanzrate ca. `41.3%`
- Dominanter Park:
  - durchschnittlicher Rang ca. `1.06`
  - durchschnittlicher People Share ca. `3.24%`
  - durchschnittlicher Guest-Cap-Modifikator ca. `1.584`
  - Dominanzrate ca. `49.0%`

Interpretation:

- Schwache Parks werden ueber den Guest-Cap-Pfad nicht abgewuergt und behalten Spielraum.
- Mittelfeldparks sind etwas weniger druckvoll als vor der Anti-Dominanz-Welle.
- Die neue Welle reduziert Top-Stickiness klar, ohne kleine Parks abzuwuergen.
- Starke und dominante Parks bleiben erwartbar sehr gut, verlieren aber deutlich mehr Abstand und werden haeufiger unter Druck gesetzt.

### Investments

Aktueller Quick-Referenztest gegen einen Rivalen auf Rang `3`:

- `5%`-Lot:
  - durchschnittlicher ROI ca. `9.2%`
- `10%`-Lot:
  - durchschnittlicher ROI ca. `3.9%`
- `15%`-Lot:
  - durchschnittlicher ROI ca. `-1.0%`

Interpretation:

- Die neue Sale-/Dividend-Welle hat Investment-Returns nach dem staerkeren Rivalen-Catch-up wieder deutlich gesenkt.
- Investments sind nicht mehr automatisch Free Money; groessere Lots koennen im Test nahezu neutral oder leicht negativ laufen.
- ROI bleibt beobachtungswuerdig, ist aber nicht mehr der groesste Release-Risikoblock.

## Release-Soak-Ergebnis

Der aktuelle Release-Soak (`npm run analyze:balance:release`) laeuft jetzt mit pragmatischeren Defaults:

- `3` Workern
- Coarse-Stage: `18` Monate, `4` Seeds
- Refine-Stage: `36` Monate, `8` Seeds
- erweitertem Refinement fuer Investment-, Prestige- und Anti-Dominanz-Hebel

Das ist bewusst leichter als ein maximaler Offline-Soak. Ziel ist, reproduzierbare Release-QA im normalen Entwicklungsfluss zu behalten, ohne dass der Job staendig in Timeouts oder unpraktisch lange Laufzeiten kippt.

Ergebnis:

- Der Suchraum umfasst jetzt `325` Kandidaten.
- Das erweiterte Autotuning hat zuerst den aggressiveren Anti-Dominanz-Kandidaten gefunden und empfohlen.
- Nach der Uebernahme dieses Profils ist die neue `Baseline` im aktuellen Suchraum wieder der beste Kandidat.
- Das ist ein gutes Zeichen: Die automatische Empfehlung wurde nicht nur vorgeschlagen, sondern anschliessend als stabile neue Basis bestaetigt.

## Automatisches Balancing: ehrliche Bewertung

Wir haben jetzt ein echtes automatisches Tuning-System, aber es ist bewusst kein "perfekter Autopilot".

Was es schon gut kann:

- viele Kandidaten parallel evaluieren
- Snowballing-, Guest-Cap-, ROI- und Stickiness-Probleme messbar machen
- konkrete Runtime-Profile empfehlen
- harte Verschlechterungen frueh sichtbar machen

Was es nicht alleine loesen kann:

- echte Savegame-Eigenheiten mit Bau-/Preis-/Kreditentscheidungen
- UI-/Spielgefuehl-Fragen
- "macht das Spass?" statt nur "ist das numerisch besser?"

Die beste Release-Routine bleibt deshalb:

1. `analyze:balance:quick`
2. `analyze:balance:autotune`
3. `analyze:balance:release`
4. echte Savegame-QA auf kleinen, mittleren und dominanten Parks

## Bereits umgesetzte Balance-Korrekturen

- Rivalen-Unternehmenswerte wurden auf eine fundamentalere, mean-reverting Logik umgestellt.
- Grossere Beteiligungen haben echte Einflusswirkungen auf Rivalen-Events und Stresslagen.
- Strategic / Anchor / Blocking Stakes verbessern reale Beteiligungsergebnisse nur noch moderat.
- Achievement-Rewards, Prestige-Buffs und Duel-Rewards wurden ueber Laufzeit-Multiplikatoren entschlackt.
- Verlorene Rivalen-Challenges kosten jetzt echte Parkkasse.
- Rivalen-Pressure-Campaigns koennen Board, Investor Confidence und Momentum des Spielerparks kurzfristig belasten.
- Aktive Zielaufgaben koennen echte Park-Cash-Strafen ausloesen, wenn Deadline-Ziele verfehlt werden.
- Riskante Rivalen-Holdings koennen negative Investment-Schocks erleiden, wodurch Paper Value und Zielpark-Finanzdaten fallen.
- Alte oder starke Savegames werden bei einer neuen/migrierten League-State-Erstellung einmalig gegen ein staerkeres Rivalenfeld kalibriert, damit Rang 1 nicht sofort trivial wird.
- Relevante Portfolio-Cashflows laufen wieder ueber die Parkkasse, damit Trading-Entscheidungen gameplayrelevant sind.
- Das Balance Lab prueft jetzt nicht nur Ladder-/Spotlight-Werte, sondern auch Investment- und Prestige-Hebel.
- Der Release-Soak ist jetzt als eigener Workflow reproduzierbar im Projekt verankert.
- Fuer den Alltag gibt es jetzt zusaetzlich einen deutlich schnelleren Balance-Snapshot, damit QA nicht nur auf den schweren Soak warten muss.

## Noch vorhandene Risiken

- Top-End-Parks sind im Harness weiterhin relativ stabil. Vor allem `Rank 1-3` braucht moeglicherweise noch mehr Gegenwind oder mehr Rivalen-Aufholfenster.
- Mittlere bis gute Spielerparks koennen in statischen Szenarien noch zu frueh in die Spitzengruppe kippen.
- Investment-Holds sind stark verbessert, sollten aber weiter ueber echte Savegames gegengeprueft werden.
- Achievement- und Challenge-Rewards fuehlen sich im Live-Spiel gut an, muessen aber auf echten Saves weiter beobachtet werden, damit sie starke Parks nicht dauerhaft ueberstabilisieren.
- Difficulty Presets, Zielaufgaben und Warn-Popups brauchen echte Spielsessions, um Frequenz und Nervfaktor sauber einzustellen.
- Echte Savegames mit dynamischen Bau-, Kredit- und Preisveraenderungen fehlen weiterhin als finaler Produktionscheck fuer das Balancing.

## Empfehlung fuer die naechste Balancing-Welle

1. Das angewendete `0.22.0`-Profil gegen echte kleine, mittlere und dominante Saves pruefen.
2. Difficulty Presets auf Zielhaerte, Strafhoehe und Objective-Frequenz feinjustieren.
3. Den Anti-Dominanz-Suchraum weiter verbreitern, wenn `Rank 1-3` im Release-Soak weiter zu sticky bleiben.
4. Dominanzrate, Top-Score-Gaps und Guest-Cap-Leverage im Release-Soak weiter beobachten.
5. Watchlist-/Alert-/Popup-Signal und Challenge-Reward-Wucht im Live-Spiel gegen echte Sessions feinjustieren.
