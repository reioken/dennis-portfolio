# dennisbf.design — UX & UI rules for the interactive arcade

Agent implementation and review brief · 5 October 2026

## 1. Purpose and how to use this document

Build a portfolio that feels like entering Dennis's carefully constructed arcade, exploring real machines, and discovering the work behind them. Make that experience understandable, readable, responsive, and easy to leave or navigate at every step.

The arcade is the identity of the portfolio. Preserve the physical machines, tactile controls, atmospheric room, signature wordmark, and live mobile models. Improve the interaction around that identity rather than converting the homepage into a conventional portfolio template.

This is a site-specific specification and review checklist, **not a claim that every item below is currently broken**. It combines the current handover, relevant source files, and a limited live browser inspection: desktop hall and Ishikiri case panel; 390 × 844 mobile exhibition, cabinet viewer, and enlarged screenshot. It is not a complete accessibility audit, a physical-phone test, or a fresh performance benchmark.

Interpret the language as follows:

- **Must:** a required outcome for this site's implementation, unless Dennis explicitly changes the design decision.
- **Target:** a recommended starting value; adjust with evidence and visual judgment.
- **WCAG:** an accessibility requirement, with the relevant source linked. Site targets can be stricter than WCAG.
- **Verify:** inspect and test; do not assume a defect exists just because it appears in this document.

Do not implement this entire document as one uncontrolled redesign. Inventory the current behavior, identify actual gaps, prioritize them, and preserve working interactions. Treat proposed wording as examples for Dennis's review; retain his existing approved copy and factual claims.

## 2. The specific experience to preserve

The current portfolio has several distinct presentations of one body of work:

| Surface | Purpose | Preserve |
| --- | --- | --- |
| Desktop hall | Spatial discovery | Real cabinets, claw/About, contact phone, overhead display, physical navigation console |
| Mobile homepage | Native vertical exhibition | Scrolling, real live models, compact station selector, tap-to-enter continuity |
| Cabinet viewer | Inspect project media through the machine | Camera entry, physical gallery controls, clear screenshot navigation |
| Project page/panel | Understand Dennis's contribution | Readable summary, role, status, original media, case content, appropriate external links |
| Enlarged screenshot | Examine details | Correct aspect ratio, zoom, previous/next, clear close and return |
| Work directory/index | Find something directly | All projects, including work without a physical station |
| About | Understand Dennis and his process | Claw identity, existing biography, process, experience disclosure, education |
| Contact | Start a conversation | Phone identity and a direct, usable contact route |

Current station order is About → Ishikiri → Riftback → NEXUS → Lowlight → VGM Battle → Deductidle → Echo Frequency → Essfreude → Cab No. 9 → Hookline → Berry → Snapsize → Contact: 14 stations, including About and Contact. Generate counts and ordering from shared data; do not hardcode this snapshot into new components.

Ishikiri is currently in development. Its beige/jade cabinet and white logo screen are intentional. Deductidle has its own status and authorship wording. Sauté Survivors remains available as content without a hall station. These differences must survive any interface cleanup.

The CD player is local work in progress at the time of this brief. Music rules below are conditional requirements for that feature, not a statement that it is already live.

## 3. Core UX principles, applied to the arcade

1. **Orient before asking for exploration.** Visitors must be able to identify Dennis, his disciplines, the selected station, and an obvious next action without learning a game control scheme.
2. **Make essential actions visible.** Opening a project, finding all work, returning, and contacting Dennis cannot depend on discovering an Easter egg, hovering over a tiny mesh, or completing a game.
3. **Keep exploration optional.** The hall invites browsing; the header, directory, project URLs, and contact route support visitors who arrive with a specific goal.
4. **One action, one understandable outcome.** Selecting a station, entering a cabinet, opening a case study, enlarging a screenshot, and launching a product are different actions. Label and signal them accordingly.
5. **Feedback belongs to the action.** A pressed console key, changed station readout, loading caption, or selected thumbnail should explain what just happened.
6. **Keep the visitor's place.** Returning from an image or case study should recover the same station, gallery selection, and relevant scroll position.
7. **Match control prominence to importance.** Project content, navigation, and contact deserve stronger treatment than counters, technical metadata, ambient props, or decorative readouts.
8. **Let physical realism support usability.** Hardware can look authentic while its browser hit area, accessible name, and keyboard behavior remain forgiving.

Useful design heuristics here: larger and nearer targets are easier to acquire; related information should be grouped; visible choices reduce memory demands; a clear default action reduces decision effort. These are guides to judgment, not formulas that justify hiding necessary information.

## 4. Visual language and art direction

- Keep the dark graphite foundation and restrained violet, ice-blue, silver, and grey accents. Project machines can retain their individual brand colors.
- Preserve the signature plus full name and the UX/UI background. Keep the signature's holo hover and no underline. Provide a separate visible keyboard focus treatment on its link.
- Use coherent material roles: dark readable surfaces for information, metal/plastic for equipment, glass for deliberate layering, emissive light for selected accents.
- Do not make every component glass. Dense reading content needs a calm, predictable backing.
- Use glow to reinforce hierarchy. The selected object or active control should draw attention before distant scenery.
- Screenshots must remain legible inside the machines. Bloom, scanlines, glare, reflection, and color grading must not erase the work being shown.
- Distinguish project machines through form, branding, and credible construction. Do not add arbitrary fantasy props, decorative screws, identical wear patterns, or generic shiny buttons.
- Avoid floating labels attached to every piece of hardware, bright square hover patches, wobbling arrows, and artificial screen wipes. These have already been rejected.
- A clear focus ring is functional feedback, not an unwanted decorative hover square. Do not remove accessibility feedback in the name of realism.
- Compare changes at hall distance, in the close-up, and on mobile. A beautiful asset at full resolution may be unreadable or visually noisy at its actual display size.

**Acceptance:** in a still frame, the selected station, its primary action, and the route back are distinguishable without relying on animation.

## 5. The 8-point spacing system — what it means here

The “8-pixel rule” is usually called an **8-point spacing system**. Use a consistent spacing scale for interface layout, with 4 px subdivisions for compact details. In CSS, these refer to CSS pixels at the default scale, not physical display pixels. It is a design convention, not an accessibility requirement.

| Spacing | Intended use in this portfolio |
| --- | --- |
| 4 px | Icon adjustment, very tight related details |
| 8 px | Icon-to-label gap, compact adjacent controls |
| 12 px | Dense toolbar padding, related metadata groups |
| 16 px | Comfortable control padding, small content groups |
| 20 px | Existing narrow-screen exhibition gutter; valid 4 px subdivision |
| 24 px | Panel padding, space between related sections |
| 28 px | Existing exhibition section rhythm; valid 4 px subdivision |
| 32 px | Wider mobile/tablet gutters, stronger group separation |
| 40–48 px | Major content separation, generous desktop panel rhythm |
| 64–96 px | Large editorial section breaks where available space warrants them |

Rules:

- Prefer shared spacing tokens over unrelated one-off margins. Name tokens by role where useful: page gutter, panel padding, toolbar gap, section gap.
- Preserve the current mobile 20–32 px responsive gutter unless a measured problem warrants changing it. Do not replace it with 16 px merely to achieve a multiple of eight.
- Align headings, summary text, section rules, and primary links to the same text-column edges.
- Keep a caption closer to its image than to the next section. Keep a role closer to its project title than to unrelated controls.
- Use padding to create stable control areas. Avoid excessive negative margins that make text collide with a model or create invisible click zones over adjacent content.
- Do not force every font size, border, radius, or 3D coordinate onto an eight-unit grid. A 1 px border, 2 px outline, 44 px touch target, or optical icon correction is valid.
- Apply this system to the 2D interface. Physical cabinet dimensions and camera composition follow their own world-space constraints.
- Use `rem` for text and text-related spacing where practical; keep the root font size compatible with user preferences. Responsive interpolation between spacing endpoints is fine.

**Acceptance:** comparable panels and toolbars share predictable padding and alignment; necessary optical exceptions are intentional rather than accumulated accidents.

## 6. Layout, composition, and responsive modes

The current mode boundary is below 900 CSS px for the mobile exhibition and 900 px upward for the desktop hall. Treat this as the existing implementation contract, not a universal definition of a phone.

| Situation | Required layout behavior |
| --- | --- |
| 320–430 px portrait | Vertical exhibition; readable text; reachable controls; no page-level horizontal overflow |
| 600–899 px | Exhibition with restrained content width; avoid stretching prose and cabinets simply to fill space |
| 900–1100 px | Inspect hall, header, console, and case-panel collisions carefully; width alone does not guarantee space |
| Wide desktop | Hall expands compositionally; prose and console retain useful maximum widths |
| Short landscape | Recompose viewer controls around available height; keep both image and exit visible |
| Touch laptop/tablet | Every important action works without hover, even when the hall layout is active |
| Browser zoom | Text and controls reflow; switching to the exhibition is acceptable if context is preserved |

- Use viewport width/height for layout, pointer/hover capabilities for interaction, and measured rendering performance for quality. Do not equate small screen with weak GPU or mouse with powerful computer.
- Keep the current console size restraint; the October performance release reduced it to a maximum of about 960 px. Do not enlarge it again merely to fill desktop space.
- Reserve real space for header, console, viewer controls, and device safe areas. Compute camera framing from the available rectangle, not from the entire viewport behind overlays.
- Prioritize the project screen in a cabinet close-up. The cabinet can crop intentionally; the screenshot and essential controls must remain usable.
- Avoid nested scrolling on mobile reading pages. Let the document scroll naturally. A desktop side panel may scroll independently if its scroll region and keyboard behavior are clear.
- Account for dynamic browser toolbars, notches, the home indicator, and the software keyboard. `100dvh` alone does not solve every mobile viewport problem.
- Anchor targets need enough `scroll-margin` to clear the actual fixed header and any sticky selector.
- Do not “fix” overflow solely by clipping it. Find the oversized element, inflexible grid track, long label, or projected control causing it.
- Keep orientation optional. The surrounding portfolio must remain usable in portrait and landscape, even if an embedded game prefers one orientation.

**Reflow baseline:** ordinary reading content and controls should work at 320 CSS px width, including the equivalent 1280 px desktop viewport at 400% zoom. A genuinely two-dimensional game or image can have different layout needs; that exception does not extend to the entire portfolio. [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

## 7. Typography and readability

Use the existing type roles coherently: Outfit for general interface/body content, the established condensed display treatment where already used, and monospace for short equipment-style metadata. Do not introduce more typefaces to solve a hierarchy problem.

Recommended starting points, not mandatory conversions of all current text:

| Role | Target at default zoom | Application |
| --- | --- | --- |
| Long-form body | 16–18 px; line-height 1.5–1.7 | About, project explanation, contact help |
| Short exhibition summary | Prefer 16 px when space permits; inspect current 14 px | Mobile description below a machine |
| Main action label | 14–16 px, medium weight | Open, return, project details, submit |
| Secondary metadata | 12–14 px | Role, status, count; maintain strong contrast |
| Decorative equipment readout | Can be smaller if nonessential | Never the only source of a project name or control meaning |
| Mobile project title | Current 32–44 px range is a reasonable starting point | Allow wrapping; avoid shrinking long titles to fit |
| Section heading | Approximately 22–32 px | Case study structure |

- Do not set all typography to multiples of eight. Type needs its own scale.
- Keep long reading lines around 55–75 characters where possible. Mobile lines will naturally be shorter. Avoid extremely narrow columns created by oversized side padding.
- Use mostly left-aligned prose. Centering is appropriate for a short viewer title, not several paragraphs of case content.
- Reserve uppercase and wide tracking for short labels. Do not use small, widely spaced uppercase text for essential instructions.
- Avoid thin text over glass or textured walls. Improve weight, backing, or size before adding stronger glow.
- Avoid unbroken all-caps strings for long project names. Provide the full name in readable HTML even if a hardware readout must shorten it.
- Do not automatically reduce text to tiny sizes to preserve a one-line layout. Wrap, reflow, or move secondary information.
- Keep ordinary links in prose identifiable without hover; an underline is a strong default. The signature logo is a deliberate exception, with its own recognizable link treatment.
- Preserve browser text selection and zoom in articles. Do not apply global `user-select: none` or disable pinch zoom.
- Use visible field labels. Placeholder text is supplementary help, not a replacement for a label.

**Verification:** test 200% text enlargement. Also test user overrides of line-height 1.5, paragraph spacing 2em, letter spacing 0.12em, and word spacing 0.16em without clipping or lost controls. These are override-resilience tests, not instructions to use those exact spacings by default. [WCAG text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)

## 8. Contrast and color — using the actual site palette

The live computed root tokens inspected on 5 October differ from some base declarations in `tokens.css`: `arcade-interface.css` overrides them. Audit the effective cascade and the component's actual rendered background.

These calculated ratios use opaque flat colors only. They are useful token checks, **not measured conformance of every live component**. Values are rounded for display; threshold decisions must use unrounded values.

| Effective token | Color | On `--bg` #08090c | On `--elev` #171a21 |
| --- | --- | --- | --- |
| Primary text | #f0f1f5 | 17.64:1 | 15.43:1 |
| Secondary text | #b2b6c2 | 9.83:1 | 8.59:1 |
| Quiet text | #989eae | 7.43:1 | 6.50:1 |
| Metadata | #b79cff | 8.73:1 | 7.64:1 |
| Violet | #ac8bfd | 7.46:1 | 6.52:1 |
| Blue | #4a82fe | 5.61:1 | 4.90:1 |
| Ice | #c8daf4 | 14.02:1 | 12.26:1 |

Concrete trap: primary light text `#f0f1f5` on solid blue `#4a82fe` is only about **3.15:1**, insufficient for ordinary small text. Dark `#08090c` text on that blue is about **5.61:1**. Do not infer that a readable blue text link also makes a readable blue-filled button with white text.

Accessibility thresholds:

- Ordinary text: at least **4.5:1**.
- Large text: at least **3:1**; approximately 24 CSS px regular or 18.67 CSS px bold qualifies. “Heading” alone does not imply large text.
- Aim for about **7:1** on body copy when practical as a site readability target; this is stricter than the AA minimum.
- Necessary control/state indicators and meaningful graphical elements: generally **3:1** against adjacent colors. Decorative borders do not all need this ratio; a boundary relied upon to identify a control may.

Sources: [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Arcade-specific rules:

- Test translucent panels over the brightest screenshot, darkest wall, active cabinet glow, and moving reflections. An acceptable dark token pair can fail after opacity and compositing.
- Prefer a sufficiently opaque reading surface to trying to make arbitrary moving backgrounds safe with blur alone.
- Evaluate projected hardware labels at the actual camera angle and size. A large texture rendered onto a small oblique button is still a small label to the visitor.
- Keep gradient/iridescent effects mainly on decoration or large branding. Small instructions need a stable foreground color.
- State must not rely on color alone: use a selected key position, underline, icon, text label, border shape, or explicit status alongside color.
- Project status labels must distinguish in development, paused, and finished for now through words. A green dot does not establish availability.
- Test hover, focus, selected, pressed, error, and loading states individually. Whole-component opacity can make enabled labels too faint.
- Inactive controls have WCAG contrast exceptions, but a disabled previous arrow should still be understandable as an endpoint rather than appear broken.
- Check forced-colors/high-contrast modes with functional DOM controls. The WebGL scene cannot be the sole provider of essential contrast or navigation.

## 9. Targets, hit areas, icons, and physical controls

**Site target:** standalone interactive controls should have at least a **44 × 44 CSS px** hit area; prefer **48 × 48** for frequently used mobile actions. Use around 8 px separation between neighboring controls where feasible. This is a usability target, not a claim that WCAG AA universally requires 44 px.

WCAG 2.2 AA's target-size minimum is **24 × 24 CSS px**, with specific spacing and other exceptions. Do not design to the smallest exception when a larger target is practical. [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

- A 20 px arrow can sit inside a 44–48 px button. Judge the clickable area, not the icon artwork alone.
- Measure projected console keys and cabinet controls in CSS pixels at every supported camera/layout state. World-space dimensions do not establish usable target size.
- Invisible hit areas may extend beyond a physical button, but must not overlap neighboring targets or capture unrelated clicks.
- Do not let the cabinet's overall “enter” target intercept the viewer's previous/next controls.
- Keep edges and close controls slightly inset from device edges and safe areas so browser/system gestures remain usable.
- Test the 14-key console at constrained desktop widths. If its keys become too small, preserve generous previous/next/open/directory controls and provide an equivalent usable station selection path.
- Use consistent icon meanings: arrows move, magnification/full-screen enlarges, close exits a layer. Do not make the same icon perform unrelated actions in the same context.
- Icon-only controls need accessible names describing the outcome: “Next screenshot,” “Close image,” or “All projects.” A tooltip alone is insufficient for touch.
- Pointer cursors and hover feedback belong on things that actually respond. Avoid suggesting every screw, speaker, or light can be clicked.
- Essential actions must have a click/tap alternative to dragging. A joystick or trackball can remain tactile without being the only way to navigate. [WCAG dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)

## 10. Navigation and discoverability

- Keep top-level Projects, About, and Contact reachable without traversing all stations.
- Preserve a direct “All projects” route. Station count and portfolio project count are different; the directory must not silently omit content-only work.
- Use the same project names and ordering across hall selection, mobile selector, case adjacency, and directory unless a clearly labeled filter changes the set.
- Distinguish **selecting** a station from **opening** it. The physical readout and selected key should immediately reflect the chosen station; opening should use an explicit action.
- The mobile cue should make the model's interaction visible before the first tap. A visitor should not have to guess whether the machine is merely an image.
- Keep “About the project” distinct from “take a closer look.” One opens readable project context; the other enters the cabinet/gallery experience.
- Do not label an unavailable project “Play” or “Download.” Ishikiri's current discussion CTA is more truthful than an invented launch action.
- Externally opening a product should be distinguishable from entering its portfolio case. Preserve useful browser behavior: open in new tab, copy link, and reload.
- A brief control hint can accompany first use. Do not add a mandatory tutorial or obstructive introduction to explain ordinary browsing.
- Every direct case URL must work on a fresh visit. The visitor might arrive from a recruiter, search result, or shared link and never see the hall first.
- A route change should update page title and focus meaningfully. A screenshot change should not pretend to be a new page.

**Acceptance scenario:** a visitor who does not explore any Easter eggs can find a specific project, understand Dennis's role, and reach Contact.

## 11. Keyboard, screen readers, and semantic structure

- Keep essential text and navigation in semantic HTML. A beautiful canvas does not replace a document heading, link, button, image description, or status.
- Use links for destinations and buttons for local actions. Preserve native link behavior where navigation is involved.
- Maintain a useful heading hierarchy and identifiable navigation/main regions. The skip link must reach useful content without requiring the hall interaction first.
- Expose selected station and gallery state programmatically. Use the appropriate selected/current/pressed state for the actual widget pattern.
- Accessible names should include visible labels, in the active language. Avoid repeatedly announcing combined German/English labels when a localized label is available.
- Do not place every decorative mesh in the accessibility tree. Expose meaningful actions and equivalent project information.
- Avoid duplicate tab stops when DOM proxies and another control offer the exact same action. Any focusable proxy must have visible focus feedback on the corresponding control.
- Tab and Shift+Tab traverse controls in a logical order. Buttons activate with Enter/Space; links retain native Enter behavior.
- Arrow-key shortcuts operate in the relevant gallery, selector, or focused hall context. Do not steal arrows, Space, or typing keys while a person is reading, entering a message, or using a native select.
- If number keys select screenshots, keep those single-character shortcuts scoped to focus or provide a way to disable/remap them. Do not make them globally interfere with text input or assistive technology.
- Focus styling must remain visible against bright cabinet surfaces and dark panels. Target a solid 2–3 px outline with a useful offset and contrasting backing when needed.
- Scrolling, sticky headers, dock elements, and modal controls must not conceal the focused element. Prefer keeping it fully visible; WCAG AA at minimum prohibits author-created content from entirely hiding it. [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- Announce settled, user-relevant changes politely, such as a new selected station or image count. Do not announce every camera frame, download percentage, or ambient animation update.
- Verify with keyboard-only operation and real screen-reader output. An automated accessibility scan cannot establish that the arcade is understandable.

## 12. Model interactions and mobile gestures

### Exhibition browsing

- One-finger vertical movement scrolls the page naturally, including when the gesture starts over a machine.
- A deliberate tap enters the machine. A scroll ending over it must not turn into an accidental entry.
- Keep live animation modest enough that the project title and description retain attention.
- Pause should persist while the user browses other exhibits during the session. Scrolling away and back must not silently undo it.

### Cabinet/gallery viewer

- Horizontal swipe changes screenshots only when the gesture is clearly horizontal and belongs to the gallery.
- Provide visible previous/next buttons so swiping is optional.
- A multi-touch pinch must not also change the screenshot. Do not interpret the remaining finger after a pinch as a fresh swipe.
- Suppress the synthetic click after a recognized drag/swipe. Handle pointer cancellation, finger leaving the target, and interrupted gestures.
- Do not begin gallery gestures on buttons, selects, links, or editable fields.
- Match all control methods: cabinet buttons, keyboard, swipe, thumbnails, and footer arrows update the same selected image and counter.
- Where actual image zoom/pan is supported, distinguish panning a zoomed image from changing slides. Do not disable browser zoom across the portfolio to simplify the gesture code.

### Pointer/hover behavior

- Hover previews must not navigate or steal focus.
- Screen-edge arrows can appear on hover/focus for desktop, but touch users need a persistent discoverable alternative.
- Keep arrows stationary while hovering. Do not animate the target away from the pointer.
- Do not claim a trackball is draggable if it only behaves as an ordinary button; align visual and interaction behavior.

**Gesture thresholds:** tune with actual touch testing. There is no universal correct swipe distance; account for direction, movement, cancellation, and scroll intent rather than accepting every small horizontal displacement.

## 13. Model the states explicitly

Use one coherent state model so controls, camera, URL, focus, and loading cannot drift apart. The following describes required behavior, not a prescribed framework implementation.

| State | What the visitor sees | Required exit/continuity |
| --- | --- | --- |
| Initial shell | Identity, meaningful loading context, direct project/contact access | Never an unexplained empty screen |
| Preparing hall | Honest progress language; room not yet ready | Direct content remains available |
| Hall ready | Selected station, physical console, open action | Selection and entry respond predictably |
| Station changing | Readout/selection feedback and camera movement | Latest intentional selection wins; no long input queue |
| Late station loading | Stable representation and readable project identity | Open content or retry; no whole-hall failure |
| Mobile exhibition | Native scroll, current model, station selector | Tap or direct case link; scroll remains usable |
| Model preparing | Existing poster/frame retained, localized status if needed | Cancel/leave without a delayed surprise opening |
| Entering cabinet | Continuous camera move from the selected machine | Back can reverse/cancel safely |
| Cabinet ready | Sharp media, current count, usable controls | Full-screen, case details, or return |
| Image loading | Previous image retained, appropriate feedback | Latest requested image wins; no stale replacement |
| Enlarged image | Contained image plus clear close and navigation | Return to same cabinet and selected image |
| Case content | Readable text, role, status, relevant links | Return to the source context or navigate normally |
| Directory/menu open | Clear title, current selection, usable choices | Close returns focus to opener |
| Returning | Controlled reverse transition or immediate reduced-motion return | Same exhibit position and gallery state |
| Paused/reduced motion | Stable scene; all actions available | No automatic restart after a navigation step |
| Model/WebGL failure | Honest explanation, poster/media and project access | Retry without losing context |
| Contact submitting | Explicit sending state; inputs preserved | Confirm actual success or provide recoverable error |
| Hidden/background | No unnecessary rendering work | Resume stable state without replaying entry |

Store the right information separately: selected station, selected media/surface per project, exhibition-relative scroll position, originating route, open layer, locale, and user motion/audio preferences. An array index alone is fragile when station order changes.

## 14. Back behavior, dialogs, and history

- Decide and document which states create browser-history entries. Do not add a history entry for every camera frame or incidental screenshot preload.
- Browser Back, the visible return control, and Escape must behave consistently with the layer the visitor entered. A transient viewer may use history so mobile Back dismisses it, but it must not trap the user in the site.
- Closing an enlarged image returns to the cabinet viewer with the same image. Closing the cabinet returns to the same exhibit. Leaving a case returns to the appropriate hall/exhibition context when one exists.
- For a direct-entry project URL, “Back to hall” needs a deliberate destination even if there is no prior in-site history. Do not blindly call `history.back()` and send the visitor to an unrelated website.
- Escape dismisses the topmost relevant dismissible layer, not several layers at once. Respect the browser's own full-screen exit behavior.
- A modal must have an accessible name, sensible initial focus, contained keyboard focus, an available close control, and an inert background. Return focus to its opener or a sensible replacement if the opener no longer exists. [WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Do not label an ordinary route-based case page as a modal merely because it visually overlays the room. Choose semantics based on actual interaction.
- Avoid piling independent focus traps on top of one another. A nested enlarged image needs a deliberate return path to the underlying viewer.
- Preserve scroll without hardcoding a raw pixel position that breaks when translation or layout changes section heights. The existing exhibit-relative restoration is a useful pattern.
- On resize or orientation change, preserve project and image selection. Recompute framing and hit areas; do not restart at About.
- Test close during loading, close during entry, reopen immediately, rapid next/previous, and language switch while viewing a project.

## 15. Motion, camera transitions, and reduced motion

Motion should explain spatial relationships or confirm actions. It should not be a delay the visitor must endure before every interaction.

| Motion | Suggested starting point | Rule |
| --- | --- | --- |
| Button/hover feedback | 80–150 ms | Immediate, subtle; no layout shift |
| Small UI appearance | 150–250 ms | Keep focus and hit testing coherent |
| Screenshot replacement | 100–180 ms | Decode first; do not flash black |
| Camera entry/return | Current mobile design is approximately 720 ms | Preserve continuity; assess perceived delay before changing |
| Reduced-motion transition | Immediate or very short opacity change | Remove travel, parallax, shake, and nonessential looping |

- Reuse the visible model/canvas for entry where supported. Do not flash a differently framed poster before the camera moves.
- Return to the original exhibit projection rather than a generic overview followed by a snap.
- Interrupt from the current visual state. Do not force a full entry animation to finish before honoring Back.
- Do not queue several long camera moves when the user rapidly selects stations. Coalesce toward the latest deliberate destination.
- Respect `prefers-reduced-motion` in JavaScript/WebGL as well as CSS. A CSS rule shortening transitions does not stop a render-loop camera tween.
- Ensure transition completion logic still works when animation is skipped. Do not wait indefinitely for an animation event that will never fire.
- Provide usable pause/stop behavior for ambient movement. WCAG has specific requirements for qualifying automatically starting moving content lasting over five seconds and for auto-updating content; reduced-motion support alone does not replace those controls. [Pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- Avoid rapid flashing, strobing, aggressive CRT flicker, and repeated full-screen brightness pulses. Decorative flicker is unnecessary to establish the arcade aesthetic.
- Pause invisible/offscreen rendering. Resuming a tab should not replay a startup sequence or leap across several queued animations.

## 16. Loading, performance, and graceful failure

Performance is part of the interaction design. A physical button that appears to ignore a click makes the arcade feel broken regardless of material quality.

- Keep the centered loader and full-phrase text treatment. Reveal the header coherently with the site, preserving the existing direct project/contact routes during loading.
- Do not invent loading percentages. Model downloads, decoding, shader compilation, and first usable interaction are different phases.
- Give immediate local feedback after an action. **Target:** visible acknowledgement within roughly 100 ms; that does not mean the entire asset must finish loading in 100 ms.
- For quick prepared interactions, delay the spinner briefly to avoid flicker. For genuinely slow operations, show meaningful progress and a usable exit. The existing delayed loading-label approach is preferable to flashing “Loading” on every tap.
- Do not add an artificial minimum loader duration for theatrical effect. A warm visit should benefit from being warm.
- Keep the last valid image/frame until its replacement is ready. Do not replace it with a blank rectangle while decoding.
- A failed late model must not blank the entire hall. A failed screenshot must not reset the project or prevent access to its text.
- Provide retry plus a usable alternative: original screenshot gallery, poster, project page, or contact information. Reduced capability should retain identity and content.
- Keep initial mobile work scoped to the relevant exhibit. Preserve the one-prepared-exhibition-model approach; do not create a live renderer for every machine in the list.
- Skip speculative heavy preparation on data-saving/very slow connections where supported. Do not rely on network-information APIs being available in every browser.
- Stop hidden loops and dispose abandoned resources safely. Cancellation must prevent old asynchronous loads from reopening a closed viewer or overwriting a newer selection.
- Prioritize navigation, text clarity, and input response over reflection quality, resolution, ambient movement, and decorative effects.
- Adapt quality based on sustained measurements with hysteresis. Avoid rapidly oscillating between quality levels or making the room visibly change on every input.
- Keep DOM labels sharp when reducing WebGL resolution. The UI should not become blurry merely because the scene quality drops.
- Reserve image/model layout dimensions early. Asset arrival must not move a button beneath the visitor's finger.

Performance targets to measure rather than assume:

| Metric | Target / interpretation |
| --- | --- |
| Core Web Vitals | LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile of real visits |
| Hall responsiveness | Measure first useful selection/open action separately from the loader ending |
| Mobile preparation | Measure scroll interruption and cold/warm tap-to-first-response on a physical midrange phone |
| Animation | Aim for stable 60 fps where practical; retain the existing deliberate 30 fps mobile/console targets where appropriate |
| Stability | Repeated entry/exit and station changes should not accumulate renderers, memory, duplicate events, or delayed actions |

Core Web Vitals thresholds come from [web.dev](https://web.dev/articles/vitals). The hall-specific targets are recommendations. A smooth canvas is not captured fully by those three metrics, and a desktop emulation run is not evidence of phone performance.

Do not reuse old September payload/latency figures as current findings. The October release changed performance substantially. Record device, browser, connection, cache state, test mode, and release with any new number.

## 17. Project media and case-study content

- The cabinet preview establishes the project's visual identity; the case study explains what Dennis did. Both need a clear route between them.
- Show project name, concise description, role, current status, and a truthful next action early in the case.
- Keep development status separate from runtime loading status. “In development” describes the product, not a broken cabinet.
- Preserve honest authorship, including AI-assisted implementation where already stated. Do not rewrite everything as either solo hand-coded work or generic AI output.
- Do not invent users, conversion improvements, awards, launch dates, research participants, or business results.
- When material exists, organize case content around problem/context, decisions, process, resulting work, and current state. Do not force every game, music project, or utility into an identical corporate UX case template.
- Keep original screenshots and meaningful captions. Do not replace real work with generic mockups simply for visual uniformity.
- Use `contain` for detailed screenshots where cropping would remove interface evidence. Intentional cover cropping is acceptable for a teaser if the full image remains accessible.
- Preserve image aspect ratio. Never stretch portrait app screens into landscape cabinet monitors or distort UI to fill a frame.
- Use sharp enough sources for the displayed size, responsive variants, and intrinsic dimensions. Avoid fetching full-resolution gallery assets for every distant cabinet screen.
- Media selection, visible image, caption, counter, and active thumbnail must always agree.
- Distinguish gallery surface groups if a project contains desktop/mobile/other media. Remember selected surface and image per project during the session.
- Give enlarged screenshots an uncluttered background, zoom access, reachable navigation, and a clear close control. Essential controls must remain readable over both white and dark images.
- Do not auto-advance the screenshot being inspected. Any ambient hall-screen cycle must pause appropriately when the visitor takes control.
- Write useful alt text about the image's purpose or relevant content. Decorative duplicate model posters can have empty alt text when the surrounding link already has a complete name.
- Provide a readable alternative for document/PDF evidence. A tiny embedded page is not sufficient for reading a UX study.

## 18. About, process, and contact

### About

- Keep the claw as the visual identity of About, with live model, zoom, pause, and failure/retry handling where supported.
- Ensure biography and qualifications remain reachable without interacting with the claw.
- Keep Process under About. Experience can use disclosure, with a clear trigger and `aria-expanded` state.
- Preserve Dennis's actual education, roles, and approved wording. Keep the distinction between art direction, UX/UI, multimedia work, product building, music, and image-pipeline work.
- Section links should land below sticky controls. The current compact 48 px navigation row must remain usable at 320 px; reflow or horizontal scrolling can be preferable to shrinking text.

### Contact

- The phone booth is a recognizable invitation, but a visitor must also find Contact from global navigation and direct links.
- Keep the contact task short and predictable. Do not require a game, account, or interaction with a tiny phone detail.
- Use suitable input types, autocomplete values, visible labels, and readable input text; 16 px is a useful mobile input target to avoid common focus-zoom behavior.
- Define empty, focused, filled, invalid, submitting, success, and failure states.
- Validate with clear field-specific messages, not only a red border or disappearing toast. Associate errors with their fields and provide an understandable announcement.
- Preserve typed content on network errors. Disable duplicate submission while sending without making the form appear frozen.
- State success only after the service confirms it. A click on Send does not prove message delivery.
- Keep a direct email/contact alternative available if the form cannot load or submit. Do not add made-up response-time promises.
- At mobile keyboard sizes, the focused field and its error must remain visible. The fixed header, submit row, and safe area must not trap the final fields offscreen.

## 19. Games, Easter eggs, and optional music

- Keep playful discoveries optional and separate from essential portfolio tasks.
- A wall game needs a visible start affordance and a way to stop/leave. Starting it must not permanently steal keyboard input from the site.
- Pause or release game input when a menu, form, gallery, or another foreground interaction owns focus.
- Avoid autoplay audio. Sound should begin after an explicit user action and have an obvious mute/pause route.
- If the CD player opens Spotify, signal that outcome before activation. Do not present a functioning in-site Play control that unexpectedly redirects without explanation.
- If hosted music is approved later, distinguish stopped, buffering, playing, paused, finished, and unavailable states. Show a usable track name and playback state in accessible HTML even if the physical display remains minimal.
- Do not make the spinning disc the only playback indicator. Respect reduced motion without removing playback controls.
- Decide whether music continues across internal navigation and backgrounding, then make that behavior predictable. Do not silently switch the current local behavior as part of a visual polish pass.
- Audio failure should leave the portfolio usable and offer an appropriate external listening option. Avoid adding album downloads to initial page load.

## 20. Localization and content integrity

- DE and EN must offer the same navigation, project identity, current status, error recovery, and essential information.
- Test long German labels and English alternatives in real components. Do not assume English is always shorter.
- Language switching should preserve the selected project and relevant context, without replaying the whole hall startup when the persistent scene is available.
- Update document language, accessible labels, title, status messages, and destination URLs alongside visible text.
- Avoid a mixed-language interface after client-side route changes. Localize retry/error/loading labels as carefully as headings.
- Do not silently invent translations for Dennis's new copy. Follow the project's translation review/queue process and report any untranslated content.
- Keep product names and intentional identity artwork intact. An official logo is different from interface text needing translation.

## 21. Component state checklist

Before calling a component finished, define the states that actually apply:

| Component | States to inspect |
| --- | --- |
| Signature/header link | Default, hover, keyboard focus, current route, narrow layout |
| Physical station key | Default, hover, focus, pressed, selected, unavailable if applicable |
| Previous/next control | Enabled, endpoint disabled, focus, rapid repeated input |
| Open/project link | Default, hover, focus, press, pending navigation |
| Station selector | Selected, expanded, keyboard operation, longest translated label |
| Model exhibit | Poster/loading, live, paused, offscreen, failure, retry |
| Cabinet viewer | Preparing, entering, ready, interrupted, closing, restored |
| Screenshot | Selected, decoding, ready, failed, enlarged, zoomed |
| Disclosure | Collapsed, expanded, focus, direct anchor destination |
| Filter | Unselected, selected, focus, changing results, zero results/reset |
| Contact field | Empty, focused, filled, invalid, disabled only if necessary |
| Submit control | Available, sending, confirmed success, recoverable failure |
| Audio control if shipped | Unavailable/external link, loading, playing, paused, ended, failure |

A component does not need a fake error or success state if its action has neither. It does need a defined response for every real state it can enter.

## 22. UX failures to actively look for on this site

These are inspection targets, not confirmed findings from this brief:

- Header plus sticky selector consume so much vertical space that the cabinet or case content becomes difficult to inspect.
- Tiny console keys remain visible but their hit areas are too small or overlap.
- Glass looks readable over the dark brick wall but becomes unreadable when a bright screenshot moves behind it.
- A thumbnail changes but the cabinet screen or enlarged viewer still shows the old image.
- The mobile station selector reports About while the visitor has settled on another exhibit.
- Vertical scrolling accidentally opens a model; pinch zoom accidentally advances the gallery.
- Closing the image also closes the cabinet, or Back returns to the top of the exhibition.
- A hidden desktop renderer continues working behind the mobile exhibition or a reading page.
- Screen-reader focus moves to an invisible canvas proxy with no visible indicator.
- A loading result arrives after cancellation and unexpectedly opens a viewer.
- Project titles or roles are shortened until they are no longer meaningful.
- Status is communicated only by a colored dot or duplicated with contradictory wording.
- “All projects” shows only machines and loses content-only work.
- A current in-development project receives a fabricated play/download action.
- A beautiful first frame hides slow first interaction or repeated entry stutter.
- Native page scroll, browser Back, zoom, or text selection are broken by global input handlers.

## 23. Verification matrix

Use representative coverage across modes and capabilities rather than claiming one screenshot proves responsiveness.

| Axis | Minimum useful checks |
| --- | --- |
| Portrait sizes | 320 × 568, 390 × 844, approximately 430 × 932 |
| Tablet/intermediate | 768 × 1024; 899 px and 900 px widths at the mode boundary |
| Landscape/short | 844 × 390; desktop around 1024 × 600 |
| Desktop | 1280 × 720, 1440 × 900, and one wide/high-density configuration |
| Input | Mouse, trackpad, touch, keyboard-only |
| Accessibility | 200% text enlargement, 400% browser zoom/reflow, reduced motion, forced colors, screen reader |
| Browsers | Chromium, Firefox, Safari; physical iOS Safari and Android Chrome where available |
| Loading | Cold/warm cache, slow network, failed GLB, failed screenshot, interrupted request |
| Capability | JavaScript unavailable, WebGL unavailable/context loss, low rendering performance |
| Content | DE/EN, long titles, portrait and landscape media, content-only projects |

Required journeys:

1. Fresh desktop home → choose Ishikiri → open project → select another screenshot → enlarge → close → return to the same hall station.
2. Fresh mobile home → scroll over models without opening them → enter Ishikiri → next image → enlarge → pinch → close → return to the same exhibit and selection.
3. About → process/experience disclosure → section anchor → return; check pause/zoom and readable content independently of the claw.
4. Direct project URL → read role/status → open all projects → filter → open content-only work → return.
5. Switch DE/EN during normal browsing; check project identity, selected media where applicable, localized links, and scroll restoration.
6. Open viewer and immediately close during preparation; reopen; repeat with rapid next/previous and an image request completing out of order.
7. Rotate/resize with a viewer open and cross 899/900 px; ensure no duplicated controls, orphaned canvas, lost project, or invisible focus.
8. Disable/fail 3D; confirm original media, project text, navigation, and contact remain usable.
9. Fill Contact and exercise validation, pending, success, and network-failure handling in a controlled test environment; do not send real messages as routine QA.
10. Perform the essential find-project/read/contact journey with keyboard and screen reader, without manipulating the 3D scene.

For every relevant change, save before/after evidence and record viewport, browser, route, UI state, and result. Distinguish automated checks, visual inspection, and physical-device measurements. Do not describe an emulated phone as a real-device test.

## 24. Priorities and definition of done

**P0 — fix first:** no route to content, trapped navigation/focus, lost form input, broken close/back, accidental touch activation, unreadable essential text, severe sustained freezing, or a model failure that blocks the whole portfolio.

**P1 — core usability:** unclear station selection, small targets, gallery/state mismatch, poor contrast over glass, lost return position, incomplete keyboard operation, obstructive sticky controls, localization overflow, slow first useful interaction.

**P2 — refinement:** spacing consistency, typography polish, optical alignment, subtle material/hover tuning, transition easing, secondary metadata density.

Definition of done for a changed flow:

- [ ] Its purpose and next action are understandable without explanation from the developer.
- [ ] It preserves the arcade identity and Dennis's existing decisions.
- [ ] Text, meaningful states, and controls meet their contrast requirements in context.
- [ ] Standalone targets meet the site's 44–48 px goal or have a justified, tested alternative.
- [ ] It works with touch, mouse, and keyboard where applicable; essential content is available to assistive technology.
- [ ] It handles loading, interruption, failure, reduced motion, and return correctly.
- [ ] DE and EN fit and convey equivalent meaning.
- [ ] It preserves selected project/media and appropriate scroll/focus across entry and exit.
- [ ] It passes the relevant portrait, landscape, short-height, and breakpoint checks.
- [ ] Performance was compared under the same conditions if rendering/loading changed.
- [ ] Claims are supported by evidence; untested environments and unresolved issues are recorded.

## 25. Where the implementing agent should work

Reconfirm the current handover and source before editing; other work may be in progress. This map is a starting point, not an instruction to change every file.

| Area | Relevant local source |
| --- | --- |
| Current decisions/release | `HANDOVER-CLAUDE-2026-10-05.md` |
| Base and effective UI tokens | `src/styles/tokens.css`, `src/styles/global.css`, `src/styles/arcade-interface.css` |
| Hall interaction/state | `src/components/hall/Hall.tsx`, `Stage3D.tsx`, `HallSession.astro` |
| Scene/models/camera | `src/components/hall/hallScene.ts`, `hallLayout.ts` |
| Physical navigation | `src/components/hall/dock-hardware.ts`, `dock-hardware.css`, `dock-screen.ts` |
| Loader/fallback | `src/components/hall/HallGuard.astro`, `hall-loading.css` |
| Mobile exhibition | `src/components/hall/MobileArcade.astro`, `mobile-arcade-viewer.ts`, `mobile-arcade.css` |
| Mobile About claw | `src/components/hall/MobileClaw.astro`, `mobile-claw.ts` |
| Project panel/cabinet | `src/components/work/CaseOverlay.astro`, `Closeup.tsx`, `closeup.css`, `hall-panel.css` |
| Enlarged gallery | `src/components/work/GalleryLightbox.tsx`, `gallery-lightbox.css` |
| About/process | `src/components/work/AboutOverlay.astro`, `about-panel.css`, `ProcessEvidence.astro` |
| Contact | `src/components/contact/ContactForm.tsx`, `src/pages/contact.astro` |
| Shared project data/status | `src/lib/hall-items.ts`, `src/lib/project-activity.ts`, `src/content/work/` |
| Localization | `src/lib/i18n.ts`, `src/components/i18n/`, `scripts/en-routes.mjs` |
| Existing verification | `scripts/qa/hero/README.md`, `scripts/qa/live/README.md` |

Respect existing uncommitted work. Keep the local text editor isolated from production. Do not revive archived features, scan/update unrelated project data, or publish arbitrary changes as a side effect of this brief.

For implementation QA, follow current repository instructions. Some historical suites encode old station order and static-mobile assumptions; update obsolete expectations based on the actual intended behavior, without weakening valid regression coverage. Documentation-only work does not require building or deploying the site.

## 26. Copyable instruction to the implementation agent

> Use this document as the UX/UI acceptance brief for dennisbf.design. First inspect the current handover, live behavior, and relevant source. Preserve the premium physical arcade, tactile console, live mobile exhibition, existing content, and Dennis's latest decisions. Identify actual gaps rather than assuming every checklist item is currently a bug. Prioritize navigation, readability/contrast, touch and keyboard operation, loading/performance, and state continuity before cosmetic refinements. Use an 8-point spacing system with 4 px subdivisions where useful, while preserving justified existing dimensions. Treat WCAG thresholds as requirements and the other numerical values as site targets to validate. Work in coherent, reviewable changes; exercise the complete affected journey across desktop/mobile, DE/EN, reduced motion, failure, and return states. Report what changed, how it was verified, and what remains untested. Do not invent copy or project claims, replace the arcade with a generic website, overwrite unrelated work, or treat this brief as production deployment authorization.

## 27. Standards and evidence

The recommendations above are tailored design judgments based on the site, its code, and Dennis's recorded decisions. Numeric accessibility requirements are grounded in the linked W3C material; the 8-point grid, type-size suggestions, motion timings, and 44–48 px target policy are design recommendations rather than universal laws.

- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/) — wider criteria, including keyboard, semantics, text enlargement, color, gestures, and status messages.
- [Text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) — thresholds and exceptions.
- [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) — meaningful graphics and controls.
- [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — AA minimum and exceptions.
- [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and [text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) — zoom and user text settings.
- [Dragging alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) — alternatives to drag-dependent actions.
- [Focus visibility under overlays](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) — fixed/sticky UI interactions.
- [Pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) — ongoing motion and updates.
- [Modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — focus and modal behavior guidance.
- [Core Web Vitals](https://web.dev/articles/vitals) — field performance thresholds.

Site evidence: live inspection of [dennisbf.design](https://www.dennisbf.design/), [Ishikiri](https://www.dennisbf.design/work/ishikiri/), effective live CSS tokens, the October 5 handover, mobile arcade documentation, hero-machine documentation, and current component source. Palette ratios were calculated from the effective hex values using WCAG relative luminance, without assuming that flat-color results certify translucent or WebGL-rendered surfaces.
