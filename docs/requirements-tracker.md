# Requirements Tracker

Diese Datei ist die lebende Checkliste fuer das Projekt. Sie soll bei jeder relevanten Aenderung mit gepflegt werden, damit immer klar ist:

- was das System koennen soll
- was bereits umgesetzt ist
- was als Naechstes dran ist
- welche Architektur- und Qualitaetsregeln wir einhalten wollen

## Statuslegende

- `[x]` umgesetzt
- `[-]` begonnen / teilweise umgesetzt
- `[ ]` noch offen

## Produktziele

- [x] OpenRCT2 soll sich wie Teil einer groesseren internationalen Parkbranche anfuehlen
- [x] Konkurrenzparks sollen wirtschaftlich simuliert werden, ohne begehbare Fremdparks zu brauchen
- [x] Das Endgame soll durch Konkurrenz, Marktanteile und Prestige spannend bleiben
- [x] Wirtschaftliche Entscheidungen sollen die echte Parkkasse betreffen, damit Trading, Rewards und Strafen gameplayrelevant bleiben
- [x] Das System soll sauber, modular und produktionsnah aufgebaut sein
- [x] Das System soll eine lebende Dokumentation und einen nachvollziehbaren Umsetzungsstand haben

## Kernsimulation

- [x] Persistenter Weltzustand pro Save
- [x] Deterministische Rivalen-Generierung
- [x] Monatliche Welt-Simulation
- [x] Schnellere Live-Pulses innerhalb des Monats fuer haeufigere Ranglisten- und Markt-Updates
- [x] Taegliche Datenbewegung mit separatem groberen Event-Zyklus
- [x] Globale Nachfrage und Saisonfaktoren
- [x] Rivalen-Scoring und Rangliste
- [x] Catch-up-Mechanik fuer Konkurrenten
- [x] Difficulty Presets fuer Casual/Normal/Hard/Tycoon als zentrale Balancing-Schicht
- [x] Newsfeed fuer wichtige Welt- und Rivalenereignisse
- [x] Jaehrlicher Haupt-Award
- [x] Strukturelle Events fuer Mergers und neue Challenger
- [x] Bankrotte mit echten Folgen
- [x] Regionale Spezialeffekte und differenzierte Marktprofile
- [x] Erweiterte Event-Ketten mit Nachwirkungen ueber mehrere Monate

## Spielerintegration

- [x] Spieler-Score aus echten Parkdaten
- [x] Besucherwirkung ueber `park.guest.softcap.calculate`
- [x] Rank-/Marktanteils-Einfluss auf Besucher
- [x] Award-Bonus auf Besucherlogik
- [x] Tieferes Balancing gegen Snowballing mit Leader-Pressure, staerkerem Rivalen-Catch-up und Balance-Harness
- [x] Mehr direkte OpenRCT2-Rueckkopplung ueber Nachrichten, Awards und UI-Hinweise
- [x] Aktive Zielaufgaben mit Deadline, Reward, Park-Cash-Strafe und Board-/Investor-Folgen
- [x] Bestehende starke Savegames werden bei neuer/migrierter League-State-Erstellung einmalig gegen ein staerkeres Rivalenfeld kalibriert

## Governance und Board

- [x] Persistenter Governance-State fuer den Spielerpark
- [x] Quartalsartige Board-Reviews und Mandate
- [x] Investor- und Board-Druck als Gegenkraft gegen Dominanz
- [x] Governance-Einfluss auf Guest-Cap-Modifikator
- [x] Governance-Status im UI sichtbar
- [x] Tiefere Eingriffsrechte, Abstimmungen und Kapitalmassnahmen

## Investments

- [x] Datenmodell fuer Spielerinvestments
- [x] Portfolio-Zusammenfassung im persistenten State
- [x] Kauf eines standardisierten Minderheitsanteils
- [x] Verkauf einer bestehenden Position
- [x] Monatliche Dividenden auf profitable Beteiligungen
- [x] Zwangsabwicklung bei Markt-Austritt / Merge eines Zielparks
- [x] Beteiligungen bei Uebernahmen in den Erwerber ueberfuehren, statt sie nur unverkaufbar zu machen
- [x] Portfolio-Wert und Cashflow im UI sichtbar
- [x] Teilverkaeufe statt nur Komplettverkauf
- [x] Mehrere Kaufgroessen statt nur Standard-Lot
- [x] Beteiligungen mit hoeherer strategischer Tiefe
- [x] Beteiligungen mit echter Einflussmechanik auf Events, Synergien oder Zugang zu Boni
- [x] Investment-ROI ueber lange Laeufe deutlich entschaerft
- [x] Entscheidung revidiert: keine separate Owner-Cash-Nebenwelt fuer Kern-Trading, weil sie zu wenig Gameplaydruck erzeugt
- [x] Rivalen-Investments werden aus Park-Cash gekauft und zahlen wieder auf die Parkkasse aus
- [x] Vereinfachter Rivalen-Aktienmarkt mit Kauf-/Verkaufsentscheidungen und echtem Parkkassen-Risiko
- [x] Negative Investment-Schocks mit realem Paper-Value-Verlust fuer riskantere oder angeschlagene Holdings
- [x] Architekturentscheidung getroffen: kein zweites paralleles Investment-System, sondern ein einziges League-Portfolio mit Park-Cash-Cashflows
- [x] League-Portfolio-Ansicht mit Park Cash, Portfolio-Wert, League Worth und letztem Cashflow
- [ ] Margin Buying nur als spaetere Erweiterung nach stabilem Basis-Markt
- [ ] Short Selling nur als sehr spaete optionale Erweiterung wegen hoher Regel- und QA-Komplexitaet

## Rivalen- und Welt-Events

- [x] Konjunktur-Events
- [x] Tourismus- und Wettbewerbs-Events
- [x] Mergers als Struktur-Event
- [x] Neue Challenger als Struktur-Event
- [x] Skandale mit mehrmonatigem Reputationsschaden
- [x] Grosse Expansionsprojekte
- [x] Branchenweite Sicherheitsdebatten
- [x] Regionale Boom- und Schwachphasen
- [x] Managementwechsel und Strategiewechsel einzelner Rivalen
- [x] Lokaler Rivalen-Kreis fuer direkte Konkurrenz um den unmittelbaren Markt
- [x] Rivalen-Pressure-Campaigns gegen den Spieler, die Board, Investoren und Momentum kurzfristig belasten
- [x] Verlorene Head-to-head-Challenges kosten echte Parkkasse statt nur eine verpasste Belohnung zu sein
- [x] Sichtbare Warn-Popups fuer Rivalenangriffe, Zielverfehlungen, Investment-Schocks und harte Negativevents
- [x] Popup-Pacing mit persistiertem Cooldown, damit wichtige Warnungen sichtbar bleiben ohne zu spammen

## UI und Bedienung

- [x] Plugin-Menueeintrag
- [x] Statusfenster mit Summary
- [x] Grosses Leaderboard mit vollem Ligafeld statt nur Top-Auszug
- [x] News-Ansicht
- [x] Vollautomatische Kopplung an die echte Spielzeit ohne manuelle Monatssimulation
- [x] Investment-Kauf ueber UI
- [x] Investment-Verkauf ueber UI
- [x] Rivalen-Detailansicht
- [x] Portfolio-Detailansicht mit allen Positionen
- [x] Bessere Erklaerung fuer Berechnungen direkt im UI
- [x] Spielerpark im Leaderboard klar sichtbar
- [x] Vergleichsansicht `Du vs Zielpark` fuer Aufstiegsanalyse
- [x] Echte Monatskennzahlen des Spielerparks im UI statt Platzhalterdaten
- [x] Klarere Wirtschaftsmetriken im UI mit `People Share`, `Money`, `Park Value` und `Equity Value`
- [x] Eigene Custom-Stat-Cards fuer kompaktere Top-Level-Darstellung statt reiner Trennstrich-Textzeilen
- [x] League Board mit Sortier- und Ansichtsmodi statt nur starrem Score-Ordering
- [x] Geldwerte aus OpenRCT2 fuer Anzeige und Spielerkopplung auf eine konsistente Einheit normiert
- [x] Watchlist-Fenster mit Alerts fuer beobachtete und lokale Rivalen
- [x] Track/Unwatch-Flow direkt aus der Rivalenansicht
- [x] Einfachere Standard-Ansicht fuer neue Nutzer mit `Simple`/`Advanced`-Modus
- [x] Hauptfenster weiter vereinfacht: Top-Level zeigt nur Rang, Park-Cash, Profit, aktives Ziel, Boost, Difficulty und Hauptrisiko
- [x] First-Run-Quickstart-Fenster fuer neue Spieler
- [x] Schnellzugriffe klarer benannt als `Money`, `Rivals` und `Goals`
- [x] `What matters now`-Hinweise fuer die naechste sinnvolle Spieleraktion
- [x] Lokale Markt-Zusammenfassung direkt im Hauptfenster
- [x] Score-Treiber im UI erklaert statt nur als nackte Zahl gezeigt
- [x] Monatlicher `World Spotlight`-Boost fuer den Monatsbesten mit massivem sichtbarem Besucher-Push
- [x] Interne Debug-Trigger fuer `Spotlight`, `Featured Pick` und `Breakout Buzz`, damit jede Boost-Stufe isoliert testbar bleibt
- [x] Spotlight-Banner im Hauptfenster ohne oeffentliche Debug-Controls im Release-UI
- [x] Zusaetzliche zufaellige `Featured`- und `Breakout`-Boosts fuer Ranks `2-10` und `11-20`
- [x] `Yearly Recap` mit groesstem Gewinner, groesstem Verlierer, Hauptrivale, bestem Monat und groesstem Sprung
- [x] `Prestige Goals` wie `1,000 guests`, `Top 10 streak`, lokaler Marktlead und People-Share-Ziele
- [x] Reward-Vorschau und `Next unlock` fuer Prestige-Ziele
- [x] Direkt erklaerende UI-Hinweise wie `Need +2.4 score`, `Losing people to X` und Profit-/Depth-Hinweise
- [x] Konkreter `Score driver` in der Simple-Ansicht mit schwaechstem Score-Bereich und naechstem Verbesserungsziel
- [x] History-Filter auf `7d`, `30d`, `Season`, `Year`, `All` erweitert und Vergleichsstatistiken im Trendbereich vertieft
- [x] Langzeit-History fuer `All` ueber kompakte Daily/Weekly/Monthly-Aufbewahrung statt hartem Kurzzeit-Cap gehaertet
- [x] Text-Panels gegen abgeschnittene Recap-/Goal-Zeilen robuster gemacht
- [x] Eigenes `Prestige`-Fenster mit freigeschalteten Achievements, aktiven Zielen, Lifetime-Rekorden und Rivalen-Story
- [x] Prestige-/Achievement-Belohnungen mit Cash, Stakes, Spotlight/Featured/Buzz und temporaren Buffs
- [x] Boost-Zustaende fuer `Spotlight`, `Featured` und `Buzz` sichtbar und am Spielerpark direkt lesbar gemacht
- [x] `Featured`- und `Buzz`-Boosts mit kleineren echten Gast-Bursts im Live-Spiel spuerbar gemacht
- [x] `Head-to-head`-Hauptrivale mit klarer Gap-/Momentum-Zusammenfassung direkt im UI
- [x] Analyst-/Press-Layer mit verstaendlicher Begruendung, warum du stehst oder faellst
- [x] Direkte Rivalen-Challenges mit sichtbarer Reward-/Status-Zusammenfassung
- [x] `Challenge timeline` im Hauptfenster fuer aktive Ziele, Rivalen-Duelle und aktuelle Risiken
- [x] `Capital / Portfolio`-Bereich fuer Park-Cash, Portfolio, Cashflows und Management-Aktionen
- [x] Klare Erklaerung im UI, dass Rivalen-Trades, Dividenden, Exits, Challenges und Prestige-Cash die Parkkasse betreffen

## Technische und Architektur-Anforderungen

- [x] TypeScript-Projekt mit klarer Modulstruktur
- [x] Reine Domain-Logik getrennt von OpenRCT2-Integration
- [x] Build-Pipeline fuer gebuendelte Plugin-Datei
- [x] Tests fuer kritische Kernlogik
- [x] Save-State ueber zentrales Repository
- [x] Dokumentierte Architektur und Roadmap
- [-] State-Migrationen fuer spaetere Schema-Aenderungen weiter ausbauen
- [x] Zusaetzliche Tests fuer Investment-Edge-Cases
- [x] Regressionstests fuer Save-Migrationen und neue Simulationssysteme
- [x] Regressionstests fuer Rivalen-Challenge-Migrationen und Watchlist-Alert-Cooldowns
- [x] Reproduzierbarer Balance-Analyse-Harness
- [x] Automatisierter Balance-Lauf via `npm run analyze:balance` fuer Zahlen/Fakten statt nur Bauchgefuehl
- [x] Parallelisiertes `Balance Lab` via `npm run analyze:balance:lab` fuer automatisierte Kandidatensuche und Ranking
- [x] Schneller Alltags-Check via `npm run analyze:balance:quick`
- [x] Automatischer Tuning-Lauf via `npm run analyze:balance:autotune` mit konkreter Apply-/Keep-Empfehlung
- [x] Langer Release-Soak via `npm run analyze:balance:release`
- [x] Schnell-, Autotune- und Release-Reports werden als JSON-Artefakte unter `dist/` persistiert
- [x] Difficulty-Preset-Report via `npm run analyze:balance:difficulty`
- [x] Analyse-Skripte und Balance-Harness in die TypeScript-Pruefung eingebunden
- [x] Numerische Guards gegen nicht-finite Score- und Leaderboard-Zustaende
- [x] Explizite Anti-Dominanz-Hebel fuer Catch-up-Druck und lokale Rivalitaet in den Balance-Suchraum aufgenommen
- [x] Schema-24-Migration fuer Difficulty/Objectives und einmalige Rivalen-Kalibrierung
- [-] Tieferes Ingame-Testing und Balancing gegen echte Spielverlaeufe

## Aktueller Fokus

- [x] Soliden Produktions-Grundstein legen
- [x] Kernsimulation mit sauberer Architektur aufsetzen
- [x] Erste Investment-Mechanik integrieren
- [x] Balancing der Investment-Ertraege gegen zu starken Kapitalaufbau
- [x] Achievement-Rewards und Prestige-Buffs mit echten Systembelohnungen statt nur Cosmetic Unlocks
- [x] Rivalen-, Vergleichs- und Portfolio-Details im UI vertiefen
- [x] Regionale Dynamik als Systemwelle einziehen
- [x] Ersten Governance-Layer fuer den Spielerpark einziehen
- [x] Investment-Flow um groessere Lots und Teilverkaeufe erweitern
- [x] Tieferes Balancing mit Leader-Pressure, Wachstums-Catch-up und ROI-Kuerzung ausarbeiten
- [x] Balance-Harness gegen veraltete Snapshot-Formate und NaN-Zustaende absichern
- [x] Balance-Lab um echte Snowballing-Hebel wie Spotlight-Gast-Multiplikator und Spotlight-Score-Bonus erweitern
- [x] Balance-Lab um explizite Anti-Dominanz-Hebel fuer Catch-up-Intensitaet und Top-Streak-Druck erweitern
- [x] Watchlist- und Local-Rival-Mechanik fuer bessere Spielerfuehrung einziehen
- [x] Hauptansicht um lokale Markt-Hinweise, Score-Treiber und `What matters now` erweitern
- [x] Sichtbaren `World Spotlight`-Wow-Moment mit starkem Besucherboost und Debug-Schalter einziehen
- [x] Begleitende Zufalls-Boosts fuer Verfolger- und Mid-Table-Parks einziehen
- [x] Prestige-/Achievement-Layer mit eigener UI und persistenten Rekorden einziehen
- [x] Head-to-head-Rivalitaet und Analystenfuehrung fuer bessere Lesbarkeit und mehr Story einziehen
- [x] Release-Soak und wirtschaftliche Reward-/Investment-Hebel in den Balance-Lab-Workflow einziehen
- [x] Owner-Cash-Experiment zurueckgebaut und relevante League-Cashflows wieder an die Parkkasse gekoppelt
- [x] Bestehende Rivalen-Investments in einem einzigen League-Portfolio gehalten statt ein zweites Parallel-System zu bauen
- [x] Scope fuer Margin/Shorting bewusst auf spaeter verschoben, weil der Basismarkt zuerst schwerer und klarer sein muss
- [x] Park-Cash-/Portfolio-Transparenz mit klarerer Erklaerung und Trenddaten ausgebaut
- [x] Difficulty Presets, aktive Zielaufgaben, negative Investment-Events, Rivalen-Warn-Popups und Challenge-Timeline eingezogen
- [x] Haupt-UI fuer neue Nutzer deutlich vereinfacht und tiefere Daten in Advanced-/Detailfenster verschoben
- [x] First-Run-Onboarding, Popup-Pacing, bessere Score-Erklaerung und Difficulty-Preset-QA eingezogen

## Naechste Umsetzungsschritte

1. Angewendetes Balance-Profil gegen echte Saves pruefen und bei Bedarf weiter verfeinern
2. Difficulty Presets ueber echte kleine, mittlere und dominante Saves feinjustieren und mit `analyze:balance:difficulty` gegenpruefen
3. Zielaufgaben-Haeufigkeit, Rewards und Strafen auf Spielspass statt nur Zahlenwert pruefen
4. Challenge-Penalties, Pressure-Campaigns und Investment-Schocks ueber echte Spielsituationen pruefen
5. Watchlist/Alerts/Popups ueber echte Savegames auf Signal-zu-Rauschen und Alert-Haeufigkeit feinjustieren
6. Capital-/Portfolio-UI weiter ausbauen, vor allem Cashflow-Historie und Risikoerklaerung
7. Vereinfachten Rivalen-Aktienmarkt fuer Kauf-/Verkaufsentscheidungen weiter vertiefen
8. Erst danach pruefen, ob Margin Buying als kontrollierte Erweiterung genug Mehrwert bringt
9. Short Selling nur als spaete optionale Erweiterung behandeln, nicht als naechsten Kernschritt
10. Weitere Diagnoseansichten fuer Score-, Markt- und Event-Ursachen ausbauen
11. GitHub-Release mit Screenshots, Beschreibung und Paket-Artefakten veroeffentlichen
12. Anforderungen und Tracker nach jeder Feature-Welle aktualisieren
