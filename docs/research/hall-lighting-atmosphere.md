# Licht und Atmosphäre für die Portfolio-Halle

## Empfehlung

Die Halle sollte wie eine sorgfältig beleuchtete Ausstellung bei Nacht wirken: dunkler Stein, klar erkennbare Silhouetten, weiche Lichtkanten auf Lack und Glas und lokale Farbräume rund um die einzelnen Automaten. Riftback darf warmes Gold auf den Boden werfen, Nexus eine zurückhaltende violette Umgebung erzeugen und Lowlight mit Champagner und warmem Grau arbeiten. Die gemeinsame dunkle Architektur verbindet diese Bereiche.

Empfohlen wird ein **hybrides Lichtsystem**: eine eigens gestaltete Umgebungskarte, in Blender vorberechnete indirekte Beleuchtung und Kontaktschatten, wenige dynamische Flächenlichter sowie eine materialabhängige planare Bodenreflexion. Damit wird der bestehende Three.js-WebGL-Renderer weiterverwendet. Ein Wechsel der Engine ist für dieses Ziel nicht erforderlich.

Das entscheidende Qualitätsmerkmal ist die zusammenhängende Wirkung einer Quelle: Leuchtet am Automaten eine violette Leiste, müssen der benachbarte Lack, die Wand und der Boden dieses Violett in unterschiedlichen Stärken und Formen aufnehmen. Der Bildschirm bleibt gut lesbar; das Licht übernimmt die räumliche Inszenierung.

Als gestalterische Referenz ist die Behandlung nächtlicher Innenräume in *Soul* hilfreich: Pixar beschreibt dort das Zusammenspiel von Materialgestaltung, natürlichem Licht und gezielten farbigen Lichtsetzungen. Die übertragbare Idee ist die plastische, taktile Wirkung von Oberflächen. Die konkrete Web-Umsetzung bleibt wesentlich einfacher als ein Filmrenderer. [1]

## 1. Was die aktuelle Szene tatsächlich macht

Untersucht wurde der lokale Stand mit Three.js **0.181.0**, einschließlich der laufenden Halle bei 1600 × 1000 Pixeln. Die folgenden Befunde stammen aus dem Projektcode und einer Browserdiagnose, nicht aus allgemeinen Vermutungen über Three.js.

| Bereich | Festgestellter Zustand | Bedeutung für den sichtbaren Look |
|---|---|---|
| Allgemeines Licht | AmbientLight 2,2; HemisphereLight 1,2; Environment-Intensität 0,38 | Mehrere globale Beiträge, aber ihre tatsächliche Wirkung ist sehr unterschiedlich. |
| Umgebungskarte | Vorberechnete Standard-`RoomEnvironment` | Materialien reagieren auf die Beleuchtung eines generischen Studioraums statt auf die sichtbare Halle. |
| Deckenlicht | Fünf breite Spots, jeweils Intensität 26 | Große Flächen werden ähnlich beleuchtet; die Lichtsetzung modelliert die einzelnen Automaten wenig gezielt. |
| Bewegung der Spots | Positionen werden in `applyFocus()` unmittelbar um den neuen Fokus angeordnet | Die Lampen springen beim Fokuswechsel; sie sind nicht an feste architektonische Quellen gebunden. |
| Schatten | `renderer.shadowMap.enabled === false`; alle neun gefundenen Lichter ohne Schatten | Es gibt keine dynamischen geworfenen Schatten. Textur-AO kann vorhanden sein, ersetzt aber den Kontakt zwischen Maschine und Raum nicht. |
| Projektlicht | Ein RectAreaLight und ein PointLight am Fernseher; kein entsprechendes Lichtsystem pro realem Automaten | Die Projektfarben sind überwiegend Material-/Displayfarben und TV-Beleuchtung. Sie werden nicht konsistent zu lokalem Licht im Raum. |
| Boden | Spiegel, Grundfläche und transparente Fliesenauflage als getrennte Flächen | Die Fliesenrauheit beeinflusst die eigentliche Spiegelung nicht. |
| Reflexionsauflösung | 512 × 256, unabhängig vom Seitenverhältnis | Besonders auf breiten Ansichten werden wenige vertikale Pixel stark gedehnt. |
| Reflexionsfilter | Feste horizontale und vertikale Unschärfe | Die Filterung kennt weder Materialrauheit noch Höhe/Entfernung des reflektierten Objekts. |
| Reflexionsformat | Aufnahme in HalfFloat, beide Blur-Ziele in UnsignedByte | Heller Lichtumfang kann vor der finalen Bildausgabe verloren gehen. |
| Farbige Bodenflächen | Additive Gradienten, im aktuellen Fokuscode ausschließlich im Lite-Modus sichtbar | Diese Flächen sind eine Näherung auf dem Boden und beleuchten keine Nachbaroberflächen. Sie erklären nicht die gesamte Desktop-Reflexion. |
| Qualitätswechsel | Bloom wird auf niedrigeren Leistungsstufen abgeschaltet | Der Grundlook muss ohne Bloom funktionieren, sonst verändert ein Leistungswechsel die Stimmung deutlich. |

Die bloße Größe einer Lichtintensität sagt wenig über ihren Beitrag aus. Beispielsweise sind die Farben des Ambient- und Hemisphärenlichts sehr dunkel. Aus „Intensität 2,2“ allein lässt sich deshalb keine Überbelichtung ableiten.

### Vergleich mit einzeln abgesenkten Lichtbeiträgen

Für einen kontrollierten Vergleich wurde die lokale Kamera angehalten. Jeweils nur eine Gruppe wurde verändert; anschließend wurde dieselbe Ansicht neu gerendert. Gemessen wurden die mittleren ausgegebenen RGB-Werte in zwei festen Bildausschnitten. Diese Werte sind **nichtlinear kodierte Bildschirmwerte, keine physikalischen Lichtanteile**.

| Diagnosevariante | Dunkler Wandausschnitt, Mittelwert RGB | Unterer Greifautomaten-Korpus, Mittelwert RGB |
|---|---:|---:|
| Unveränderter Stand | 15,0 | 41,0 |
| Ambient + Hemisphere auf 18 % | 14,9 | 40,4 |
| Spots auf 20 % | 14,4 | 29,0 |
| Environment auf 15 % | 0,9 | 14,5 |
| Beide TV-Lichter aus | 14,8 | 40,7 |

**Schlussfolgerung:** In diesen beiden Ausschnitten ist die Umgebungskarte der stärkste der untersuchten Aufhellungsfaktoren. Die Spots prägen zusätzlich den Automatenkörper. Die ursprüngliche Annahme, hauptsächlich das Ambient-Licht sei verantwortlich, wird durch diesen Vergleich nicht gestützt. Der TV-Wandbereich liegt bewusst außerhalb des gemessenen Wandausschnitts; seine lokale Aufhellung ist sichtbar und wird durch diese Zahlen nicht bewertet.

Ein simples Absenken des Environments würde den Raum zwar dunkler machen, aber zugleich viele Materialien ihrer Formreflexe berauben. Es muss durch gezieltere Beleuchtung ersetzt werden. Die stark abgesenkten Varianten sind Diagnosebilder, keine vorgeschlagenen Endwerte.

### Technischer Befund zur Reflexion

Im ausgelesenen Spiegelpuffer lagen 252 RGB-Kanalwerte über 1,0; der höchste Wert betrug rund 4,03. Die Spiegeltextur war HalfFloat (`1016`), beide anschließenden Blur-Texturen UnsignedByte (`1009`). Der Formatwechsel ist damit nicht nur theoretisch relevant: Helle Werte kommen tatsächlich an dieser Stelle an.

Wie viele Werte nach der gewichteten Filterung konkret begrenzt werden, wurde nicht separat gemessen. Dennoch sollte die gesamte Reflexionskette HDR erhalten, damit Highlights erst bei der abschließenden Tonwertabbildung komprimiert werden. Ein RenderTarget ohne expliziten Typ verwendet standardmäßig UnsignedByte. [11]

## 2. Gestalterische Richtung

### Ein dunkler Raum mit bewusst gesetzten Lichtinseln

Die Architektur bekommt eine sehr dunkle, leicht kühle Grundstimmung. Licht fällt überwiegend von sichtbaren Quellen aus: Displays, Leuchtschilder, schmale Leisten und einzelne Deckenleuchten. Zwischen den Automaten bleiben dunklere Zonen. Dadurch entsteht Rhythmus über die Reihe und die aktive Station erhält mehr Aufmerksamkeit.

Die Rückwand soll ihre Ziegelstruktur dort zeigen, wo Licht sie streift. Eine gleichmäßig bis oben ausgeleuchtete Wand wirkt eher wie eine Texturkulisse. Empfehlenswert ist ein langsamer Helligkeitsabfall nach oben und eine stärkere räumliche Trennung hinter dem aktuellen Automaten. Das gemalte Projektlogo muss weiterhin lesbar sein, ohne selbst wie eine Lampe zu wirken.

Die Figuren erhalten ein schwaches neutrales Formlicht. Farbige Akzente dürfen ihre Ränder und Kleidung beeinflussen; das Gesicht bleibt lesbar. Gerade beim Greifautomaten sollten Haut, schwarze Haare und lila Shirt nicht von einem kräftigen globalen Farbstich überzogen werden.

### Farbpalette

Die folgenden Hauptfarben sind aus den bestehenden Stationsdaten übernommen. Die vorgeschlagenen Lichtwirkungen sind gestalterische Entscheidungen, keine bereits implementierten Presets.

| Station | Bestehende Hauptfarbe | Empfohlene Wirkung im Raum |
|---|---|---|
| Über mich | `#c8daf4` | Kühle Perle, wenig Lavendel, sanft neutrales Licht auf der Figur. |
| Riftback | `#c9a45c` | Gedämpftes Gold, warme Reflexe unten, dunkler kühler Hintergrund. |
| Nexus | `#ac8bfd` | Weiches Violett, eisige schmale Kanten, dunkler Boden mit violettem Lichtsaum. |
| Lowlight | `#d8c3a5` | Champagner, warmes Grau, sehr zurückhaltende Lichtfelder. |
| Sauté Survivors | `#e03a2f` | Rötlich-amberfarbene Akzente; rote Lichtflächen räumlich begrenzen. |
| Echo Frequency | `#58c2ba` | Dunkles Petrol mit weichen türkisfarbenen Reflexen. |
| Kontakt | `#c8daf4` | Ruhige Rückkehr zur neutralen Perle der Halle. |

Gesättigte Farben bleiben nahe ihrer Quelle kräftiger und verlieren mit ihrer räumlichen Wirkung an Dominanz. Das ist ein vorgeschlagener künstlerischer Ausgleich: Eine riesige rote Wandfläche würde die Oberfläche anders lesen lassen als eine kleine rote Leiste. Die Abstimmung erfolgt deshalb pro Projekt, nicht mit einem identischen RGB-Multiplikator für alle Marken.

Irideszenz passt als dezenter Blickwinkeleffekt auf ausgewählten Kanten oder als UI-Akzent. Ein unmotivierter Regenbogenwechsel der Raumbeleuchtung passt nicht zu diesem Konzept. Auch Pixar trennt physikalisch plausible Grundlagen von bewusst gesteuerten stilistischen Eingriffen; Material- und Schattenwirkung werden für die Bildgestaltung gezielt angepasst. [2]

## 3. Umgebungskarte und direkte Lichtquellen

### Eine Umgebung, die zur Halle gehört

Die vorhandene PMREM wird aus Three.js `RoomEnvironment` erzeugt. Diese Klasse stellt ausdrücklich einen einfachen Raum für bildbasierte Beleuchtung bereit. Sie enthält keine Kenntnis der Portfolio-Halle. [5]

Empfohlen ist eine neue, überwiegend dunkle Umgebung mit wenigen langgezogenen Lichtformen: ein schwaches Deckenband, zwei seitliche Reflexionsflächen und viel dunklem Raum dazwischen. Die hellen Formen sollten zu realen oder zumindest plausiblen Leuchtenpositionen passen. Eine neutrale Basis verhindert, dass jede Station dieselbe globale Markenfarbe erhält.

Die Umgebung wird einmal vorab gefiltert. PMREM stellt unterschiedliche Unschärfestufen für die Materialrauheit bereit; die genaue Implementierung muss bei der installierten Version bleiben. Neuere Dokumentation kann andere interne Filterverfahren beschreiben. [6]

Diese Karte liefert breite, entfernte Reflexe. Das präzise lokale Violett von Nexus oder Gold von Riftback entsteht durch die jeweiligen lokalen Lichter und den Boden-Capture. So bleibt die Umgebungskarte beim Scrollen stabil und muss nicht pro Frame neu berechnet werden.

### Wenige Flächenlichter an tatsächlichen Emittern

RectAreaLights passen geometrisch zu Displays und Leisten. Ihre Reflexe haben eine erkennbare Breite und reagieren auf die Rauheit der Oberfläche. Die Forschung zu Linearly Transformed Cosines beschreibt eine effiziente Methode zur Echtzeitbeleuchtung mit polygonalen Flächenquellen; sie ist eine passende theoretische Grundlage für diesen Lichttyp. [3]

Wichtig ist die Three.js-Grenze: RectAreaLights unterstützen PBR-Materialien, werfen aber keine Schatten. Sie lösen Formlicht und Reflexe, nicht automatisch Verdeckung und Bodenkontakt. [4]

Als erster Prototyp empfiehlt sich ein fester Pool von vier RectAreaLights für den fokussierten Automaten und seine Nachbarn, zusätzlich zum bereits vorhandenen TV-Licht. Eine schmale reale Leiste kann durch eine entsprechend schmale Lichtfläche vertreten werden; ein Screen durch eine passend ausgerichtete Rechteckfläche. Dimensionen und Ausrichtung müssen aus dem jeweiligen Automatenmodell kommen.

Die Zahl vier ist ein Startbudget, keine nachgewiesene Leistungsgrenze. Wenn mehrere sichtbare Quellen wichtiger sind, muss die Verteilung statt der Gesamtzahl wachsen: beispielsweise ein Licht für den Screen, ein gemeinsamer Vertreter der Leisten und zwei Nachbarlichter. Fernere Stationen erhalten ihre Grundwirkung aus vorberechneten Beiträgen.

Die breiten Decken-Spots werden durch wenige architektonisch platzierte Lichtinseln ersetzt. Ein einzelner gezielter Spot kann eine besonders wichtige Silhouette und einen begrenzten Schatten liefern. Es gibt keinen Grund, bei jedem Fokuswechsel fünf Lampen im Raum umzuplatzieren.

## 4. Indirektes Licht und Kontaktschatten

Ein leuchtendes Material ist in der aktuellen Rasterpipeline keine vollständige Simulation des Lichts, das von dieser Fläche in den Raum zurückgeworfen wird. Bildschirmhelligkeit, direkte Beleuchtung und indirekte Beleuchtung müssen als unterschiedliche Beiträge gestaltet werden.

Die gewünschte weiche Farbwirkung an Wand und Sockeln eignet sich für Blender-Bakes. Cycles kann Beleuchtung und AO in Texturen berechnen; Lightmaps sind ausdrücklich ein Anwendungsfall. Dafür benötigen die Zielgeometrien geeignete UVs. [8]

### Sinnvolle Aufteilung der Bakes

**Neutrale Raumbeleuchtung:** Weiches indirektes Licht von Architektur und Decke, Wand-Boden-Kontakt und ruhige Verschattung hinter den stationären Maschinen. Diese Information bleibt während der Navigation räumlich stabil.

**Lokale Lichtantworten:** Pro relevanter Lichtgruppe wird die diffuse Antwort mit neutraler Quelle gebacken. Zur Laufzeit kann sie mit einer Projektfarbe und einer Intensität gewichtet werden. Eine solche Einfärbung ist eine Näherung. Bei stark farbigen Materialien, mehreren Lichtwegen oder stark veränderter Quellgeometrie stimmt sie nicht exakt; dort sind getrennte Bakes oder echte lokale Lichter nötig.

**Maschinenkontakt:** Individuelle weiche Schatten beziehungsweise AO-Fußabdrücke entsprechend Breite, Sockel und Abstand zum Boden. Ein breiter Greifautomat braucht eine andere Kontaktform als ein schmaler Arcade-Korpus. Die Fuge hinter der Maschine gehört in den Raum-Bake, feine Ritzen im Gerät in die Material-AO.

**Bewegliche Figuren:** Kein fest eingebrannter Figurenschatten, der bei jeder Drehung widerspricht. Für kleine Idle-Bewegungen genügt eventuell ein weicher Kontaktfleck; für den Greifautomaten kann ein lokal begrenzter dynamischer Schatten sinnvoll sein.

Three.js besitzt `lightMap` und `lightMapIntensity` für vorberechnete Beleuchtung. Die Dokumentation verlangt dafür einen passenden UV-Satz und korrekt gekennzeichnete Farbdaten. Im Projekt muss die tatsächliche UV-Kanalzuordnung von r181 überprüft werden; alte Anleitungen mit pauschalem `uv2` dürfen nicht blind übernommen werden. [9]

### Schattenbudget

Ein begrenzter Spot-Schatten für die aktive Station ist ein vernünftiger Versuchsaufbau. Die statischen Maschinen und die Architektur sollten möglichst über Bakes zusammenfinden. Punktlichtschatten sind für diese Aufgabe ungünstig, weil dafür sechs Ansichten benötigt werden. [14]

GTAO kann zusätzlich kleine räumliche Kontakte verbessern, ist aber ein optionaler Qualitätsversuch. Die Three.js-Dokumentation beschreibt GTAO als qualitativ besser und teurer als SSAO. Es ersetzt weder farbiges indirektes Licht noch sauber vorbereitete Materialien. [15]

## 5. Der Boden als zusammenhängende Oberfläche

### Materialziel

Empfohlen ist dunkler, fein strukturierter Stein mit seidenmattem Finish. Unter Lichtquellen entstehen erkennbare, weiche Reflexe; größere dunkle Bereiche bleiben ruhig. Die Maschine soll am Boden verankert erscheinen. Eine bildscharfe Spiegelkopie des gesamten Automaten wäre für dieses Material zu glatt.

Rauheit bestimmt, wie breit reflektiertes Licht verteilt wird. Eine physikalisch plausible Oberfläche kombiniert ihre diffuse und spiegelnde Antwort, statt beliebig viel Helligkeit aufzuaddieren. Diese Zusammenhänge sind in Filaments PBR-Darstellung beschrieben. [7]

Als Versuchsbereich für den wahrgenommenen Roughness-Wert eignen sich ungefähr 0,35–0,50, mit etwas raueren Fugen und kleinen ruhigen Variationen. Das ist ein Designstartwert, kein Materialmesswert. Die jetzige Zahl 0,72 lässt sich damit nicht direkt vergleichen, weil sie nur die transparente Fliesenauflage steuert und nicht den Spiegel darunter.

### Technischer Aufbau

Der Boden sollte seine Grundfarbe, Normale, Rauheit und Reflexion aus einem zusammenhängenden Materialmodell beziehen. Die separat transparente Fliesenauflage entfällt in diesem Zielaufbau. Die vorhandenen Texturen können nach Prüfung ihrer Skalierung weiterverwendet werden.

Die planare Reflexion bleibt als Quelle für die sichtbaren Automaten erhalten. Ein Reflector rendert die Szene über eine gespiegelte Kamera in eine Textur; diese Aufnahme allein ist noch kein raues Steinmaterial. [12]

Die Reflexionskette muss linear und HDR bleiben: Capture → Filterung → Materialmischung → Bloom, soweit sinnvoll → einmalige finale Tonwert- und Farbraumumwandlung. Besonders die eigenen Shader sind zu prüfen, da das Projekt sowohl Composer- als auch direkte Renderer-Pfade verwendet. Three.js erwartet Lichtberechnungen im linearen Arbeitsfarbraum und bei Postprocessing einen passenden OutputPass. [10]

Die Filterung sollte wenigstens zwei oder drei vorgefilterte Unschärfestufen anbieten, aus denen die Materialrauheit auswählt. Optional kann die Tiefe der Spiegelaufnahme zusätzlich einfließen: Ein hoher Fernseher darf weicher reflektiert werden als ein bodennaher Lichtstreifen. Das ist eine praktikable Näherung an raue planare Reflexionen und muss an schrägen Kamerawinkeln überprüft werden.

Normaldetails dürfen die Reflexionskoordinaten nur schwach verändern. Große Wellen würden den Stein wie Wasser aussehen lassen. Fugen unterbrechen die Reflexion etwas stärker, aber ohne harte schwarze Linien durch jede Lichtfläche.

### Warum der Seitenbereich besondere Aufmerksamkeit braucht

Der momentane Shader verwendet die globale Bodennormale und einen festen Verlauf über Welt-Z. Er kennt die Fliesen-Normalmap nicht. Dazu kommen die geringe Aufnahmehöhe von 256 Pixeln und ein konstanter Filter in Texturkoordinaten. Die Fresnel-Verstärkung macht Fehler bei flachen Blickwinkeln auffälliger. Diese Kombination ist ein plausibler Beitrag zu den beanstandeten Seitenreflexen; der Anteil jedes einzelnen Effekts ist noch nicht isoliert gemessen.

Die neue Version benötigt Tests an beiden Bildschirmrändern, bei Kamerafahrt und in der Zoomansicht. Außerhalb gültiger Projektionskoordinaten muss sie weich ausblenden, statt Randpixel über große Flächen zu strecken. Ein zusätzlicher Rand in der Reflexionsaufnahme ist bei Normalverzerrung zu prüfen.

### Planar, SSR oder andere Verfahren?

| Verfahren | Vorteil für diese Halle | Grenze | Empfehlung |
|---|---|---|---|
| Planare Reflexion mit Rauheitsfilter | Passt zum ebenen Boden; kann Quellen außerhalb des Hauptbildes erfassen | Zusätzlicher Szenen-Render, Filterkosten | Hauptlösung auf geeigneten Geräten |
| Screen Space Reflections | Kann sichtbare Oberflächeninformationen nutzen | Fehlende Information außerhalb des Bildes und hinter sichtbarer Geometrie | Keine Grundlage für den Hallenboden |
| Vorberechnete Environment-Reflexion | Günstig und stabil für Lack, Chrom und Glas | Lokale Objektpositionen stimmen nicht exakt | Ergänzung für Maschinenmaterialien |
| Vorberechnete Lichtfelder ohne Spiegelaufnahme | Sehr günstig und stabil | Keine vollständige dynamische Objektreflexion | Gezielte Lite-Variante |
| Vollständige Echtzeit-GI / Path Tracing | Hohe theoretische Lichttreue | Unbewiesenes Leistungsbudget und großer Umbau | Für diesen Schritt nicht empfohlen |

Epics direkter Vergleich illustriert den entscheidenden Unterschied: SSR fehlen Informationen außerhalb des Bildes, während planare Reflexionen dafür eine zusätzliche Szene rendern. Die dortigen Unreal-Leistungszahlen sind nicht auf Three.js übertragbar. [13]

### Aktualisierung und Schärfe

Der aktuelle Spiegel aktualisiert bei bewegter Kamera ohne Zeitdrosselung; bei anderen Änderungen greift eine Pause von 50 beziehungsweise 120 ms. Gleichzeitig bewegt die Halle ihre Kamera im Idle leicht. Dadurch ist „nur gelegentlich aktualisiert“ kein verlässliches Leistungsversprechen.

Für die neue Fassung sollten geometrische Bewegung, Lichtwechsel und unveränderte Zustände getrennt behandelt werden. Während einer Kamerafahrt wird bevorzugt die Auflösung reduziert, statt ein räumlich falsch stehendes Spiegelbild festzuhalten. Eine bloße Überblendung alter Aufnahmen ist ebenfalls riskant: Ohne Reprojektion erzeugt sie Doppelkonturen.

## 6. Lichtwechsel beim Scrollen

Jede Station erhält ein kleines Lichtprofil: lokale Quellen, Haupt- und Akzentfarbe, Intensitäten, diffuse Wand-/Bodenantwort sowie ein neutrales Formlicht für Figuren. Diese Informationen beschreiben echte Positionen innerhalb der Station. Projektwechsel verändern deren Gewichtung; die Quelle wandert nicht einfach zur Bildschirmmitte.

Eine gemeinsame kontinuierliche Navigationsposition bestimmt den Übergang zwischen zwei Stationen. In der Hallenansicht folgt sie derselben zeitlichen Bewegung wie die Kamera. In der Detailansicht bleibt die gewählte Station maßgeblich. Die tatsächliche Kamera-X-Position ist dafür ungeeignet, weil die Kamera für das seitliche Informationspanel zusätzlich verschoben wird.

Als Ausgangspunkt gelten: aktive Station 100 %, unmittelbare Nachbarn ungefähr 30–45 %, fernere Stationen ungefähr 10–20 % der jeweiligen Profilintensität. Diese Werte müssen nach dem neuen Basislicht abgestimmt werden. Sie bedeuten nicht, dass alle Projekte dieselbe Helligkeit erhalten.

Farben werden im linearen RGB-Arbeitsraum zwischen benachbarten Profilen gewichtet. Ein zyklischer Farbtonwechsel über das gesamte Spektrum ist unnötig. Bei Gold → Violett darf kurz ein ruhigerer Mischton entstehen. Die Gesamtbelichtung bleibt stabil, damit der Raum beim Wechsel nicht „atmet“ oder pumpt.

Für schnelle Navigation empfiehlt sich eine kurze zusätzliche Glättung von etwa 150–250 ms, ohne erneute Wartephase. Ein neues Ziel übernimmt den aktuellen Zustand. Es startet keine vollständige Introanimation. Bei längerem Scrollen ergibt sich aus dem Bewegungsverlauf bereits der Übergang; ein weiterer langer Tween wäre redundant.

Eine Wiederverwendung von Lichtobjekten muss unsichtbar erfolgen: Quelle ausblenden, bei praktisch null Intensität einer anderen Station zuordnen, dann auf deren Gewicht bringen. Alternativ werden zwei benachbarte Quellen gleichzeitig übergeben. Ein helles Licht darf nie quer durch die Halle teleportieren.

TV, Leuchtenmaterial, Wandantwort und Bodenreflexion beziehen Farbe und Intensität aus demselben aktuellen Zustand. Ihre Transformationen werden aktualisiert, bevor die Spiegelaufnahme entsteht. Dies verhindert den früher beanstandeten Eindruck, das Licht komme vor dem Fernseher an.

Über mich und Kontakt erhalten ruhige eigene Profile. Der dort geparkte TV soll kein Signal für einen Projektwechsel auslösen. Ein Screenshotwechsel im Automaten kann die unmittelbare Screen-Aufhellung leicht beeinflussen; die komplette Raumfarbe sollte nicht bei jedem hellen UI-Screenshot umspringen.

## 7. Glas, Lichtsaum und Atmosphäre

### Glas und Lack

Ein Teil der Qualitätssteigerung entsteht bereits durch bessere Formen in der Umgebungskarte und tatsächliche rechteckige Lichtquellen. Erst danach sollte die vorhandene Glasshader-Verstärkung neu abgestimmt werden. Sonst wird die jetzige stark gerichtete Reflexion lediglich heller.

Die runden Bildschirmkanten können kleine Lichtreflexe tragen. Die Mitte bleibt klar, mit feinem Verschleiß hauptsächlich am Rand. Beim Greifautomaten sollten sichtbare Reflexe auf verschiedenen Scheiben plausibel zusammenpassen. Eine riesige weiße Fläche darf weder die Figur verdecken noch beim Blickwinkelwechsel plötzlich dominant werden.

Auch die Materialtrennung zählt: Lack erhält breite weiche Reflexe, Chrom schärfere schmale Reflexe, Gummi wenig Glanz und Ziegel hauptsächlich gerichtete diffuse Beleuchtung. Ein einziges globales Glanz- oder Helligkeitsplus würde diese Unterschiede verschlechtern.

### Bloom

Bloom bleibt schwach und auf sehr helle Bereiche begrenzt. Es ist der sichtbare Lichtsaum um eine Quelle, kein Ersatz für die Beleuchtung der Wand. Der UnrealBloomPass bietet dafür getrennte Parameter für Stärke, Radius und Helligkeitsschwelle. [16]

Als Abstimmungsstart eignen sich etwa 0,10–0,20 Stärke und eine Schwelle oberhalb normal heller Oberflächen; die genaue Schwelle hängt von der kalibrierten HDR-Pipeline ab. Metallkanten, Haut und weiße Sneakers sollen nicht dauerhaft ausblühen. Die zuletzt mühsam beruhigten Haarkanten sind ein Pflichtfall in der Abnahme.

### Luft und Lichtstrahlen

Leichte Tiefenstaffelung ist sinnvoll: weiter entfernte Automaten verlieren etwas Kontrast. Der vorhandene lineare Three.js-Fog blendet über Entfernung in eine Farbe und berechnet kein echtes von Lampen beleuchtetes Nebelvolumen. [18]

Für den ersten Ausbau genügt eine dunkle, dezente Distanzwirkung. Sichtbare Lichtkegel oder volumetrischer Dunst sollten erst als getrennte Option getestet werden, nachdem Material und Beleuchtung funktionieren. Wenn verwendet, dann lokal an nachvollziehbaren Quellen und sehr schwach. Ein bildweiter grauer Schleier würde die gewünschten satten dunklen Flächen aufhellen.

Automatische Belichtung, starke chromatische Aberration, Filmkorn und Lens Flares gehören nicht zum empfohlenen Grundaufbau. ACES bleibt zunächst bestehen; AgX kann später im kontrollierten Vergleich geprüft werden. Beide sind im installierten Three.js verfügbar. Die Wahl ersetzt weder korrektes Licht noch erhaltene HDR-Daten. [17]

## 8. Umsetzung im vorhandenen Projekt

| Baustein | Aufgabe | Betroffene Stellen |
|---|---|---|
| `hallLighting.ts` neu | Lichtprofile, feste Quellen, Gewichtung, kontrollierter Pool | Aus `buildRoom()`, `applyFocus()` und `tick()` herauslösen |
| `hallEnvironment` | Dunkle passende Umgebung erzeugen und laden | `scripts/build-hall-environment.mjs`, `loadEnvironment()` |
| `floorReflection` | HDR-Capture, Filterstufen, Budget und Invalidierung | Bisheriger Reflector-/Blur-Block in `hallScene.ts` |
| `floorMaterial` | Fliesenfarbe, Normalen, Rauheit und Reflexion zusammenführen | `floorReflectionShader.ts`, aktuelle Fliesenauflage |
| Blender-Lichtbakes | Raum-AO, stationäre indirekte Beleuchtung, lokale Antwortfelder | Bestehende Blender-Assetpipeline erweitern |
| Startbeleuchtung | Alle neuen Lichtbeiträge gemeinsam hochfahren | `roomPower.mjs`, Vorwärmung und Bereitschaftssignal |
| Diagnoseansichten | Quellen, diffuse Beiträge, Reflexion und finale Ausgabe getrennt ansehen | Nur Entwicklungsmodus |

Besonders wichtig für den Start: `withRoomPower()` regelt aktuell Lichter, Environment und Emission, aber keine zukünftigen Lightmap-Intensitäten. Neue Bakes oder eigene Lichtuniforms müssen ausdrücklich daran angeschlossen werden. Sonst wäre die Wand schon hell, während der Raum laut Animation noch dunkel sein soll.

Der feste Lichtpool wird vor dem Shader-Warm-up angelegt. Nur Farben, Transformationen und Intensitäten wechseln während der Navigation. Das verringert das Risiko neuer Shader-Varianten beim ersten Besuch einer Station. Three.js weist bei `compileAsync()` ausdrücklich darauf hin, die Zielbeleuchtung vorher zu konfigurieren. [17]

Ein mobiler Fallback muss dieselben lokalen Farbprofile und vorberechneten Schatten nutzen. Er darf die Live-Spiegelaufnahme weglassen, sollte aber ihre Lichtwirkung durch ruhige, geometrisch passende Materialbeiträge vertreten. Die aktuellen additiven Streifen werden dafür nicht einfach heller gemacht.

## 9. Prioritäten und Leistungsziele

### Reihenfolge

1. **Lichtgrundlage:** Generische Studio-Umgebung ersetzen, feste Quellen anlegen, TV-Wandaufhellung kontrollieren, neutrale Lesbarkeit der Figuren sichern. Zunächst ohne zusätzliche Effekte abstimmen.
2. **Bodenkette reparieren:** HDR erhalten, Fliesen und Spiegel zusammenführen, Rauheitsfilter und gültige Projektionsgrenzen prüfen. Vorher/Nachher bei identischer Kamera vergleichen.
3. **Verankerung und indirektes Licht:** Raum-Bake, unterschiedliche Sockelschatten und erste lokale Farbantworten. Die komplette Halle muss bereits in einer statischen Ansicht überzeugend wirken.
4. **Navigation:** Kontinuierliche Profilgewichtung, unterbrechbare Übergänge, geparkter TV und gemeinsame Startbeleuchtung.
5. **Feinabstimmung:** Glasreflexe, zurückhaltender Bloom, gegebenenfalls sehr leichter Dunst. Danach mobile Qualitätstiers und thermische Stabilität testen.

Ein erster Look-Prototyp sollte nur Über mich, Riftback, Nexus und Lowlight umfassen. Diese vier Stationen decken Figur, warmes Metall, gesättigtes Violett und zurückhaltende warme Farben ab. Erst wenn ihre Übergänge zusammen funktionieren, wird das System auf alle Stationen übertragen.

### Vergleich der Ausbaustufen

| Ansatz | Ergebnis | Aufwand / Risiko | Bewertung |
|---|---|---|---|
| Nur Intensitäten und Bloom ändern | Schnelle Stimmungsänderung | Geringer Aufwand; bestehende räumliche Widersprüche bleiben | Als Diagnose nützlich, als Endlösung zu wenig |
| Neue Lichtregie + Bakes + verbesserter Boden | Zusammenhängende Lichtwirkung, gute Materiallesbarkeit | Mittlerer Umbau, gut schrittweise prüfbar | Empfohlen |
| Neue GI-/SSR-/Volumetrik-Pipeline | Mehr mögliche Echtzeiteffekte | Hohes Risiko für Kosten, Artefakte und Ladeverhalten | Erst bei einem später klar belegten Bedarf |

### Budget als Abnahmeziel

Die folgenden Zahlen sind Projektziele, keine gemessenen Leistungsversprechen. Auf Desktop ist eine stabile Ausgabe um 60 fps anzustreben. Zusätzliches Licht und Reflexion sollten zunächst ein GPU-Budget von ungefähr 2–3 ms gegenüber einer sauber gemessenen Basis erhalten. Entscheidend sind nicht nur Mittelwerte, sondern die langen Frames beim Scrollen und beim Öffnen eines Panels.

Für hohe Qualität ist eine am sichtbaren Boden und Seitenverhältnis orientierte Reflexionsaufnahme zu testen, mit einer langen Kante bis ungefähr 1024 Pixeln. Die mittlere Stufe kann etwa 512 verwenden. Die geringe Stufe verwendet Bakes und lokale Lichter ohne dynamischen Spiegel. Starre Auflösungen sind erst nach Messung pro Gerät sinnvoll.

Die 512 × 256 RGBA16F-Farbtextur benötigt etwa 1 MiB; drei solche Farbziele etwa 3 MiB. Bei 1024 × 512 wären es etwa 12 MiB für drei Farbziele. Das sind reine Texeldaten ohne Tiefenbuffer, Mips, MSAA und Treiberoverhead. Ein höherer Wert ist daher eine bewusste Qualitätsentscheidung.

Der derzeitige Performance-Fallback setzt auf Stufe 0 den Pixelratio pauschal auf 1. Auf sehr großen Bildschirmen kann das mehr Pixel bedeuten als die vorherige Flächenbegrenzung. Das sollte bei der Budgetarbeit korrigiert werden: Jede niedrigere Stufe muss die tatsächliche Renderfläche monoton reduzieren oder erhalten.

## 10. Abnahmeplan

Die Prüfung erfolgt auf festen Ansichten und kurzen reproduzierbaren Navigationsfolgen. Ein einzelner schöner Screenshot reicht nicht aus.

| Prüffall | Erwartung |
|---|---|
| Erster Besuch, kalter Cache | Raum bleibt bis zur Bereitschaft verborgen; neue Bakes leuchten nicht vorzeitig. |
| Lichtstart | Quelle, Wandwirkung und Reflexion fahren gemeinsam hoch; Loader verschwindet beim Beginn der Zündung. |
| Langsam Riftback → Nexus → Lowlight | Lokale Farbräume gehen weich ineinander über; keine globale Regenbogenfahrt. |
| Schnelle Richtungswechsel | Keine Lichtteleports, wartenden Übergänge oder neu kompilierenden Materialien. |
| Über mich / Kontakt | Ruhige eigene Lichtstimmung; keine unnötige TV-Umschaltung. |
| Panel öffnen / schließen | Licht bleibt an der Station, auch wenn sich die Kamera für das Panel seitlich versetzt. |
| Boden links / rechts / frontal | Keine harten Randstreifen, wandernden Gradienten oder gestreckten Reflexionspixel. |
| Naher Lichtstreifen / hoher TV | Unterschiedlich plausible Reflexionsschärfe; keine komplette Spiegelwand auf dem Boden. |
| Greifautomat | Gesicht und Tattoos bleiben lesbar; Haar- und Sneakerkanten flimmern nicht weiß. |
| Bloom aus | Die Lichtstimmung und die räumliche Verständlichkeit bleiben erhalten. |
| Reduzierte Bewegung | Ruhige Übergänge ohne dekoratives Flackern nach dem Start. |
| 320/390 px, Tablet, Laptop, 2560 px, 3789 px | Gleichbleibende Hierarchie; kein Verlust der Atmosphäre durch unterschiedliche Bildschirmflächen. |
| Safari/iPhone und Android real | Formatunterstützung, Speicher, Glas und Transparenz prüfen; Desktop-Emulation ersetzt dies nicht. |
| Längerer Aufenthalt | Kein thermisch bedingtes wiederholtes Umschalten zwischen stark unterschiedlichen Looks. |

Zur technischen Abnahme gehören Messungen von Haupt- und Reflexionspass, sichtbaren Draw Calls, Materialprogrammen und Framezeiten. GPU-Timer sind nur mit gültiger Unterstützung und ohne Disjoint-Ergebnis auszuwerten. `renderer.info` muss für mehrere Renderpasses passend zurückgesetzt werden; der Standardreset pro Render würde die Gesamtkosten verschleiern. [17]

Vor der Veröffentlichung wird ein Vergleichsset mit unveränderter Kamera, identischem Bildschirmmotiv und abgeschlossener Startanimation erstellt. So werden Effekte nicht versehentlich durch andere Inhalte oder eine andere Belichtung besser bewertet.

## 11. Einordnung und offene Punkte

Die Untersuchung liefert eine belastbare Richtung und mehrere konkrete technische Befunde. Sie ist noch keine implementierte Lichtüberarbeitung. Die relative Wirkung wurde in einer lokalen Chromium-Ansicht des Startbereichs geprüft; andere Stationen und echte Mobilgeräte benötigen eigene Messungen.

Nicht bewiesen ist, welcher einzelne Shaderanteil den subjektiv störenden Seitenreflex am stärksten verursacht. Die getrennten Bodenflächen, feste Unschärfe, Fresnel-Näherung und geringe Auflösung sind konkrete Kandidaten. Die HDR-/LDR-Grenze ist festgestellt; ihr genauer Einfluss auf das Endbild muss in einem Vergleich mit durchgängigen HalfFloat-Targets gemessen werden.

Alle vorgeschlagenen Intensitäten, Filtergrößen, Budgets und Übergangszeiten sind Ausgangspunkte für die Gestaltung. Die zentrale Empfehlung bleibt unabhängig davon: **lokales, motiviertes Licht, glaubwürdiger Bodenkontakt und ein gemeinsames Materialmodell bringen mehr Qualität als zusätzliche bildweite Effekte.**

## Quellen und Nachweise

Webquellen wurden am 11. September 2026 geprüft. Die veränderlichen Three.js-Dokumentationsseiten wurden mit der lokal installierten Version r181 abgeglichen, soweit konkrete APIs betroffen sind. Film- und Enginebeispiele dienen der fachlichen Einordnung; deren Renderzeiten oder vollständige Pipelines werden nicht auf diese Website übertragen.

1. Pixar RenderMan. [Cinematography with Soul](https://renderman.pixar.com/stories/cinematography-with-soul). Produktionsbericht; Lichtgestaltung, Materialwirkung und natürliche farbige Innenraumbeleuchtung.
2. Pixar RenderMan. [Stylization at Pixar](https://renderman.pixar.com/stories/stylization-at-pixar). Produktionsbericht; gezielte künstlerische Steuerung von Material- und Schattenwirkung.
3. Eric Heitz, Jonathan Dupuy, Stephen Hill und David Neubelt. [Real-Time Polygonal-Light Shading with Linearly Transformed Cosines](https://eheitzresearch.wordpress.com/415-2/). ACM SIGGRAPH, 2016. Primärforschung zu polygonalen Flächenlichtern.
4. Three.js. [RectAreaLight](https://threejs.org/docs/pages/RectAreaLight.html). Flächenlicht, PBR-Unterstützung und fehlende Schattenunterstützung.
5. Three.js. [RoomEnvironment](https://threejs.org/docs/pages/RoomEnvironment.html). Herkunft und Verwendung des generischen Beleuchtungsraums.
6. Three.js. [PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html). Vorfilterung von Umgebungslicht für unterschiedliche Rauheiten.
7. Romain Guy und Mathias Agopian / Google. [Physically Based Rendering in Filament](https://google.github.io/filament/main/filament.html). Insbesondere Materialmodell, Rauheit, Energieerhaltung und bildbasierte Beleuchtung.
8. Blender Foundation. [Render Baking, Blender 4.5 LTS Manual](https://docs.blender.org/manual/pt/4.5/render/cycles/baking.html). UV-Anforderungen, AO und Lightmaps; die indexierte portugiesische Fassung enthält die verwendeten englischen Erläuterungen. Der englische 4.5-Direktabruf war nicht verfügbar.
9. Three.js. [MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html). Lightmaps, UVs, Materialparameter und Texturfarbräume.
10. Three.js. [Color Management](https://threejs.org/manual/en/color-management.html). Linearer Arbeitsfarbraum, Eingangs- und Ausgabefarben, OutputPass; indexierte Fassung verwendet, da der direkte Abruf zeitweise fehlschlug.
11. Three.js. [RenderTarget](https://threejs.org/docs/pages/RenderTarget.html). Standardtyp UnsignedByte und Renderzieloptionen.
12. Three.js. [Reflector](https://threejs.org/docs/pages/Reflector.html). Planare Spiegelaufnahme; konkrete HalfFloat-Implementierung zusätzlich lokal in r181 geprüft.
13. Epic Games. [Planar Reflections](https://dev.epicgames.com/documentation/en-us/unreal-engine/planar-reflections-in-unreal-engine). Vergleich zu SSR, außerhalb des Bildes liegende Quellen und zusätzliche Renderkosten.
14. Three.js. [Shadows](https://threejs.org/manual/en/shadows.html). Schattenarten, einfache Kontakttexturen und sechs Ansichten für Punktlichtschatten; indexierte Fassung verwendet.
15. Three.js. [GTAOPass](https://threejs.org/docs/pages/GTAOPass.html). Qualitäts-/Kostenvergleich mit SSAO.
16. Three.js. [UnrealBloomPass](https://threejs.org/docs/pages/UnrealBloomPass.html). Filterprinzip, Stärke, Radius und Helligkeitsschwelle.
17. Three.js. [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html). Tonwertabbildung, Shader-Vorwärmung und Statistik bei mehreren Renderpasses.
18. Three.js. [Fog](https://threejs.org/docs/pages/Fog.html). Entfernungsabhängige lineare Nebelwirkung.

### Lokale Evidenz

- `src/components/hall/hallScene.ts`: Renderer um Zeile 629; Environment um 645; Raumlicht und Boden 737–895; Fokuslicht 2670–2691; Navigation/TV ab 2800; Leistungsstufen ab 3059.
- `src/components/hall/floorReflectionShader.ts`: Fresnel-Näherung, Welt-Z-Fade und fehlende Kopplung an Fliesen-Normalen/Rauheit.
- `scripts/build-hall-environment.mjs`: PMREM-Erzeugung aus Standard-RoomEnvironment.
- `src/components/hall/roomPower.mjs`: gemeinsame Startbeleuchtung; zukünftige Lightmaps noch nicht enthalten.
- `node_modules/three/examples/jsm/objects/Reflector.js`: HalfFloat-Aufnahme in r181.
- `node_modules/three/src/core/RenderTarget.js`: Standardtyp UnsignedByte.
- Diagnosedaten: `docs/research/hall-lighting-evidence.json`. Kamera und Lichtbeiträge wurden ausschließlich in einer separaten lokalen Browseransicht verändert; der produktive Szenencode blieb unverändert.
