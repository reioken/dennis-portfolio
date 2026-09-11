# Art Direction für den Über-mich-Bereich

## Empfehlung

Der Über-mich-Bereich sollte als eigenständiges, dunkles Porträt-Editorial gestaltet werden. Ein deutlich größeres Gesicht, eine bewusst asymmetrische Typografie und wenige ausgewählte Arbeitsbeispiele vermitteln Persönlichkeit und gestalterische Kompetenz. Die Verbindung zur Arcade entsteht durch eine einzige nachvollziehbare Materialidee: ein hochwertig gefasstes, dezent hinterleuchtetes Porträtfeld, dessen Lichtkante zur Scheibe des Greifautomaten passt.

Die stärkste Kombination ist **Richtung A: Studio-Porträt** mit der sorgfältigen Auswahl echter Arbeiten aus **Richtung B: Arbeitsproben**. Der erste Eindruck gehört Dennis als Person. Seine Leistungen werden anschließend mit konkreten Projekten verbunden. Berufserfahrung, Ausbildung und Werkzeuge bilden eine gut zugängliche zweite Informationsebene.

Diese Empfehlung richtet sich an potenzielle Auftraggeber, Designverantwortliche und interessierte Fachkollegen. Sie ist eine begründete Art-Direction-Entscheidung; für die konkrete Website liegen noch keine vergleichenden Nutzertests oder Conversion-Daten vor. Größen, Abstände und Animationszeiten in diesem Bericht sind Entwurfswerte für die nächste Gestaltung, keine wissenschaftlich belegten Optimalwerte.

## Befund am bestehenden Bereich

**Das Porträt hat zu wenig Gewicht.** Im Komponenten-CSS ist eine Fläche von 112 × 112 Pixeln vorgesehen, mobil 84 × 84 Pixel. Das verwendete Bild zeigt einen großen Teil des Oberkörpers. Dadurch ist das tatsächlich sichtbare Gesicht noch erheblich kleiner. Auf dem bereitgestellten breiten Screenshot entsteht eine ausgedehnte Kopfzone mit einem kleinen Identitätsbild und viel unbegründet freier Fläche rechts.

**Die Hierarchie bevorzugt Verwaltungsinformationen.** Berufsstationen, Ausbildungsdaten, Standort, Rolle und 23 Werkzeug- beziehungsweise Kompetenzbegriffe beanspruchen den Hauptteil der Darstellung. Fast alles erscheint als kleine Schrift, feine Trennlinie, Label oder Chip. Die visuelle Bedeutung unterscheidet sich zu wenig, obwohl die Aussagen sehr verschieden wichtig sind. Das Profil wirkt dadurch wie eine Datenansicht.

**Die gestalterische Arbeit bleibt unsichtbar.** Die Seite beschreibt Art Direction, UX/UI und eigene Produkte, zeigt neben diesen Aussagen aber keine Arbeitsbeispiele. Gerade die Kombination aus Markenarbeit und selbst entwickelten Produkten könnte Dennis von anderen Profilen unterscheiden. Diese Verbindung sollte sichtbar werden.

**Die Rolle wird mehrfach erzählt.** Das Rollenlabel, der kurze Einführungstext, die Metadaten und die aktuelle Berufsstation wiederholen die berufliche Einordnung. Gleichzeitig gibt es wenig Raum für eine verständliche Aussage dazu, welche Aufgaben Dennis übernimmt und wie die unterschiedlichen Disziplinen zusammenhängen.

**Die Details überlagern die fachliche Einordnung.** Aktuelle Tätigkeit und Weiterbildung stehen weit vorne; mehrere Jahre praktischer Erfahrung liegen unter „Frühere Stationen“. Damit kann die Gewichtung unbeabsichtigt ein weniger erfahrenes Profil vermitteln, als die vorhandenen Angaben tatsächlich beschreiben. Eine vollständige Chronologie ist nützlich, sollte aber nicht die Eröffnung bestimmen.

**Die Hülle passt funktional, aber nicht ausreichend gestalterisch.** Die dunkle Fläche und die Verbindung zur Halle sind gute Grundlagen. Mehrere Rahmen, die zusätzliche Seitenkarte und das technische Hintergrundmuster erzeugen jedoch eine allgemeine Softwareästhetik. Der Inhalt braucht eine eigene Komposition innerhalb der gemeinsamen Website-Hülle.

**Die Styles haben mehrere Verantwortliche.** `AboutOverlay.astro` übernimmt viele generische Panelklassen. `about-panel.css` definiert zunächst eine runde, beleuchtete Porträtfläche; `src/styles/arcade-interface.css` überschreibt sie später zu einer flachen rechteckigen Box. Ein neuer Entwurf sollte mit klarer Zuständigkeit umgesetzt werden, damit weitere Korrekturen nicht erneut auf widersprüchlichen Überschreibungen aufbauen.[^1]

## Erkenntnisse aus der Recherche

### Identität sollte Teil der Gestaltung sein

Bei Dennis Snellenberg steht auf der About-Seite eine kurze Einführung neben einer großen Umgebungsfotografie. Adham Dannaway verwendet einen sehr großen, ausdrucksstarken Gesichtsausschnitt. Seán Halpin verbindet eine dunkle Gestaltung mit einem warmen Porträt und groß gesetzter beruflicher Einordnung. Die gemeinsame Beobachtung ist die Rolle des Bildes: Es trägt die Komposition, statt nur die Identität zu kennzeichnen.[^2][^3][^4]

Für Dennis lässt sich daraus eine konkrete Richtung ableiten: Gesicht, Ausdruck und Bildschnitt bekommen einen vergleichbaren Stellenwert wie der Name. Dabei ist keine Übernahme der Farben oder Formen dieser Seiten nötig. Der dunkle Raum bleibt bestehen; natürliche Hauttöne bringen einen menschlichen Schwerpunkt hinein.

### Visuelle Eigenständigkeit braucht nicht viele Bedienelemente

Tobias van Schneider arbeitet auf seiner Homepage mit schwarzem Grund, monumentaler weißer Typografie, sparsamen roten Akzenten und einem eng geschnittenen Schwarzweißporträt. Rauno Freibergs aktueller Einstieg verwendet großformatige typografische Kompositionen. Beide Beispiele zeigen, wie sehr Gewichtung und Auswahl den Eindruck prägen können.[^5][^6]

Die Übertragung auf dieses Portfolio lautet: Eine sorgfältig gesetzte Namenskomposition und ein starker Bildausschnitt leisten mehr als zusätzliche Chips, technische Markierungen und dekorative Rahmen. Ein dunkles Interface wird nicht automatisch hochwertig, wenn es mehr metallische Kanten erhält.

### Fachliche Aussagen brauchen Belege

NN/g beschreibt auf Grundlage einer Befragung von 204 Personen mit UX-Einstellungsverantwortung die Bedeutung nachvollziehbarer Aufgaben, Entscheidungen und eigener Beiträge. Die Untersuchung stammt aus 2019; sie ist keine aktuelle Marktstatistik und untersucht nicht speziell ein Arcade-Portfolio. Ihre Empfehlung, Inhalte überfliegbar und fachliche Leistungen verständlich zu machen, ist hier dennoch relevant.[^7]

In Interviews mit sechs UX-Führungskräften bei Indeed werden außerdem reale Arbeit, erkennbare Stärken und sorgfältige visuelle Ausarbeitung betont. Auch diese Quelle ist älter, von April 2020. Zusammen stützen die Quellen eine Verbindung von überzeugender Präsentation und konkretem Arbeitsnachweis.[^8]

Für den Über-mich-Bereich bedeutet das: Drei ausgewählte Projekte sollen seine drei Schwerpunkte anschaulich machen. Sie ersetzen keine Case Studies. Sie geben einen verständlichen Einstieg und führen mit einem normalen Link zum jeweiligen Projekt.

### Details können sichtbar erreichbar bleiben, ohne den Einstieg zu besetzen

Progressive Disclosure priorisiert häufig benötigte Informationen und macht weiterführende Details auf Nachfrage zugänglich. Das Prinzip passt zu früheren Stationen, vollständigen Ausbildungsangaben und einer ausführlichen Werkzeugliste. Identität, Tätigkeit, relevante Arbeit und Kontakt gehören dagegen auf die erste Ebene.[^9]

Dabei sollte die Seite nicht zu einer Sammlung geschlossener Akkordeons werden. Ein kurzer Werdegang und die wichtigsten Qualifikationen bleiben direkt lesbar. Nur die ausführlichen Ergänzungen werden verdichtet.

## Referenzen und konkrete Übertragung

Die folgenden Referenzen wurden auf ihren Primärseiten recherchiert; die genannten gestalterischen Merkmale wurden zusätzlich visuell im Browser geprüft. Die mobilen Varianten, Ladezeiten und sämtlichen Interaktionen der fremden Seiten wurden nicht systematisch getestet. Die Beobachtungen sind deshalb Gestaltungsreferenzen, keine Qualitätszertifizierung.

| Referenz | Beobachteter Ansatz | Übertragbares Detail | Für Dennis ungeeignet |
|---|---|---|---|
| Dennis Snellenberg, About | Große Fotografie neben einem knappen Text; klare asymmetrische Aufteilung | Das Porträt als eigenständige Fläche behandeln | Die vollständige Höhe eines frei scrollenden Seitenauftakts im kompakten Panel nachbauen |
| Adham Dannaway, About | Ausdrucksstarkes, sehr großes Gesicht; persönliche Bilder und berufliche Inhalte | Näherer Bildschnitt und sichtbarer Ausdruck | Helle Farbwelt, bunte Dekoration und spielerische Skill-Prozentwerte |
| Seán Halpin, About | Dunkler Grund, warmes Porträt, markante Schrift | Menschlichkeit durch Hauttöne und Typografie | Die charakteristische Bogenform als fremdes Motiv übernehmen |
| Tobias van Schneider, Homepage | Schwarz, große weiße Typografie, knapp gesetzte Akzente, Produktbezug | Selbstbewusste Gewichtung und Verbindung von Person und Arbeit | Eine zusätzliche lange Auftaktinszenierung |
| Rauno Freiberg, Homepage | Posterartige typografische Kompositionen | Die Vorstellung selbst als gestaltetes Objekt verstehen | Horizontale Präsentation und fremde Farbwelt |
| Locomotive, Homepage/Agency | Großflächige menschliche Bilder und expressive Schrift | Haltung und Personen vor dem Leistungsinventar | Ein zusätzliches Vollbildvideo neben der bereits bewegten Halle |
| Brittany Chiang, Homepage | Dunkle, gut gegliederte Identität und Inhaltsabschnitte | Lesbarkeit und Orientierung als Mindestqualität | Den zurückhaltenden Lebenslaufaufbau zur eigentlichen neuen Art Direction erklären |

Die Quellen zu den letzten beiden Beispielen stehen im Quellenverzeichnis.[^10][^11] Das Ziel ist eine eigene Verbindung der Prinzipien, keine Collage aus erkennbaren Website-Motiven.

## Richtung A: Studio-Porträt

### Komposition

Im breiten Panel stehen Text und Name links, das Porträt rechts. Das Foto erhält ungefähr 40 Prozent der Auftaktfläche. Diese Anordnung ist für die vorhandene Halle sinnvoll: Links außerhalb des Inhalts steht bereits der Greifautomat mit der Puppe. Ein rechts platziertes Porträt verteilt die visuellen Schwerpunkte, statt zwei ähnliche Figuren unmittelbar nebeneinander aufzureihen.

„Dennis“ kann die größte Textzeile sein. Der vollständige Nachname steht klar lesbar darunter oder daneben, abhängig von der verfügbaren Breite. Die vorhandene Berufsbezeichnung bleibt als verständliche zweite Ebene erhalten. Danach folgen ein kurzer persönlicher Absatz und Kontakt. Die Einordnung als professioneller Designer muss ohne Scrollen und ohne Interaktion verständlich sein.

Die Porträtfläche darf näher an die obere und rechte Innenkante reichen als der Text. Diese kontrollierte Asymmetrie macht den Auftakt weniger formularartig. Die Augen bleiben frei, die Haare erhalten Luft, und der Schulteransatz verbindet das Gesicht mit dem übrigen Körper. Ein großer leerer Kasten um das Bild ist unnötig.

### Material und Licht

Der Text liegt auf einem nahezu deckenden Anthrazit. Die fotografische Fläche kann wie ein sorgfältig montiertes Bild hinter leicht getöntem Glas wirken. Gesicht und Haut bleiben klar; das Licht sitzt an der Fassung und in den dunklen Bildbereichen. Ein feiner eisfarbener Reflex mit einem kleinen violetten Anteil reicht als Bezug zur vorhandenen Irideszenz.

Als eigenes Detail wird eine schmale Lichtfuge vorgeschlagen, deren Geometrie von der eingesetzten Scheibe des Greifautomaten abgeleitet ist. Am Automaten und am Porträtfeld muss dieselbe plausible Lichtrichtung gelten. Die Verbindung sollte gestalterisch erkennbar sein, ohne eine empfindliche, pixelgenaue Linie über zwei voneinander unabhängige Layoutbereiche zu spannen.

Das Material ist ein Rahmen für die Person. Es darf nicht zu einer milchigen Glasschicht, einem Hologramm über der Haut oder einer stark leuchtenden Sammelkarte werden.

### Inhalt und Interaktion

Unter dem Auftakt stehen drei offene Arbeitsbereiche: Art Direction, UX/UI und eigene Produkte. Jeder erhält einen kurzen Satz, ein geeignetes reales Bilddetail und einen klaren Projektlink. Darunter folgen die aktuelle Tätigkeit und eine verdichtete Chronologie.

Optional verschiebt sich ein weicher Reflex in der Fassung bei einer Zeigerbewegung geringfügig. Das Porträt selbst und die Schrift bleiben stabil. Auf Touchgeräten und bei reduzierter Bewegung ist die Fassung statisch. Der Entwurf muss bereits als unbewegtes Bild überzeugen.

### Stärke und Risiko

Diese Richtung verbindet persönliche Präsenz, professionelle Klarheit und die Materialwelt der Halle am ausgewogensten. Das wichtigste Risiko ist ein austauschbares „großes Foto neben großem Text“. Dagegen helfen ein eigener Bildschnitt, die bewusste Namenskomposition und die Verbindung zur echten Arbeit. Zusätzliche Dekoration wäre kein Ersatz dafür.

## Richtung B: Arbeitsproben aus dem Studio

### Komposition

Ein großes Porträt wird mit zwei oder höchstens drei echten Arbeitsfragmenten zu einer bewusst gesetzten Studiofläche verbunden. Ein Interfaceausschnitt, eine Arbeit zur Bildsprache und ein selbst entwickeltes Produkt zeigen direkt, worin Dennis’ Tätigkeit besteht. Die Ausschnitte bekommen unterschiedliche Größen entsprechend ihrer Bedeutung, bleiben aber an gemeinsamen Kanten ausgerichtet.

Die Arbeitsproben dürfen am unteren oder seitlichen Rand der Porträtfläche sitzen. Gesicht, Name und Kontakt bleiben frei. Eine einzelne kontrollierte Überlappung kann räumliche Tiefe erzeugen. Mehrere gedrehte Miniaturkarten würden schnell wieder unruhig wirken.

### Geeignete Inhalte

Mögliche Kandidaten sind eine vorhandene Arbeit aus Visual Craft beziehungsweise Forever, Mina als UX-Case-Study und NEXUS oder Lowlight für eigene Produkte. Vor der endgültigen Auswahl müssen die jeweiligen Case-Inhalte den fachlichen Schwerpunkt tatsächlich belegen. Die Bezeichnung eines Projekts allein ist kein Nachweis für eine bestimmte Methode oder ein Ergebnis.

Die Bildunterschriften verwenden die vorhandenen Projektnamen und eine kurze sachliche Rollenbeschreibung. Neue Fantasielabels, erfundene Kundenbewertungen oder dekorative Leistungswerte sind nicht erforderlich. Persönliche Gegenstände sollten nur dann hinzukommen, wenn sie tatsächlich vorhanden und inhaltlich relevant sind.

### Interaktion und mobile Form

Ein Projektlink kann seine zugehörige Arbeitsprobe leicht hervorheben. Das Ziel ist bereits ohne Hover sichtbar, und ein Klick führt unmittelbar zum Projekt. Die Bilder wechseln nicht automatisch. Es gibt keinen ziehbaren Stapel und keine versteckte Information hinter einer spielerischen Geste.

Mobil wird aus der Komposition eine klare Folge: Person, Einführung, Kontakt, Arbeitsproben. Überlappungen verschwinden. Jede Probe wird zu einem verständlichen Bildlink mit genügend Berührungsfläche.

### Stärke und Risiko

Diese Richtung zeigt am unmittelbarsten den Designer, der eigene Produkte baut. Sie hat zugleich das größte Risiko für visuelle Unruhe. Die kleine Auswahl ist deshalb entscheidend: drei gute Belege sind stärker als ein vollständiges Moodboard. Die überzeugendsten Teile dieser Richtung lassen sich unter den Auftakt von Richtung A übernehmen.

## Richtung C: Dunkles persönliches Poster

### Komposition

Der gesamte erste Inhaltsbereich wird als eine einzige fotografische Posterkomposition gestaltet. Ein engeres Porträt, eine große Namenssetzung und die bestehende berufliche Einordnung bilden gemeinsam den Auftakt. Typografie kann am Schulterbereich mit dem Bild überlagert werden; Augen und Mund bleiben frei.

Der Effekt entsteht über große, klar unterscheidbare Formen. Ein warmer Hautton vor einem tiefen, ruhigen Hintergrund und eine präzise gesetzte Schrift reichen aus. Eine kurze sachliche Positionierung kann die Disziplinen zusammenführen. Ein künstlich pathetisches Manifest wäre für die vorhandenen Informationen nicht glaubwürdig.

### Inhalt und mobile Form

Direkt am Auftakt bleiben Rolle, Verfügbarkeit und Kontakt sichtbar. Darunter folgt der Inhalt in wenigen klaren Kapiteln. Für das Handy braucht dieses Konzept einen eigenen Bildschnitt und eigene Zeilenumbrüche. Ein verkleinertes Desktopposter würde die bisherigen Probleme mit zu kleinem Gesicht und zu kleiner Schrift wiederholen.

### Stärke und Risiko

Das Poster ist die stärkste einzelne Bildinszenierung und entfernt sich am weitesten vom Lebenslaufcharakter. Es verlangt jedoch sehr gutes Ausgangsmaterial und sorgfältige Typografie. Ohne diese Qualität wirkt es leicht wie eine beliebige Modekampagne. Außerdem kann es im Panel unnötig viel Höhe verbrauchen, bevor die fachlichen Belege beginnen.

## Vergleich und Entscheidung

| Kriterium | A: Studio-Porträt | B: Arbeitsproben | C: Persönliches Poster |
|---|---|---|---|
| Gesicht und Persönlichkeit | Sehr stark | Stark, mit Konkurrenz durch Arbeitsbilder | Sehr stark |
| Fachliche Belege | Stark mit anschließender Projektauswahl | Am unmittelbarsten | Braucht einen deutlichen zweiten Abschnitt |
| Verbindung zur Arcade | Über Licht und Material sehr gut | Über gestaltete Objekte gut | Über Tonalität und Rahmen mittel bis gut |
| Lesbarkeit und schnelle Orientierung | Gut kontrollierbar | Von strenger Auswahl abhängig | Von der Typografie abhängig |
| Risiko erneuter Unruhe | Gering bis mittel | Am höchsten | Mittel |
| Aufwand für eine gute mobile Fassung | Überschaubar | Eigenständige Stapelung nötig | Eigener Bildschnitt zwingend |

Die Bewertung ist eine gestalterische Einschätzung. **A sollte die Grundlage bilden; B liefert die Arbeitsbelege.** C eignet sich als bewusst mutigere Vergleichsvariante für ein späteres Bildmockup. Ein „Character Select“-Profil mit Klassen, Levelwerten oder Seltenheitsrahmen wird nicht empfohlen: Die Puppe im Greifautomaten übernimmt bereits die spielerische Selbstdarstellung. Der Inhalt sollte die Person dahinter verständlich machen.

## Vorgeschlagener Inhaltsaufbau

### Sofort sichtbar

Name, Berufsbezeichnung, großes Gesicht, eine kurze Positionierung und Kontakt bilden eine gemeinsame erste Lesestufe. „Offen für Freelance“ erscheint einmal. Die aktuelle Tätigkeit bei Floordirekt bleibt deutlich benannt, damit die Verfügbarkeit richtig eingeordnet werden kann.

Ein möglicher Text, ausschließlich aus den bestehenden Angaben abgeleitet:

> **Dennis Bierreth-Fernandez**  
> Art Director · UX/UI · Product Builder
>
> Ich gestalte Marken, digitale Erlebnisse und eigene Produkte. Seit über sechs Jahren arbeite ich in Agenturen und Unternehmen. Heute bin ich Art Director bei Floordirekt und entwickle daneben eigene Apps, Spiele und Tools.
>
> Offen für ausgewählte Freelance-Projekte.

Dieser Text ist ein Entwurf. Er ersetzt die mehrfachen Rollenwiederholungen und vermeidet den technisch-abstrakten Ausdruck „Richtung, Branding und eigene Builds“ im Einstieg.

### Direkt darunter

Drei Schwerpunkte erhalten jeweils ein Bild und einen kurzen Satz. Art Direction steht für Markenauftritte, Kampagnen und Bildsprache. UX/UI steht für Research, Prototyping und Design-Systeme. Eigene Produkte verbinden Konzept, Gestaltung und laufenden Build. Die Beispiele sollen sich visuell unterscheiden und echte passende Projekte zeigen.

### Auf der zweiten Lesestufe

Aktuelle Tätigkeit und ausgewählte Berufsstationen erscheinen in einer kurzen, offen gesetzten Chronologie. Der Mediendesign-Abschluss und das UX/UI-Zertifikat bleiben knapp sichtbar. Vollständige Ausbildung, frühere Stationen und Werkzeuge erhalten klar benannte Erweiterungen. Standort und Sprachen lassen sich in einer schmalen sachlichen Zeile zusammenfassen.

Kontakt bleibt der primäre Handlungsweg. Die E-Mail-Adresse ist lesbar und kopierbar; LinkedIn erscheint als sekundärer Link. Im bereitgestellten Screenshot steht an der E-Mail-Position „[email protected]“. Vor der Umsetzung sollte geprüft werden, ob dies eine Aufnahmebesonderheit oder ein tatsächliches Darstellungsproblem der Live-Seite ist. Ein späterer Lebenslauf-Download sollte erst angeboten werden, wenn ein brauchbares und geprüftes Dokument dafür vorliegt.

## Porträtbriefing

Das vorhandene transparente `portrait-v12.webp` hat 1024 × 1024 Pixel und zeigt den Oberkörper mit verschränkten Armen. Das Gesicht nutzt ungefähr ein Viertel der Bildbreite. Ein größer dargestelltes Quadrat liefert deshalb nicht automatisch ein ausreichend großes oder scharfes Gesicht.[^1]

Für die bevorzugte Richtung wird ein Kopf-Schulter-Ausschnitt benötigt. Der Blick bleibt ruhig und natürlich; Haare, Augen und Gesichtskontur dürfen nicht von Leuchteffekten oder Schrift überlagert werden. Der dunkle Pullover kann in den Hintergrund auslaufen. Die Hände müssen in diesem Ausschnitt keine tragende Rolle spielen.

Für ein großes Desktopfeld ist ein fertiger Crop von ungefähr 1200 × 1500 Pixeln ein sinnvolles Asset-Ziel, sofern geeignetes Ausgangsmaterial existiert. Zuerst sollte das beste erhaltene Original gesucht werden. Ein kleiner Ausschnitt darf nicht bloß stark vergrößert und als neue Detailqualität ausgegeben werden. Gesichtszüge werden bei einer späteren Bildbearbeitung nicht generativ neu erfunden.

Bei einer inneren Inhaltsbreite von etwa 1100–1400 Pixeln kann das Porträtfeld ungefähr 360–460 Pixel breit und 420–520 Pixel hoch sein. Entscheidend ist die tatsächliche Gesichtsgröße im Entwurf: als Startwert etwa 180–230 Pixel Breite. Bei einem nur 800–1000 Pixel breiten Panel muss diese Komposition enger werden, ohne in die alte Avataranordnung zurückzufallen.

## Responsive Verhalten

Die Gestaltung sollte auf die **verfügbare Panelbreite** reagieren. Der gleiche Viewport kann je nach Hallenansicht oder Lesemodus sehr unterschiedlich viel Raum für den Inhalt bieten. Eine alleinige Orientierung an Bildschirm-Breakpoints würde diese Situation nicht zuverlässig erfassen.

Auf breiten Panels entsteht ein gemeinsamer zweispaltiger Auftakt. Auf mittleren Panels werden Abstand und Bildfläche angepasst; die vollständigen Nachnamen dürfen sinnvoll umbrechen. Im schmalen Panel wird die Reihenfolge bewusst einspaltig: Name und Rolle, Porträt, kurze Einführung und Kontakt. Das Bild bleibt präsent, muss aber nicht vor allen wichtigen Angaben einen gesamten Handybildschirm füllen.

Für 390 Pixel Viewportbreite ist eine Porträtfläche um 290–320 Pixel Breite ein sinnvoller Startpunkt. Die tatsächliche Höhe hängt vom Gesichtsausschnitt ab. Unterhalb des Auftakts folgen normale vertikale Projektlinks. Eine zweite horizontale Scrollrichtung für Lebenslauf oder Arbeitsproben ist nicht vorgesehen.

W3C beschreibt für Reflow unter anderem die Nutzbarkeit bei 320 CSS-Pixeln Breite ohne zweidimensionales Scrollen. Die relevante Anforderung an Zielgrößen nach WCAG 2.2 AA beträgt grundsätzlich 24 × 24 CSS-Pixel, mit definierten Ausnahmen; 44 Pixel hohe wichtige Bedienelemente sind hier ein weitergehender Entwurfswert.[^12][^13]

## Bewegung und technische Leitplanken

Das Panel muss seine endgültige Größe und seinen Inhalt unmittelbar bereitstellen. Die gestalterische Inszenierung darf keine neue Wartestufe, kein verzögertes Aufklappen und keinen gestaffelten Textaufbau verursachen. Eine kurze gemeinsame Einblendung von ungefähr 140–200 Millisekunden ist ein möglicher Entwurf, aber keine universelle Vorgabe.

Die bestehende 3D-Halle bleibt erhalten. Das Porträt benötigt keine weitere WebGL-Szene, keine laufende Videotextur und keine zusätzliche Initialisierung. Falls ein Reflex verwendet wird, bewegt sich lediglich ein kleiner dekorativer Ausschnitt. Breite, Höhe und Gesamtanordnung des Panels bleiben währenddessen stabil.

Google empfiehlt bei Animationen insbesondere, Layout- und Paint-Arbeit zu prüfen und bevorzugt geeignete Transformations- beziehungsweise Deckkraftanimationen. Das ist eine technische Grundlage, keine Garantie für ruckelfreie Darstellung auf jeder Hardware.[^14] Nicht notwendige Bewegung sollte auf die Einstellung für reduzierte Bewegung reagieren. W3C beschreibt diese Anforderung für interaktionsbedingte Animationen im AAA-Kriterium 2.3.3.[^15]

## Übertragung auf die anderen Inhaltsbereiche

Ein eigener About-Auftakt muss nicht zu einer inkonsistenten Website führen. Gemeinsam bleiben die dunkle Grundfläche, die äußere Fassung, lesbare Typografie, Kontakt- und Zurück-Verhalten sowie die Projektorientierung am unteren Rand. Diese Elemente bilden das gemeinsame System.

Der innere Aufbau darf dem jeweiligen Inhalt folgen. Über mich beginnt mit Person und Haltung. Projekte beginnen mit einer starken Arbeit, der Rolle und dem relevanten Kontext. Kontakt beginnt mit verständlichen Wegen zur Zusammenarbeit. So erhält jede Ansicht eine klare Aufgabe, während Material, Abstände und Interaktionen verwandt bleiben.

Der bestehende Hintergrund mit Leiterbahnen sollte dabei erneut beurteilt werden. Im About-Auftakt konkurriert er mit Porträt und Text, ohne eine zusätzliche Information zu liefern. Ein ruhigerer Innenraum kann die Verbindung zur dreidimensionalen Halle sogar deutlicher machen, weil sich ihre Materialität nicht in jeder Textfläche wiederholen muss.

## Nächster visueller Entscheidungsstand

Vor einer Umsetzung sollten zwei tatsächlich generierte Bildmockups verglichen werden: zuerst das bevorzugte Studio-Porträt mit drei kuratierten Arbeitsbelegen, dann eine mutigere Posterfassung. Beide verwenden dasselbe Gesicht, dieselben Informationen und dieselbe dunkle Umgebung. Die Richtungsnamen dieses Berichts sind interne Arbeitstitel und gehören nicht als neue Beschriftung auf die Website.

Für den fairen Vergleich braucht jedes Mockup eine breite Panelansicht und eine schmale mobile Fassung. Der Bildbrief sollte die bestehende Halle samt Greifautomat als Kontext nennen, das deutlich größere Gesicht priorisieren und zusätzliche erfundene Texte ausschließen. Schrift und Fachinformationen sind in generierten Bildern nur eine Gestaltungsannäherung; die spätere Website braucht echte, sauber gesetzte Texte.

Die Auswahl wird an konkreten Fragen beurteilt: Ist Dennis sofort als Person präsent? Sind Tätigkeit und Kontakt auf Anhieb verständlich? Zeigen die Arbeitsbeispiele eine eigene gestalterische Handschrift? Passt das Material zur Halle? Funktioniert dieselbe Idee auch unbewegt und auf einem kleinen Display?

## Quellen

[^1]: Lokale Primärunterlagen: bereitgestellter Screenshot `codex-clipboard-50c0f666-2c7a-44e3-be48-033cf8cb9dd5.png`; `src/components/work/AboutOverlay.astro`; `src/components/work/about-panel.css`; `src/styles/arcade-interface.css`; `src/lib/site.ts`; `src/lib/i18n.ts`; `public/media/me/portrait-v12.webp`. Geprüfter Projektstand: 11. September 2026. Der Screenshot und die Bilddatei sind nicht öffentlich als Forschungsquelle veröffentlicht.
[^2]: Dennis Snellenberg. [About](https://dennissnellenberg.com/about). Ohne Veröffentlichungsdatum; visuell geprüft am 11. September 2026. Der Textreader erhielt 403, die Seite war im Browser zugänglich.
[^3]: Adham Dannaway. [About](https://www.adhamdannaway.com/about). Ohne Veröffentlichungsdatum; visuell geprüft am 11. September 2026.
[^4]: Seán Halpin. [About](https://www.seanhalpin.xyz/about). Ohne Veröffentlichungsdatum; visuell geprüft am 11. September 2026.
[^5]: Tobias van Schneider / House of van Schneider. [Creative Direction](https://vanschneider.com/). Ohne Veröffentlichungsdatum; visuell geprüft am 11. September 2026.
[^6]: Rauno Freiberg. [Portfolio](https://rauno.me/). Ohne Veröffentlichungsdatum; visuell geprüft am 11. September 2026.
[^7]: Rachel Krause, Nielsen Norman Group. [5 Steps to Creating a UX-Design Portfolio](https://www.nngroup.com/articles/ux-design-portfolios/). 4. August 2019. Verwendet für Nachvollziehbarkeit der Arbeit, Priorisierung und Lesestruktur.
[^8]: Sriratana Sutasirisap, Indeed Design. [UX Design Portfolio Advice from Hiring Managers](https://indeed.design/article/ux-design-portfolio-advice-from-hiring-managers/). April 2020. Verwendet für Arbeitsbelege, Stärken und gestalterische Ausarbeitung.
[^9]: Jakob Nielsen, Nielsen Norman Group. [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/). 3. Dezember 2006; abgerufen am 11. September 2026. Verwendet für die Trennung zentraler Inhalte und vertiefender Details.
[^10]: Locomotive. [Homepage](https://locomotive.ca/en) und [Agency](https://locomotive.ca/en/agency). Ohne Veröffentlichungsdatum; Homepage visuell geprüft am 11. September 2026, Agenturseite inhaltlich recherchiert.
[^11]: Brittany Chiang. [Portfolio](https://brittanychiang.com/). Ohne Veröffentlichungsdatum; visuell geprüft am 11. September 2026. Verwendet als Referenz für Orientierung, nicht als neue Art Direction.
[^12]: W3C WAI. [Understanding SC 1.4.10: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). WCAG 2.2, erläuterndes Dokument; abgerufen am 11. September 2026.
[^13]: W3C WAI. [Understanding SC 2.5.8: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). WCAG 2.2, erläuterndes Dokument; abgerufen am 11. September 2026.
[^14]: Kayce Basques und Rachel Andrew, web.dev. [How to create high-performance CSS animations](https://web.dev/articles/animations-guide). Aktualisiert am 6. Oktober 2020; abgerufen am 11. September 2026.
[^15]: W3C WAI. [Understanding SC 2.3.3: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html). Aktualisiert am 16. September 2025; abgerufen am 11. September 2026.
