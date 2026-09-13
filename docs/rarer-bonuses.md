# Bonus challenges

Implemented: Full spectrum (all six tiers in one dig) and Three of a kind (three increasing answers in one tier). Each adds 25%, once per dig. Together they give a banking multiplier of 1.5, applied after spills and rounded down. Three mistakes forfeit the haul and its bonuses. Banked receipts, rather than recalculated achievements, determine the lifetime total.

The six tiers are Common, Uncommon, Unusual, Rare, Very rare and Legendary. Their internal percentile boundaries are 0 / 20 / 40 / 60 / 80 / 95. The player sees a colored tier and a treasure value, not a percentile. Treasure value is `(catalog rank + 1) × 10`: positive, strictly increasing, and directly used in scoring. The existing chain multiplier remains the chain length.

More possibilities, ranked for a later iteration:

| Challenge | Requirement | Suggested reward | Judgment |
| --- | --- | --- | --- |
| Close calls | Three consecutive successful increases of no more than 30 points each | +15% on banking | Best next experiment: explicitly rewards small steps. Check availability per category before making it a daily challenge. |
| Clean sweep | Bank at least three links in each of the day's three digs, with no mistakes | A daily stamp or cosmetic ribbon | Rewards a whole day of careful play. A minimum chain length prevents three trivial one-answer banks. |
| Local expert | Five increasing answers within one tier | Alternate challenge replacing Three of a kind, +30% | A harder variant, not an additional stackable reward. Best for large catalogs. |
| Second wind | After the second mistake, add three successful links and bank | A recovery badge | A fun comeback moment. Keep it cosmetic so deliberately making mistakes is not profitable. |
| Balanced haul | Bank at least five links in every category | A daily collection stamp | Encourages playing all three digs rather than optimizing just a favorite category. |
| Long way round | Bank ten or more links | A milestone badge | Easy to understand, but chain length already pays heavily. No additional multiplier needed. |
| First discovery | Bank a legendary answer never previously brought home | A special collection border | Good long-term progression without giving established players a growing numerical advantage. |
| One more tier | After earning Three of a kind, reach the next tier and bank | Alternate daily objective | Makes a clear decision point, but overlaps with Full spectrum. Rotate it in rather than stacking it on top. |

Recommendation: keep only the two shipped multipliers active while testing. Try Close calls next, then add Clean sweep as a cosmetic daily reward. Use visible progress before an achievement can be earned. Reveal the actual payout after banking. Avoid time bonuses, random payouts, bonuses for wrong answers, or a reward for jumping straight to Legendary; those fight the game's central tradeoff.

Save compatibility: existing banked totals, treasure materials and collected legendary answers stay intact. Unfinished digs adopt treasure points; their previous loss fraction is preserved, rounded up. Existing receipts do not receive retroactive bonuses. The old save key is retained so stale versions cannot silently create a separate profile.
