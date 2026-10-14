# Cookbook

`items.type = 'recipe'`. Ingredients, ordered steps and servings, in a typed payload
(`SPECS.md` §2.1, §4.3).

The phone's job here is **reading at the counter**, not authoring. Entering a recipe is
the one place in the app that is not seconds-long capture, and it is accepted as such:
it happens once, and the recipe is read many times.

## Payload

```jsonc
{
  "servings": 4,
  "ingredients": [
    { "qty": 500, "unit": "g", "name": "feijão" },
    { "name": "sal a gosto" }
  ],
  "steps": ["Cozinhe o feijão.", "Refogue o bacon."]
}
```

`qty` and `unit` are each optional; `name` is required (§4.3, ACCEPTED 2026-09-23).
Everything is stored exactly as typed. Recipe text is never translated, normalised or
case-folded (`CODESTYLE.md` §1).

## Acceptance criteria

**Creating and editing**

1. Quick capture with the **Recipe** type opens the editor with the typed title filled in
   and one serving. **Nothing is written until Save.** Cancel or the back button discards
   the new recipe entirely — no row is created, nothing appears under Deleted
   (`SPECS.md` §2.2, Back).
2. The editor has servings, then ingredients, then steps, in that order.
3. Each ingredient is three fields — quantity, unit, name. **Nothing is parsed out of
   free text.** "2 ovos" typed into the name field stays a name, not a quantity; the same
   reasoning as GATE P1 closing on no prefix syntax in quick capture.
4. Quantity accepts decimals with either `.` or `,`, since the owner types Portuguese
   recipes on a phone whose keyboard may offer either. It is stored as a number.
   A value that reads as a different number in each convention — `1.000`, `2,500` — is
   **refused with a message**, never guessed. In Portuguese `1.000 g` is a kilo; read as a
   decimal it is a gram, and nothing on screen would say which one was stored.
5. An ingredient row left entirely blank is dropped on save. A row with a quantity or unit
   but no name is **refused**, not dropped: dropping it would silently discard something
   the owner typed. An ingredient with only a name is kept, and shows no quantity.
6. Steps are an ordered list. A step can be added, edited and removed, and empty steps are
   dropped on save.
7. Saving an invalid recipe — no title, servings not a positive number, a quantity that is
   not a number — is refused with a message saying which field, and nothing is written.
8. Cancel, or the back button, discards the edit and writes nothing. Editing an existing
   recipe returns to it unchanged; adding a new one returns to the list with no recipe.

**Kitchen mode — the reason this module is on the phone at all**

9. Opening a recipe shows it in **kitchen mode**: large type, readable at arm's length on a
   counter.
10. The screen **does not sleep** while a recipe is open. Left untouched for longer than
    the device's screen timeout, it stays lit.
11. Leaving the recipe releases that hold. The screen sleeps normally again afterwards.
12. Switching away from the app and back while a recipe is open re-acquires the hold — the
    platform drops it when the page is hidden.
13. If the device refuses to keep the screen awake, the recipe still opens and a line on
    screen says the screen may sleep. Never a silent failure (`CODESTYLE.md` §6).
14. Steps are numbered. Ingredients show quantity, unit and name in one line.
15. **Close** and **Edit** are in the lower half of the screen (`SPECS.md` §6). The back
    button closes the recipe, as Close does.

**Everything else**

16. A recipe is found by global search on its title. Ingredients and steps are not
    searched: they live in the payload, and `items_fts` indexes title and body only
    (§4.2). This is a known limit, not an oversight.
17. **Recipes** appears as a type view.
18. Soft delete, restore, purge, export and import behave as for every other item, and a
    restored recipe opens with every ingredient and step intact.
19. All of the above work in airplane mode.

## Not in this module

- No scaling by servings. Servings is a number the recipe states, not a control.
- No unit conversion, no nutrition, no timers, no shopping-list generation.
- No photos. A photo is a file, and files belong to the reading queue's attachment path.
- No import from websites or other apps. That is network, and `SPECS.md` §1.1 item 5
  excludes it.
- No pantry linkage (`SPECS.md` §1.1 item 9).
