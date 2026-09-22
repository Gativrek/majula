# Running-low list

`items.type = 'grocery'`. Tap to add when you notice; check off when bought
(`SPECS.md` §2.1). This is the grocery list.

**No quantities** (`SPECS.md` §1.1 item 9). Not a number field, not "2x" parsed out of
the title, not units. The list answers "what do I need", not "how much is left".

## Acceptance criteria

1. Quick capture with the **Running low** chip creates a grocery item with `done = 0`.
2. Adding an item takes one tap to focus the input, the typing, and one tap to save.
   Nothing else — no category picker, no quantity step, no confirmation.
3. A grocery row carries a check control, as a to-do does. Tapping it toggles bought.
4. A checked item stays in the list, struck through, until it is deleted or purged. It is
   not auto-removed: the list is also a record of what was bought this trip.
5. The check state survives a force-stop and relaunch.
6. Nowhere does the app store or display a quantity, a unit, a price, a shop, or a
   depletion estimate (§1.1 item 9, and §1.1 item 12 for price).
7. An item is found by global search whether or not it is checked.
8. A soft-deleted item leaves the list and search, and returns on restore with its check
   state intact.

## Not in this module

- No quantities, units, prices or totals.
- No pantry inventory, no depletion logic, no "you usually buy this" suggestions.
- No shops, aisles or categories. Tags exist if grouping is ever wanted.
