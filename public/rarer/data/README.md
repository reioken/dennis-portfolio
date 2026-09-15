# Answer catalog

`catalog.json` (version `wiki-12m-2026-08-v2`) holds the answers for Rarer's daily categories. Each entry keeps its display name, accepted aliases, canonical English Wikipedia article, median monthly pageviews (`views`), `rank` within its category and a 0–100 `rarity`. The browser makes no Wikipedia requests.

2,656 answers in 30 categories, listed in daily order:

| Day | Everyday | Pop culture | Geography / sport |
| ---: | --- | --- | --- |
| 1 | Fruits (74) | Pixar films (31) | Countries (150) |
| 2 | Cat breeds (52) | Fast food (56) | European cities (144) |
| 3 | Cheeses (48) | Video games (101) | Football clubs (125) |
| 4 | Wild mammals (126) | Beatles songs (128) | Capitals (150) |
| 5 | Desserts (89) | Board games (54) | Landmarks (140) |
| 6 | Dog breeds (150) | Marvel characters (35) | Sports (105) |
| 7 | Vegetables (72) | Car brands (74) | Islands (141) |
| 8 | Birds (103) | Apps (95) | Tennis champions (99) |
| 9 | Cocktails (58) | Ghibli films (25) | Mountains (101) |
| 10 | Dinosaurs (62) | Bond films (25) | Olympic hosts (43) |

Each category in `catalog.json` carries its Wikipedia list `source` and one-sentence `scope`.

## Category order

`edition.js` takes three consecutive categories per UTC day, stepping three each day. The pool is arranged in repeating triples: an everyday category (food, animals, objects), a pop-culture category (films, games, music, brands) and a geography or sport category. The pool length must stay a multiple of three. The order is set in `.rarer-tools/curated-categories.mjs` (`order`).

## Sources

- Countries, Beatles songs, cat breeds and dog breeds are parsed from cached Wikipedia list tables by `.rarer-tools/build-answer-seeds.py`. Beatles songs are the core catalogue, including covers, plus original songs from archive releases. Film-only performances are excluded because those articles mostly cover other artists' songs.
- Every other category is hand-curated in `.rarer-tools/curated-categories.mjs` as `Display name|Wikipedia article|alias;alias` lines. Aliases include common short names and very common German names (Emmentaler, München, Kölner Dom).
- Each category links a Wikipedia list page as its `source` and describes its `scope` in one sentence.

## Views, filters and rarity

For each canonical article (after redirects), `fetch-yearly-pageviews.mjs` fetches monthly English Wikipedia user pageviews, all access, for September 2025 to August 2026. `views` is the median month, so one-off news spikes do not decide rank. Titles that redirect to the same article are merged, and their names become aliases.

Filters, applied per category after merging:

1. Drop missing articles, disambiguation pages and entries that redirect to a "List of …" page. When titles merge, the entry whose own title is the article supplies the display name.
2. Drop articles with no German Wikipedia version, as a well-known test for a European audience. `GERMAN_ELSEWHERE` in the script exempts a short, checked list of everyday topics whose German article is linked to a broader item (Banana → Bananen, Snowboarding → Snowboard, Thanos).
3. Drop entries with median views below 3,000.
4. Keep the 150 most viewed.
5. Drop aliases that match another entry's display name, so every name is accepted unambiguously.

A category needs at least 20 entries after filtering, or the build stops.

Entries are sorted by `views`, highest first. `rank` 1 is the most viewed. Equal views share the lower rank number. `rarity = round(100 × (rank − 1) / (n − 1))`, where `n` is the category size, so rarity always rises with rank.

Views measure article attention, not direct player knowledge. Cover songs share their article's traffic with other performers, and city articles in the Olympic category count all interest in the city. Alias traffic is not added to canonical traffic. Because of the cap, the least-viewed valid answers in large categories (for example small countries) are unknown to the game. Unknown answers are free.

## Rebuild

From the project root:

```
python .rarer-tools/build-answer-seeds.py
node .rarer-tools/curated-categories.mjs
node .rarer-tools/fetch-yearly-pageviews.mjs --report
node .rarer-tools/test-answer-catalog.mjs
```

The fetch script caches redirects (`canonical.json`), German links (`dewiki.json`), disambiguation flags (`disambiguation.json`) and 12-month views (`pageviews-12m.json`) in `.rarer-tools/wiki-cache`. It writes them as it goes, so a rerun resumes. It sends a descriptive User-Agent, makes at most three pageview requests at once, waits about six seconds between MediaWiki batches and honours Retry-After. `--report` prints each category's top and bottom five. `--dropped` lists what each filter removed.

The older single-month script `fetch-answer-pageviews.mjs` is kept for reference only.

Keep a published score snapshot unchanged during an edition. Release a data refresh with a new `version`.

Sources: Wikipedia contributors, retrieved September 2026, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Pageviews come from the [Wikimedia Analytics API](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html).
