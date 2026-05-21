# Balance Review

Diese Datei haelt den aktuellen wirtschaftlichen Review des Plugins fest. Ziel ist nicht perfekte Endbalance in einem Schritt, sondern ein nachvollziehbarer, reproduzierbarer Stand fuer produktionsnahe Iteration.

## Methodik

- Basis-Harness: `npm run analyze:balance`
- Such-/Optimierungs-Harness: `npm run analyze:balance:lab`
- Langer Release-Soak: `npm run analyze:balance:release`
- Alle Analyse-Skripte laufen ueber TypeScript mit und sind gegen nicht-finite Zustaende gehaertet.

Aktueller dokumentierter Referenzlauf:

- `72` Monate
- `48` Seeds
- Spielerszenarien:
  - schwacher Sanierungspark
  - stabiles Mittelfeld
  - starker Herausforderer
  - dominanter Endgame-Park
- Investment-Test:
  - Kauf eines Rivalen auf Rang `3`
  - Haltedauer `72` Monate
  - Lots von `5%`, `10%` und `15%`
  - anschliessender Exit

## Aktuell angewendetes Balance-Profil

Das aktive Default-Profil im Plugin ist jetzt:

- `dominantLeadThreshold = 0.07`
- `maxCatchUpPressure = 0.26`
- `spotlightGuestMultiplier = 1.8`
- `spotlightScoreBonus = 1.5`
- `investmentSaleMultiplier = 0.82`
- `investmentDividendMultiplier = 0.72`
- `prestigeRewardCashMultiplier = 0.72`
- `prestigeRewardBoostMultiplier = 0.78`

Die letzte Welle wurde nicht nur aus Bauchgefuehl gesetzt, sondern aus dem Balance Lab und dem anschliessenden Release-Soak in die Runtime uebernommen.

## Aktuelle Kernbeobachtungen

### Spielerleistung und Guest-Cap

Aus dem aktuellen Referenzlauf:

- Schwacher Park:
  - durchschnittlicher Rang ca. `19.47`
  - durchschnittlicher People Share ca. `2.05%`
  - durchschnittlicher Guest-Cap-Modifikator ca. `0.991`
  - Dominanzrate im Feld ca. `5.0%`
- Mittelfeldpark:
  - durchschnittlicher Rang ca. `3.32`
  - durchschnittlicher People Share ca. `2.76%`
  - durchschnittlicher Guest-Cap-Modifikator ca. `1.437`
  - Dominanzrate ca. `11.7%`
- Starker Park:
  - durchschnittlicher Rang ca. `1.07`
  - durchschnittlicher People Share ca. `3.54%`
  - durchschnittlicher Guest-Cap-Modifikator ca. `2.076`
  - Dominanzrate ca. `56.7%`
- Dominanter Park:
  - durchschnittlicher Rang ca. `1.02`
  - durchschnittlicher People Share ca. `3.63%`
  - durchschnittlicher Guest-Cap-Modifikator ca. `2.117`
  - Dominanzrate ca. `71.5%`

Interpretation:

- Schwache Parks werden ueber den Guest-Cap-Pfad nicht mehr abgewuergt und koennen sich noch bewegen.
- Mittelfeldparks leben besser als in frueheren Wellen, kippen aber noch relativ oft in die Spitzengruppe.
- Starke und dominante Parks sind weiterhin sehr sticky; genau dort sitzt der groesste verbleibende Release-Risiko-Block.
- Prestige und Rewards fuehlen sich im Spiel gut an, sind aber weiterhin eher ein Verstaerker fuer gute Parks als ein Gegengewicht gegen Dominanz.

### Investments

Aktueller `72`-Monats-Test gegen einen Rivalen auf Rang `3`:

- `5%`-Lot:
  - durchschnittlicher ROI ca. `87.2%`
- `10%`-Lot:
  - durchschnittlicher ROI ca. `87.6%`
- `15%`-Lot:
  - durchschnittlicher ROI ca. `78.4%`

Interpretation:

- Die neue Sale-/Dividend-Welle drueckt Investment-Returns klar nach unten.
- Trotzdem bleiben Langlauf-Holds noch stark. Vor allem ueber mehrere Jahre ist der Investment-Pfad weiterhin einer der klarsten Snowballing-Kandidaten.
- Die groesste Verbesserung kam nicht aus Dividenden, sondern aus haerteren Exit- und Reward-Multiplikatoren.

## Release-Soak-Ergebnis

Der lange Release-Soak (`npm run analyze:balance:release`) lief mit:

- `20` Workern
- Coarse-Stage: `36` Monate, `8` Seeds
- Refine-Stage: `72` Monate, `24` Seeds
- erweitertem Refinement fuer Investment- und Prestige-Hebel

Ergebnis:

- Der beste Kandidat war jetzt die `Baseline`, also bereits das angewendete `0.20.0`-Profil.
- Das ist ein gutes Zeichen: Die neue Welle ist nicht nur lokal besser, sondern im aktuellen Suchraum auch stabil genug, um nicht sofort von einem anderen Kandidaten ueberholt zu werden.

## Bereits umgesetzte Balance-Korrekturen

- Rivalen-Unternehmenswerte wurden auf eine fundamentalere, mean-reverting Logik umgestellt.
- Grossere Beteiligungen haben echte Einflusswirkungen auf Rivalen-Events und Stresslagen.
- Strategic / Anchor / Blocking Stakes verbessern reale Beteiligungsergebnisse nur noch moderat.
- Achievement-Rewards, Prestige-Buffs und Duel-Rewards wurden ueber Laufzeit-Multiplikatoren entschlackt.
- Das Balance Lab prueft jetzt nicht nur Ladder-/Spotlight-Werte, sondern auch Investment- und Prestige-Hebel.
- Der Release-Soak ist jetzt als eigener Workflow reproduzierbar im Projekt verankert.

## Noch vorhandene Risiken

- Top-End-Parks sind im Harness weiterhin relativ stabil. Vor allem `Rank 1-3` braucht moeglicherweise noch mehr Gegenwind oder mehr Rivalen-Aufholfenster.
- Mittlere bis gute Spielerparks koennen in statischen Szenarien noch zu frueh in die Spitzengruppe kippen.
- Investment-Holds liefern noch recht starke Langlauf-Renditen und sollten ueber echte Savegames gegenprueft werden.
- Achievement- und Challenge-Rewards fuehlen sich im Live-Spiel gut an, muessen aber auf echten Saves weiter beobachtet werden, damit sie starke Parks nicht dauerhaft ueberstabilisieren.
- Echte Savegames mit dynamischen Bau-, Kredit- und Preisveraenderungen fehlen weiterhin als finaler Produktionscheck fuer das Balancing.

## Empfehlung fuer die naechste Balancing-Welle

1. Das angewendete `0.20.0`-Profil gegen echte kleine, mittlere und dominante Saves pruefen.
2. Investment-ROI ueber mehrere reale Save-Jahre beobachten und bei Bedarf Exit-/Dividend-Multiplikatoren weiter reduzieren.
3. Dominanzrate, Top-Score-Gaps und Guest-Cap-Leverage im Release-Soak weiter beobachten.
4. Watchlist-/Alert-Signal und Challenge-Reward-Wucht im Live-Spiel gegen echte Sessions feinjustieren.
