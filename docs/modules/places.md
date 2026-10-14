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

1. Quick capture with the **Place** type creates the place from the typed name and opens
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

**From Google Maps — added 2026-10-13 at the owner’s request**

A Google Maps share is a name, perhaps an address, and a link. The short links it shares
(`maps.app.goo.gl/…`) carry no coordinates, and resolving one takes the network, which
Majula does not have (ADR-003). The link itself is what gets the owner back: Google Maps
resolves it.

15. In Google Maps, **Share → Majula** on a listing creates a place named after it, with
    the Maps link kept, and opens it. One step; nothing to type.
16. Sharing a listing that is already a live place opens that place instead of making a
    second one.
17. A share with no Google Maps link in it — from any other app — is refused with a
    message, and nothing is written. Majula takes shares for places only.
18. On a place’s screen, pasting a Google Maps link (**Share → Copy link** in Maps) into
    the same field as coordinates keeps the link on that place.
19. When a link contains coordinates — the long `google.com/maps/…` form does, the short
    form does not — they are filled in too, preferring the listing’s own position
    (`!3d…!4d…`) over the map view’s centre (`@…`).
20. **Open in maps** opens the kept link when there is one — the exact listing, with its
    reviews and hours — and the coordinates otherwise. A place with a link but no
    coordinates still offers it.
21. Shared text is untrusted input: only links to Google Maps hosts are accepted, and
    nothing in a share is ever opened automatically.

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
- No address lookup or reverse geocoding, and no resolving short links. That is network
  (ADR-003).
- No shares from apps other than Google Maps, and no shares of anything but text.
