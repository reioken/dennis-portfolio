**Portfolio review — 10 September 2026**

The arcade is a strong identity for a designer who also builds products and games. Keep it. The largest opportunity is to make the quality of the work as immediately apparent as the quality of the environment. Today, visitors have to learn the environment before they can comfortably judge the portfolio.

This review treats the handover as background evidence. Its proposed copy changes are not approvals or requirements. No application source was changed.

**Scope and evidence**

- Read the handover, all 16 project content files, page templates, shared navigation/layout, project panels, galleries, contact form, and relevant scene/loading code.
- Opened every project route and the supporting Home, About, Projects, Lab, Arcade, Contact, Impressum, Privacy, and 404 views. Detailed visual/interaction checks concentrated on Home, About, Riftback, Berry, Essfreude, Mina, Forever, Projects, Contact, and Arcade.
- Reviewed desktop layouts at 1280/1440 CSS pixels and phone layouts at 390 × 844. Phone checks are viewport simulations, not tests on physical iOS/Android devices.
- Used the current dev site on port 4321 and the existing built output on port 4322. Tested selected English routes and the language switch in the built preview, because English pages are generated during build.
- Ran the existing build-output audit and TypeScript check. Did not rebuild, deploy, test actual email delivery, run an exhaustive accessibility audit, or collect fresh Core Web Vitals. The public deployment may differ from this workspace and was not audited.
- The hidden in-app browser initially stalled scene rendering; making it visible resolved that. This browser-tool behavior is not counted as a normal visitor loading failure.

**What is working well**

1. **The concept fits the author.** Cabinets, kiosks, the jukebox, character, and telephone connect games, apps, music, and personal identity in a coherent place. It is memorable and demonstrates implementation skill.
2. **Individual projects retain a recognizable identity.** Riftback's gold terminal, Berry's green kiosk, and Essfreude's warmer presentation help the collection feel curated. The real product captures supply useful evidence behind the atmosphere.
3. **The project-and-cabinet pairing works on desktop.** Keeping the exhibit visible while reading its explanation gives visitors context. The persistent scene preserves that spatial relationship between pages.
4. **There is a useful conventional project index already.** Its filters work; selecting Archive produced three relevant projects. Filter state is represented in the URL, and result counts are announced for assistive technology.
5. **The site has substantial original material.** Sixteen projects cover products, games, UX, and client work. Private and unfinished work is generally identified honestly. About includes concrete employers, dates, skills, and credentials.
6. **Contact has good foundations.** Labels, autocomplete, inline field errors, error announcements, and a direct email option exist. Submitting the empty form showed field errors and focused Name without sending a message.
7. **Basic publishing hygiene is present.** The existing audit passed for 50 marketing pages, local links, H1 presence, canonicals, and language alternates. This is useful coverage, though it does not validate interaction correctness.

**Fix these first**

| Priority | Finding and evidence | Recommended change | Done when |
|---|---|---|---|
| P1 | **Game launch embeds the portfolio inside itself.** In dev, open Arcade → Echo Frequency → Spielen. The iframe loads another arcade page with another Play button. Reproduced on the built English preview. | Give exported games a separate asset namespace or a verified game origin. Detect missing exports/configuration and show an unavailable state. Require a game-ready signal rather than treating iframe load as successful boot. | Play loads the actual game; absent or failed builds produce a useful error and retry/return actions; DE and EN both pass. |
| P1 | **Phone gallery controls overlap.** At 390 × 844, Riftback's Fullscreen button covers part of the Desktop/Mobile selector. Both are anchored near the top-left of the screenshot. | Put surface selection and gallery controls in separate rows outside the image. Reserve the image area for the work. | All controls remain visible and independently tappable for both landscape and portrait captures. |
| P1 | **Primary CTA contrast is too low.** Riftback's live-app link computes to text `#f7f8fc` on `#c9a45c`, approximately **2.21:1**, at 14px/600. | Use a dark foreground on light brand fills, or a darker fill with a tested light foreground. Check every brand variant and interaction state. | Normal-sized CTA text meets 4.5:1. See [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). |
| P1 | **Mobile menu and corridor links lose accessible names.** Below 900px, hiding their text with `display:none` leaves an unnamed menu button and unnamed project-dot links in the accessibility tree. | Supply localized accessible names independently of visual text. Keep the current project identifiable through text/state, as well as color. | The menu and every station link have meaningful names at desktop and phone sizes in DE and EN. |
| P2 | **The station slider discards keyboard focus.** Pressing ArrowRight on the focused slider changed its value and moved focus to BODY. Its change handler calls `.blur()`. | Preserve keyboard focus. If pointer interactions need different behavior, distinguish the input method. | Repeated arrow-key changes retain visible slider focus and meaningful value announcements. |
| P2 | **Navigation auto-hiding is designed around mouse movement.** The close-up header hides after 2.5 seconds; recovery listeners are `pointermove` and `keydown`. | Keep essential navigation visible on touch and while focus is within it; define a predictable tap behavior if hiding remains. | A stationary keyboard user and a touch user can always find an explicit way back. Physical-device verification is still needed. |
| P2 | **English accessibility is incomplete.** Examples include German hall labels, `Capture 1 von 1` on English Mina, and a German game-poster description. | Localize names, value text, captions, and alt text alongside visible strings. | English routes have English interface announcements after hydration and client navigation. |

The game issue originates in `src/pages/arcade/[id].astro`: without `PUBLIC_ARCADE_BASE`, the iframe targets `/arcade/<id>/index.html`, which is also the generated portfolio page. `public/arcade/` currently contains only its README. `ArcadeStage.tsx` advances to running after an iframe load and a delay; loading the wrong HTML therefore looks like success to the outer component. This is confirmed for the local build, not a claim about the live site's separate deployment configuration.

**Make the first visit easier**

The opening view prioritizes About, an animated character, station dots, and the environment. Your professional role is less explicit on the visible first screen than it is in the page title and About panel. A time-limited visitor must discover the menu to reach the project overview.

Keep a concise role/value line visible and provide direct access to **Projects** and **Contact** on desktop. On phone, put a clearly named Projects action near the station plaque. The existing `/work/` page can provide the fast browsing route immediately; it does not require inventing a new portfolio system.

Make station discovery more informative. Fifteen colored dots communicate position but little about what each project is. A compact named project chooser, with a small thumbnail and category, would make navigation more deliberate. Preserve direct previous/next movement for exploration.

Consider one shared project order for the hall and project index, or explicitly present them as different orders. Currently the hall starts Riftback → Sauté → Echo, while the index starts NEXUS → Berry → Riftcast. Switching surfaces also changes which project comes next. The hall counts 15 stations including About/Contact, while the index contains 16 projects, including three archives. Those totals are valid but describe different things; small unexplained counters do little to help visitors.

**Give the work more room**

The phone close-up is the clearest design weakness. On Riftback, the screenshot is a small landscape rectangle above a large blank cabinet front. On Berry, the portrait screen uses roughly half the phone's width; the cabinet still consumes most of the viewport. Captions and controls further cover the app itself.

Use a dedicated phone gallery layout: image first, then caption, surface selector, previous/next, and a clear return action. Retain a compact cabinet header or transition to preserve the arcade identity. The product should receive most of the usable width. Pinch zoom and fullscreen behavior should be verified on actual phones.

On desktop, reduce competition around the focused exhibit. The overhead TV and brightly cropped neighboring cabinets sometimes compete with the project panel and overlap the visual field behind the transparent header. Dim or simplify surrounding exhibits in reading mode. Keep richer ambient animation for browsing the hall.

Make screenshot inspection neutral. Close-ups add scanlines, vignette, and darkening; those are atmospheric but interfere with evaluating fine UI details. A clearly accessible clean-image view should remove them. The fullscreen CSS already removes the CRT overlay, so build on that behavior.

**Improve reading and visual hierarchy**

- **Increase functional type.** Many navigation, gallery, and helper labels are 9–11px uppercase monospace. Reserve that style for short decorative metadata. Use approximately 13–14px for controls and 16–18px for sustained reading, with adequate line height.
- **Give the header a stable reading surface.** A quiet dark backing or gradient can protect navigation from moving screens and brick textures. Reduce its visual weight through spacing and restrained borders rather than disappearing essential controls.
- **Simplify action hierarchy.** A primary action should reflect the project: view the work, open the live app, or play. Contact is a consistent secondary action. On About, LinkedIn currently has more emphasis than Contact; reconsider that if freelance enquiries are the main goal.
- **Make long reading comfortable.** The fixed panel creates an internal scroll region. About combines a long timeline with a dense metadata/skills column; Mina adds an entire document inside the panel. Offer an expanded reading view and ensure the panel is generous at laptop sizes.
- **Use fewer containers.** Existing rounded panels, inner cards, badges, dividers, pills, and glows sometimes give secondary metadata the same visual importance as the main argument. Remove one layer of framing where possible.
- **Place help near the action.** Tiny hints at the bottom-left are easy to miss. Provide one concise contextual hint beside the relevant control, then let familiar controls carry the interaction.

For touch controls, aim for comfortably sized hit areas around 44px where space permits. That is a usability target here, not a claim that every smaller control fails WCAG; the WCAG 2.2 AA minimum includes size and spacing exceptions. See [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

**Strengthen the professional story**

Most project text is a compact product pitch plus stack and current status. This shows that you can make things, but gives a reviewer relatively little evidence of how you make design decisions.

For three to five selected projects, add a short, specific account of the problem, your responsibility, a difficult constraint, a design decision, what changed through testing, and the actual result. Connect screenshots to those decisions. Use real evidence; if user or business results have not been measured, describe what was built or learned rather than implying a validated outcome.

Move framework versions, pipeline details, rename history, and internal production terminology below the main explanation. Keep relevant limitations and accurate status visible, but prioritize what the visitor can understand and evaluate.

| Project | Most useful editorial improvement |
|---|---|
| NEXUS | Strong flagship candidate. Show how multi-store navigation and controller use shaped the design. Explain how someone can evaluate a project labeled released when its panel has no download/live action. Reduce 24 captures to a curated initial sequence, with the rest available afterward. |
| Berry | Show the core collect/search/deck journey and one actual design iteration. Resolve `v3.4.1` in the badge versus `v3.41` in the timeline. |
| Riftcast | Explain onboarding, pairing, and adapting controls across devices through a short visual walkthrough. Keep network implementation details secondary. |
| Riftback | Strong because the live app can be inspected. Align 60 champion pages in the body with 63 champions in the outcome, or explain the distinction. Show the information architecture and search decisions. |
| Essfreude | Distinctive visual range and a clear audience. Lead with a concrete user journey and how explanations are presented. Keep the genuine limitations, while moving implementation and terminology checks into a secondary process note. |
| Mina | Promote the neighborhood-help problem and your individual contribution before the bootcamp credentials. The German study is 11 image slices with generic section alt text; rebuild it as readable HTML, as already done for English. A certificate is supporting evidence, not the product outcome. |
| Forever | Add context and your role for each campaign/image. Two body bullets do not explain the scope of the work. Replace generic numbered gallery descriptions with meaningful captions. |
| Logos & Concepts | The MDX body is empty. Identify the brief, intended audience, constraints, and reasoning for selected identities. Distinguish commissioned work from concepts. |
| Website Designs | The MDX body is empty. Explain what you designed versus implemented, and show a relevant flow or before/after where evidence exists. |
| Nocturne | Lead with its adaptive window behavior and show native captures of each genuinely different theme. The current text says browser previews make both themes look the same. |
| Briefly | The personal-use scope is clear. Explain source presentation, skimming, and uncertainty handling; replace the unnatural English “rubrics” with “sections” or “topics.” |
| Hookline | The connection from song to tool is compelling. Make the finished output easy to evaluate through an authorized playable excerpt if desired, then explain one workflow decision. |
| Carillon | Show the core play loop clearly and keep future demo work distinct from current functionality. Reduce specialist vocabulary in the first paragraph. |
| Echo Frequency | Fix launch first. Then show how tuning, evidence collection, and the pinboard support the experience. |
| Cab No. 9 | Strong narrative premise. Show driving/dialogue/form decisions. Explain agent-assisted production in terms of your direction and contribution, rather than assuming visitors know who “Sol” is. |
| Sauté Survivors | Make greybox status clear without letting a provisional screenshot define the whole portfolio. The 60fps/600-enemy figure is a performance budget in the text; keep it explicitly distinct from a measured result. |

**Supporting pages and navigation**

Projects: make it a first-class route. Use product screenshots or well-cropped composite previews more often than large standalone logos. Make status and medium visible before opening a project. “Product” and “Design” overlap heavily; categories based on visitor intent, such as Apps, Games, UX cases, and Client work, may be easier to scan. This is a proposed taxonomy, not an automatic content reclassification.

Lab and Arcade: the four games also appear in Lab and Projects. Give these destinations distinct jobs: Lab explains experiments; Games exposes verified playable builds. “Bald spielbar” implies a release expectation that the current data does not establish. Prefer an accurate development status unless a release is actually planned.

About: the character and portrait are memorable. Bring the short professional summary, relevant experience, and Contact forward; collapse or simplify older experience and extensive tool lists. Show credentials after the value proposition. An existing CV file could become an obvious optional action if its content is current.

Contact: on phone, the copy offers direct email but the address sits below the long form. Put the email link beside that sentence or above the form. Mark Subject as optional. Preserve the existing validation behavior. Actual message delivery remains untested.

Legal and Privacy: both routes render and appear in the conventional footer. Hall, project, and game modes omit that footer, and the menu omits these links. Add a small utility area within the menu so visitors can reach them without changing to a conventional page. This is a navigation observation, not a legal-compliance opinion.

404: useful recovery links to Home, Projects, and Contact already exist. Keep them; verify unknown production routes and language-specific recovery during release testing.

**Copy direction**

Prefer explicit actions in the interface. Suggested pairs for review: “Arbeit” → “Projekte”; “Captures” → “Screenshots” or “Ansichten”; “Groß ansehen” → “Screenshot öffnen”; “Automat zeigen” → “Zurück zum Projekt”; “Info” → “Projektinfo”; “Mehr lesen” → “Projekttext aufklappen.” Check that each label matches the exact resulting state before changing it.

“Halle” and “Spielhalle” currently lead to different experiences: the portfolio environment and the games index. Choose distinct names and apply them consistently. Keep playful terminology where the action is already obvious, such as the coin animation after pressing Play.

**Engineering findings that affect trust and smoothness**

The current bundle report is incomplete. It reports 311.6 KB of home JavaScript, but the dynamically imported `Stage3D.DFNLW9MQ.js` alone is **917,039 bytes, approximately 895.5 KiB**, before transfer compression. The audit's dependency regex recognizes double-quoted imports, while the emitted Hall bundle imports Stage3D with backticks. The headline number therefore cannot describe the full hall download. Models, textures, and captures are additional. Fix measurement before setting performance targets; do not reuse the handover's frame-time measurements as fresh results.

The scene has sensible optimizations in source: a persistent island, visibility pausing, image caching, neighboring-object culling, and shader warm-up. Preserve these. Measure cold-load time, first useful content, first usable navigation, gallery response, and low-end-device behavior independently of steady-state frame rate.

Loading needs an escape route. The 9-second ready timeout calls `finishReady()`, but that still waits for `compileAsync`, and calls during warming return early. A shader compile that never settles can therefore outlast the nominal timeout. This is a source-level robustness concern, not a reproduced normal-browser hang. Bound the complete warm-up phase and expose Projects/Contact while 3D initializes.

TypeScript currently reports **eight diagnostics** across `astro.config.mjs`, `hallScene.ts`, `gate-config.ts`, and `i18n.ts`. The package's `check` script runs build plus the HTML audit, so “check passes” does not mean type checking passes. Fix the diagnostics and include an explicit type-check step in the release workflow.

The broad uncommitted workspace also makes regression attribution difficult. Establish one reviewable baseline before implementing the next design pass; keep existing changes intact. Refactor scene/state coordination incrementally when modifying affected flows, rather than undertaking a rewrite solely because files are large.

**Recommended sequence**

1. Correct game availability/boot handling, overlapping phone controls, CTA contrast, accessible names, and slider focus.
2. Add direct Projects/Contact access; make return actions and labels consistent; make phone galleries prioritize screenshots.
3. Improve reading surfaces, type sizes, and focused-scene lighting; simplify About and add a comfortable long-form reading mode.
4. Curate a small set of flagship case studies with concrete design evidence; improve previews and reconcile status/version text.
5. Fix measurement and type-check gaps, then validate the changed flows on desktop, physical phones, reduced-motion settings, keyboard-only navigation, and DE/EN built routes.

Useful acceptance tasks for the next pass: a new visitor can identify your role and open selected work without discovering hidden controls; a phone user can inspect a screenshot without overlapping UI; a keyboard user can switch projects and return with predictable focus; Play either starts a real game or clearly explains availability; a client can find direct contact from any view.
