# Answer catalog

`catalog.json` contains 2,165 canonical answers, plus aliases, in nine categories. Each entry retains its Wikipedia article, August 2026 human pageview count and integer rarity score. The browser makes no Wikipedia requests.

| Category | Answers | Source and scope |
| --- | ---: | --- |
| Countries | 205 | [Sovereign states](https://en.wikipedia.org/wiki/List_of_sovereign_states), including disputed states, Cook Islands and Niue; excludes dependencies and constituent countries |
| Beatles songs | 355 | [Recorded songs](https://en.wikipedia.org/wiki/List_of_songs_recorded_by_the_Beatles), including covers, archive material and recorded/filmed performances |
| Chemical elements | 118 | [All named elements](https://en.wikipedia.org/wiki/List_of_chemical_elements), with symbols and spelling variants |
| US states | 50 | [US states](https://en.wikipedia.org/wiki/List_of_states_and_territories_of_the_United_States), with postal abbreviations |
| Constellations | 88 | [IAU constellations](https://en.wikipedia.org/wiki/IAU_designated_constellations), with IAU abbreviations |
| Cat breeds | 92 | [Cat breeds](https://en.wikipedia.org/wiki/List_of_cat_breeds), including experimental breeds and landraces |
| Dog breeds | 607 | [Dog breeds](https://en.wikipedia.org/wiki/List_of_dog_breeds), including landraces and extinct breeds |
| Best Picture nominees | 612 | [Academy Award nominees](https://en.wikipedia.org/wiki/Academy_Award_for_Best_Picture), including winners; ambiguous titles require a year |
| Shakespeare plays | 38 | [Traditionally attributed plays](https://en.wikipedia.org/wiki/Shakespeare%27s_plays), including The Two Noble Kinsmen |

Counts merge titles which redirect to the same article. Unlinked song/breed entries without a resolvable article are outside this initial scoring snapshot. These broad lists are not a promise to recognize every conceivable valid answer; unknown answers are free and the game exposes each category's scope.

Sources: Wikipedia contributors, retrieved September 13, 2026. Source list material is available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This adapted catalog retains source links, canonical titles, aliases, scoring transformations and provenance for attribution. Pageviews are numerical measurements from the [Wikimedia Analytics API](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html).

## Rarity

For each category, sort canonical articles by August 2026 pageviews, greatest first. Map rank to 0–100, using mean rank for equal pageviews and rounding to an integer. Higher means less viewed within that category. Equal rounded scores cannot extend the chain. The top of a large category can therefore contain more than one answer at 100.

Views measure article attention, not direct player knowledge. Covers share their song article's traffic with other performers, and news can increase a country's traffic. Denmark and Netherlands explicitly use their main country articles rather than the broader Danish Realm and Kingdom of the Netherlands articles. Alias traffic is not added to canonical traffic.

## Daily editions

`edition.js` selects three categories from the nine-category pool by UTC date. Everyone gets the same set. Consecutive days use different categories; the initial pool repeats after three days. Add complete sourced categories to expand that rotation. Daily progress is stored by date and receipts prevent duplicate banking. An unfinished old edition can be completed without a timer before today's set is opened. Finishing three digs counts toward the local streak.

Keep this published score snapshot unchanged during an edition. A future data refresh should be released with an explicit version/archive strategy before replacing scores used by active games.

## Rebuild

The retained HTML and parsed tables are in `.rarer-tools/wiki-cache`. Run `parse-wiki.py`, then `build-answer-seeds.py`, then `node .rarer-tools/fetch-answer-pageviews.mjs 2026-08` from the project root. The downloader resolves redirects, caches results, respects Retry-After and uses at most three concurrent requests. `publish-cached-catalog.mjs` rebuilds from an already complete cache. It can also publish development snapshots of fully scored categories; never release one with `building: true`.

Run `node .rarer-tools/test-answer-catalog.mjs` to check recognition, aliases, counts, disambiguation and score ordering. No build step is needed to serve the resulting JSON and game.
