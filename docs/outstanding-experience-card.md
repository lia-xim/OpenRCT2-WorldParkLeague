# Outstanding Experience Card

Diese Karte beschreibt die Features, die World Park League von einer starken Wirtschafts-/Rivalen-UI zu einem wirklich besonderen OpenRCT2-Erlebnis machen sollen.

## Leitidee

Die Liga soll nicht nur im Fenster passieren. Wichtige Liga-Momente sollen im Park sichtbar und spielbar werden:

- Besucherwellen laufen tatsaechlich in den Park
- Eventgaeste haben Namen, Farben und Items
- VIPs/Kritiker laufen als echte Gaeste durch den Park
- Reviews, Awards und Rivalenangriffe erzeugen klare Folgen
- der Spieler bekommt konkrete Gegenmassnahmen statt nur Zahlenverlust

## Implementiert

- [x] Persistenter `PlayerExperienceState`
- [x] Park-Experience-Events:
  - `Press Day`
  - `School Trip`
  - `Influencer Event`
  - `Regional Fan Weekend`
  - `VIP Critic Visit`
- [x] Experience-Events starten bei Spieler-Boosts wie `World Spotlight`, `Featured Pick` und `Breakout Buzz`
- [x] Seltene standalone Park-Events koennen auch ohne Boost starten, wenn der Save dafuer passt
- [x] Experience-Events geben kleine Score-/Momentum-/Guest-Cap-Effekte
- [x] Besucherwellen werden ueber echte OpenRCT2-Gaeste erzeugt
- [x] Eventgaeste werden thematisch benannt und erhalten passende Items wie Map, Sunglasses oder Balloon
- [x] VIP-Kritiker werden als benannte Gaeste gespawnt
- [x] Relevante Event-Personen werden in einem eigenen `People`-Fenster gelistet und koennen im Park gesucht werden
- [x] VIP-Kritiker erzeugen nach Ablauf ein Review auf Basis echter Parkdaten:
  - Park Rating
  - Ride Satisfaction
  - Average Excitement
  - Ride/Stall Depth
  - Operating Profit
- [x] Positive Reviews geben Park-Cash und einen temporaeren Prestige-/Momentum-Lift
- [x] Schlechte Reviews kosten Park-Cash und schwächen Board-/Investor-Vertrauen
- [x] Einmalige visuelle Trigger pro Event ueber Balloons, Money Effects und Sparkle/Flare-Entities
- [x] Active Park Event erscheint im Hauptfenster und in der Challenge-Timeline

## Bewusst noch nicht hart umgesetzt

- [ ] Echte Sabotage, die Fahrgeschaefte aktiv zerstoert oder manipuliert
- [ ] Bau- oder Transport-Sperren, die Spielsysteme blockieren
- [ ] Direkte Steuerung eines VIPs zu bestimmten Rides
- [ ] Neue Custom-Assets wie Wasserspender, Pressebuehnen oder Messestaende

Diese Punkte sind nicht gestrichen. Sie brauchen nur strengere Regeln, weil sie sonst schnell unfair wirken oder Saves riskant manipulieren.

## Naechste Ausbaustufe

1. VIP/Kritiker-UI vertiefen: eigener kleiner Review-Dialog mit Zwischenfeedback wie `Queues are too long` oder `Great headline rides`.
2. Event-Calendar im UI: naechstes Event, aktuelle Dauer, erwarteter Effekt, letzte Review.
3. Rivalenangriffe als spuerbare, aber faire Parkevents: schlechte Presse, Besuchersegment-Verlust, Sponsorendruck.
4. Gegenmassnahmen je Angriff klar koppeln: Counter Campaign, Safety Campaign, Build Focus, Local Push.
5. Saisonale Expo / Trade Fair: einmal pro Jahr Platzierung, Messestand-Buzz, grosse Besucherwelle und Prestige-Auswirkung.
6. Event-Balancing gegen echte Saves pruefen: Wie viele Gaeste kommen extra? Wie oft passieren Events? Ab wann nervt es?
7. Optional: sicherer Firework-/Balloon-Modus als Einstellung, falls visuelle Entities auf manchen OpenRCT2-Versionen Probleme machen.

## Design-Grenzen

- Events duerfen Aufmerksamkeit erzeugen, aber nicht staendig den normalen Parkbau unterbrechen.
- Harte negative Effekte brauchen immer klare Warnung, klare Gegenmassnahme und begrenzte Dauer.
- Alles, was Parkobjekte veraendert, Fahrgeschaefte stoppt oder Bau blockiert, muss vorher als eigener Risiko-Task geprueft werden.
- Die UI muss die Event-Folge direkt erklaeren: Was passiert, wie lange, was kann ich tun?
