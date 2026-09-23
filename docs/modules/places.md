# Places to try

`items.type = 'place'`. A name, an optional note, and optional coordinates
(`SPECS.md` §2.1, §4.3).

## Payload

```jsonc
{ "lat": -12.34, "lon": -56.0 }   // or {} when the place has no coordinates
```

The name is the title and the note is the body. Coordinates are decimal degrees, both
present or both absent — a latitude without a longitude is not a place.

## Acceptance criteria

**Capturing**

1. Quick capture with the **Place** chip creates the place from the typed name and opens
   its detail, where **Here** is one tap away. The place is already saved: like a note it
   is a single-field capture, so back only closes the detail (`SPECS.md` §2.2, Back).
2. The detail edits the name and the note.

**Coordinates from here**

3. **Here** stores the phone's current position. It works in airplane mode, from GPS alone,
   though the first fix without signal can take a while; the screen says it is locating.
4. The first time **Here** is used, Android asks for the location permission. It is never
   asked for at install, and nothing else in the app uses location.
5. If permission is refused, or no fix arrives in time, the screen says which, and the
   place is left unchanged.
6. The accuracy of the fix is shown when it is taken ("±12 m"), so an approximate-location
   grant is visible as such. It is not stored: the payload is `lat` and `lon` only (§4.3).

**Coordinates pasted**

7. Coordinates copied from a maps app — `-12.3400, -56.0000`, or a `geo:` link — can be
   pasted in and set.
8. Anything else is refused with a message, never guessed:
   - decimal commas (`-12,34, -56,0`), where the separator between the numbers is ambiguous;
   - degrees-minutes-seconds;
   - a latitude outside ±90 or a longitude outside ±180;
   - a pair that looks like longitude first, which is refused rather than silently swapped.
9. Coordinates can be cleared.

**Using them**

10. A place with coordinates offers **Open in maps**, which hands a `geo:` link to the
    device's maps app. The app itself never draws a map (no map dependency, `SPECS.md` §8).
11. Rows show whether a place has a location.

**Everything else**

12. **Places** appears as a type view. A place is found by global search on its name or
    note.
13. Soft delete, restore, purge, export and import behave as for every other item, with and
    without coordinates, and coordinates come back exactly.
14. Coordinates never appear in the logs (`CODESTYLE.md` §6).

## Not in this module

- No map, in-app or embedded (`SPECS.md` §8: a map view is a new dependency).
- No distance, no "nearby", no sorting by proximity, no geofenced reminders.
- No background location, no location history. The only read of the position is the one
  the owner triggers with **Here**.
- No address lookup or reverse geocoding. That is network (ADR-003).
