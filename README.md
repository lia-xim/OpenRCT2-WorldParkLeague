# OpenRCT2 World Park League

Ein OpenRCT2-Plugin-Konzept fuer eine globale Freizeitpark-Wirtschaft mit Rivalen, Marktanteilen, Investments, News, Awards und Endgame-Druck.

## Ziel

Dieses Projekt erweitert OpenRCT2 um eine Meta-Ebene:

- Der Spieler ist nicht mehr der einzige Park auf der Welt.
- Es existiert ein Feld aus konkurrierenden Parks mit eigener Wirtschaftslage.
- Gaeste verteilen sich ueber einen globalen Markt statt nur passiv zu spawnen.
- Rankings, Preise, Mergers, Krisen und Investments veraendern den Spielfluss.
- Fuehrende Parks muessen ihre Marktposition verteidigen, weil die Konkurrenz aktiv aufholt.

## Projektstatus

Aktueller Stand:

- Repo angelegt
- Git initialisiert
- Produktvision dokumentiert
- Wirtschaftslogik dokumentiert
- Technischer Umsetzungsplan dokumentiert
- TypeScript-, Test- und Build-Pipeline eingerichtet
- Modularer Simulationskern implementiert
- Persistenter Save-State umgesetzt
- Guest-Cap-Integration und League-UI umgesetzt
- Investments mit Portfolio, Dividenden und Forced Exits umgesetzt
- Distress-, Skandal-, Expansions- und Bankrott-Ketten umgesetzt
- Regionale Marktprofile, Sicherheitsdebatten und Strategie-Pivots umgesetzt
- Governance-Layer fuer den Spielerpark mit Board-Mandaten und Investorendruck umgesetzt
- Governance-Layer um echte Board-Votes, Kapitalmassnahmen, Equity Raises, Buybacks und Board-Programme erweitert
- Investments mit Teilverkaeufen, groesseren Lots und Einflussstufen erweitert
- Save-Migrationen und Regressionstests fuer neue Weltfelder erweitert
- Reproduzierbarer Balance-Analyse-Harness und schriftlicher Review angelegt
- Paralleles `Balance Lab` mit Worker-Threads und automatischer Kandidatenbewertung fuer Snowballing-/Boost-Tuning angelegt
- Produktives League-UI ohne manuelle Zeitsteuerung mit erweitertem Board, Vergleichsansicht und realen Monatskennzahlen des Spielerparks umgesetzt
- UI-Metriken auf `People Share`, `Money`, `Park Value` und `Equity Value` geklaert und obere Info-Bereiche als Custom-Stat-Cards verdichtet
- Woechentliche Live-Pulses zwischen den Monats-Simulationen fuer haeufigere League-Updates umgesetzt
- Taegliche Live-Pulses mit geglaetteten Bewegungen und separatem 7-Tage-Event-Zyklus umgesetzt
- Watchlist mit Alerts sowie ein lokaler Rivalen-Kreis fuer die naechsten direkten Konkurrenten umgesetzt
- Einsteigerfreundliche Hauptansicht mit `What matters now`, lokalen Markt-Hinweisen und erklaerten Score-Treibern umgesetzt
- `World Spotlight` fuer den Monatsbesten mit extremem Gast-Boost, Banner im Hauptfenster und Debug-Trigger umgesetzt
- zusaetzliche zufaellige `Featured Pick`- und `Breakout Buzz`-Boosts fuer Verfolger- und Mid-Table-Parks umgesetzt
- separate Debug-Buttons fuer `Spotlight`, `Featured Pick` und `Breakout Buzz` zum realistischen Testen aller Boost-Stufen umgesetzt
- `Yearly Recap`, `Prestige Goals`, direktere UI-Erklaerungen und bessere History-Filter/Trend-Vergleiche umgesetzt
- Langzeit-History fuer `All` ueber kompakte Daily/Weekly/Monthly-Aufbewahrung gehaertet und Text-Panels gegen Abschneiden bei dichterem Inhalt robuster gemacht
- Persistentes Prestige-/Achievement-System mit eigener `Prestige`-Ansicht, Lifetime-Rekorden, Rivalen-Story und Unlock-Historie umgesetzt
- `Featured`- und `Breakout Buzz`-Boosts um echte kleinere Gast-Bursts erweitert, damit sie im laufenden Spiel klarer spuerbar sind
- `Head-to-head`-Hauptrivalen und Analystenhinweise direkt in Park- und Prestige-Ansicht umgesetzt
- Direkte Rivalen-Challenges mit echten Duel-Rewards, Cash-Payouts und temporaren Boost-Programmen umgesetzt
- Prestige-/Achievement-Rewards mit Reward-Vorschau, `Next unlock`, Cash-/Stake-/Boost-Belohnungen und aktiven Reward-Bannern umgesetzt
- Watchlist-Alerts gegen Spam gehaertet und Save-Migrationen fuer Reward-/Rivalry-Schemata erweitert
- Release-Soak-Workflow `npm run analyze:balance:release` fuer lange parallele Balance-QA eingerichtet

Naechster sinnvoller Schritt:

- Balancing, tieferes Ingame-Testing und weitere Endgame-Mechaniken auf dem bestehenden Kern aufbauen

## Release-Stand

Das Projekt ist jetzt auf einen oeffentlichen Release vorbereitet:

- Lizenz vorhanden
- Changelog vorhanden
- Release-Checklist vorhanden
- GitHub-Release-Vorlage vorhanden
- reproduzierbare Balance-Reports vorhanden
- ZIP-Paket-Workflow mit Checksumme vorhanden

Der Release-Workflow ist:

1. `npm run check`
2. `npm run analyze:balance`
3. `npm run analyze:balance:lab`
4. `npm run analyze:balance:release`
5. `npm run release:package`

Danach liegen in `release/` ein ZIP-Artefakt und eine `sha256`-Datei bereit.

## Repo-Struktur

```text
docs/
  economy-design.md
  implementation-plan.md
  product-vision.md
  requirements-tracker.md
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
  rivals.test.ts
  simulation.test.ts
.gitignore
package.json
README.md
tsconfig.json
```

## Geplante Kernfeatures

- globale Rangliste mit 10 bis 20 simulierten Konkurrenzparks
- News-System fuer Fusionen, Uebernahmen, Boom-Jahre, Skandale und Krisen
- Marktanteils-System mit saisonaler und wirtschaftlicher Nachfrage
- Awards wie "Best Park of the Year"
- Investments in andere Parks mit Gewinn- und Verlustrisiko
- Catch-up-System, damit starke Konkurrenten nicht dauerhaft bedeutungslos werden
- Besucherbonus oder -malus fuer den Spieler basierend auf Ranking, Ruf und Awards

## Entwicklungsworkflow

1. Code im Repo unter `src/` entwickeln.
2. Mit `npm run typecheck`, `npm run test`, `npm run analyze:balance`, `npm run analyze:balance:lab` und `npm run build` validieren.
3. Fuer Release-Kandidaten zusaetzlich `npm run analyze:balance:release` als langen Parallel-Soak laufen lassen.
4. Mit `npm run install:plugin` das gebaute Plugin nach `Documents\\OpenRCT2\\plugin` kopieren.
5. Plugin in OpenRCT2 testen.
6. Balance und Formeln schrittweise ueber echte Spielsituationen feinjustieren.

## Aktuelle Architektur

- `src/domain/`: reine Wirtschaftssimulation, Rivalen-Generator, Scoring und Formeln
- `src/state/`: Save-Persistenz und Monats-Sync
- `src/ui/`: OpenRCT2-Fenster fuer League-Board, Vergleich, Portfolio und News
- `src/index.ts`: Plugin-Entry, Hooks und OpenRCT2-Integration

## Bereits umgesetzt

- deterministische Rivalen-Generierung
- monatliche Wirtschaftssimulation
- schnelle Live-Pulses innerhalb des Monats fuer haeufigere Ranglisten- und Markt-Updates
- taegliche Datenbewegung mit geglaetteten Uebergaengen statt grober Spruenge
- globale Nachfrage, Ranking und Marktanteile
- Catch-up-Druck fuer Rivalen
- Newsfeed und strukturelle Ereignisse
- jaehrlicher Award
- Spieler-Score aus echten Parkdaten
- Besucherwirkung ueber `park.guest.softcap.calculate`
- produktives League-Fenster, das direkt mit der Spielzeit mitlaeuft
- Investment-Mechanik mit Kaufen, Verkaufen, Dividenden, Forced Exits und Portfolio-Summary
- Distress-, Skandal-, Expansions-, Strategie- und Bankrott-Logik fuer Rivalen
- Regionale Marktprofile, regionale Booms/Slowdowns und branchenweite Sicherheitsdebatten
- Governance-Layer mit Board-Mandaten, Review-Zyklen und Einfluss auf die Guest-Cap-Logik
- Board-Votes, Kapitalmassnahmen, Equity Raises, Buybacks und aktive Board-Programme im Capital Desk
- Flexible Investments mit 5/10/15%-Lots, Teilverkaeufen und Beteiligungsrollen
- erweitertes League-Board mit mehr Eintraegen, Trend-, Profit- und Share-Daten
- League-Board mit Live-Form-Sortierung fuer taegliche Momentum-Jagd
- geklaerte Wirtschaftsmetriken mit separatem `Money`-, `Park Value`- und `Equity Value`-Blick fuer den Spielerpark
- Vergleichsansicht `Du vs Zielpark` mit Verbesserungshinweisen ueber echte Parkkennzahlen
- Rivalen-Detailansicht, Portfolio-Liste und News-Ansicht im Plugin-UI
- Watchlist-Fenster mit lokalen Rivalen, Track-Mechanik und Alert-Historie
- Prestige-Fenster mit freigeschalteten Achievements, aktiven Zielen, Lifetime-Rekorden und Rivalen-Story
- Head-to-head-Hauptrivale mit Analystenkommentar fuer klarere Rivalitaet und bessere Spielerfuehrung
- Achievement-Rewards mit Reward-Preview, `Next unlock`, Cash-/Stake-/Boost-Belohnungen und aktiven Reward-Programmen
- Direkte Rivalen-Challenges gegen den Hauptrivalen mit Duel-Payouts, Featured-/Buzz-Belohnungen und temporaren Momentum-Programmen

## Laufende Anforderungen

Die lebende Projekt-Checkliste liegt in [docs/requirements-tracker.md](/C:/Users/matth/Documents/OpenRCT2-WorldParkLeague/docs/requirements-tracker.md). Diese Datei soll bei jeder relevanten Feature-Welle mit aktualisiert werden.

Der aktuelle Wirtschafts- und Balancing-Review liegt in [docs/balance-review.md](/C:/Users/matth/Documents/OpenRCT2-WorldParkLeague/docs/balance-review.md).

Fuer grobere automatische Balancing-Suchen gibt es zusaetzlich `npm run analyze:balance:lab`. Der Lab-Runner startet mehrere Worker parallel, prueft eine ganze Kandidatenmenge gegen dieselben Szenarien und gibt die beste Konfigurations-Empfehlung samt Zielmetriken als JSON aus.

Fuer den eigentlichen Release-Soak gibt es `npm run analyze:balance:release`. Dieser Workflow nutzt standardmaessig einen langen Parallel-Lauf mit `20` Workern, erweitertem Refinement fuer Investment-/Prestige-Hebel und ist die empfohlene Vorabpruefung vor einem oeffentlichen Release.

## Wichtige Annahmen

- Fremde Parks werden als Wirtschaftssimulation modelliert, nicht als begehbare Maps.
- Der Fokus liegt auf Management, Wirtschaft, Konkurrenzdruck und Meta-Progression.
- Das erste Ziel ist ein starkes MVP mit glaubwuerdigem Spielfluss, nicht sofort ein vollstaendiges Boersen-Simulationsmonster.
