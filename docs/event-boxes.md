# Whiterun storage and event boxes

Open **Event boxes** after signing in with Discord. Customers see only their own assigned boxes. Private storage and planner controls are restricted to Discord IDs 314050267341520899 (owner) and 145997830052380674 (administrator).

## Storage

Quality-only variants (Pristine, Fine, Superior, Exquisite, Flawless, Epic, Legendary) share one logical stock entry per base item and name. Quantities combine; named variants such as Blood Moon and Spring Pink remain distinct, as do different base Form IDs. Raw captures are retained. Existing leading approvals survive grouping; conflicting old per-quality prices use the most recently updated override, and new edits apply to the whole group. Saved bundle components and historical reservations resolve through the original variant keys to prevent duplicate allocation.

Import the SKSE-exported inventory.csv separately from **Event storage** and **Store storage**. Imports replace that chest's snapshot; they never add repeated captures. 000C83B1 is event storage, 000C83E9 is store storage, and personal storage is ignored.

The importer selects the latest timestamp/session for the selected chest, rejects malformed rows and invalid quantities, and keeps plugin/local Form ID, custom name, and temper variants distinct. Use a complete exporter-produced CSV: the format has no independent end-of-snapshot count, so a syntactically valid but manually truncated file cannot be proven complete.

Confirmed prices from the supplied current-event.json are included as defaults without importing its quantities into public data. Saved owner overrides take precedence. Confirmed catalog base values, selling references and approved street reports supply otherwise missing values; provisional estimates and store buying offers cannot. Blank values stay unknown, and missing prices still require pricing or exclusion. Exact game-catalog matches are identified automatically; unmatched items are automatically excluded with a warning unless the owner explicitly identifies them. Unidentified items do not block other stock. All Amulet of … items are 150g.

KzlChestLootBook is an internal item and is ignored in storage and packing, including previously imported snapshots. Other unidentified items still require review. Exclusions remain visible in planner warnings.

## Planning and distribution

**Planned events** brings saved events, available/all boxes, expandable contents, remaining contents totals, customer quantities and handover into one view. **Edit / Repack** opens the saved draft settings in Box planner; generate again to incorporate the latest stock. **Delete draft** removes only an undistributed event and its purchase entries, after confirmation. Distributed events cannot be deleted or repacked. Customer rows support Update and Remove: unopened assigned boxes return to the pool when quantities decrease, but opened/handed-over boxes cannot be removed. Increasing a quantity requires Distribute boxes to assign the additional purchases.

**Excluded items** is a separate lottery reserve. Search event stock and choose **Set aside** to exclude every available copy of that logical item from all boxes, including leading bundles. **Return to boxes** restores eligibility without losing its price or leader selection. Changes invalidate draft plans and persist across imports; already distributed boxes are unchanged. Automatically excluded unidentified entries are listed separately and must first be identified in Event storage.

A lead worth at least `box price × (1 − target profit margin)` fills the box by itself. No extras or minimum-potion filler are added to that box. Complete leading bundles are treated as one lead. Surplus stock is packed into other eligible boxes; if all boxes are lead-only, it remains unallocated in event storage and is not counted as a packed cost or reserved during distribution.

**Leading rewards** is a reusable bundle library: pick item/quantity components and save. Labels are generated automatically from the contents; no name is required. The table shows combined value and complete available copies (shared ingredients are consumed only once during allocation). Edit, disable or remove definitions here. Enabled definitions join marked individual non-book leaders. Individual books cannot lead; A Dance in Fire requires all seven volumes, with a prefill button when they are present. For other book sets, explicitly include the complete series in your definition. Missing components prevent that bundle from being used; partial sets are never promoted to leaders. Missing leads are replaced with other contents and flagged in the plan. Definitions persist across captures, edits invalidate drafts, and distributed boxes retain their saved contents.

1. Review event stock and enter missing prices.
   Mark allowed main rewards using **Leading reward** and **Save** in Event storage. These choices persist across imports. In the planner, **Prefer marked items and saved leading bundles** uses approved leads where available; new events enable it by default. **Minimum potions per box** defaults to one for new events and counts any Potion-category item, including minor potions. Guaranteed potions cannot be moved away during balancing. Missing leaders produce a warning and filler-only boxes, while insufficient required potions still block generation. Already distributed boxes are unchanged.
2. Choose box types, exact quantities, prices and winning-box targets. New events start with two types; remove or add types as needed. Custom mode preserves your exact quantities and prices, allocates all eligible stock, and does not create extra Special boxes. A missed profit target is a warning rather than a reason to add boxes. The older automatic three-tier planner is still available. The preview recalculates after a short pause.
3. Select **Generate boxes** (or **Generate / Repack**) to save a plan.
4. In **Purchases & handover**, select customers who have already signed in and set their total purchased quantities by tier.
5. **Distribute boxes** assigns uniformly random remaining boxes of the purchased tier. The first distribution locks contents and reserves the whole generated pool. Later distributions assign only outstanding purchases; repeating distribution does not create extra boxes.
6. Customers receive an in-app unread badge and open their assigned boxes to reveal the already-drawn rewards. No payments or game delivery are performed.
7. Use the handover list to provide items in game, then mark each opened box handed over.

The planner is the supplied deterministic heuristic, not an optimal solver. Main rewards stay locked; one complete A Dance in Fire set remains together, Premium boxes need equipment, potion-led General boxes need two non-minor potions, and oversized valuables become separately priced Special boxes. Stock is reconciled by variant key.

Profit is (revenue − assigned contents value) / revenue, not historical acquisition profit. Winning-box targets default to 25% of standard boxes with contents worth 130% of the box price. Remaining boxes offset those losses. Targets are applied within each standard price tier, rounded to whole boxes; the preview lists actual finite-pool odds and warns when stock cannot achieve the request. Special boxes remain separately priced. Set winning odds to zero for the older balanced 70–115% guideline. Main rewards and inventory conservation always take precedence; material counts can vary to create the requested value spread.

Reservations cover both assigned and unassigned generated boxes. A new CSV cannot free rewards awaiting handover. Handovers after a capture are also deducted; handovers before it are already represented in the physical snapshot.

## Verification

Migration 0012_late_blacklash.sql adds only storage/event tables; it does not replace price reports or catalog data.

Unit tests cover CSV parsing and identities, the two-user permission boundary, and packing rules. scripts/verify-loot.ts exercises the real capture, pricing precedence, repeat imports, concurrent distribution, privacy and handover against a separately provisioned database whose name must end in _loot_test. It must never run against the live ledger. Short-lived fixture sessions are installed only in that isolated database for browser checks.

The reward reveal supports keyboard dismissal and reduced-motion preferences. Notifications refresh on focus, after local operations and every minute while visible.
