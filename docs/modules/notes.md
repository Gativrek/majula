# Notes

`items.type = 'note'`. Free text with optional tags (`SPECS.md` §2.1).

A note has no state of its own: no done flag, no status, no dates beyond
the timestamps every row carries.

## Acceptance criteria

Observable behaviour only. Each one is checked on the device.

1. Quick capture with the **Note** type selected creates a note from the text typed,
   exactly as typed. Nothing is trimmed but leading and trailing whitespace, nothing is
   capitalised, nothing is translated (`CODESTYLE.md` §1). For a note, Enter starts a new
   line rather than saving; the save control saves. The first line becomes the title and
   the lines after it the body, blank lines inside the body kept.
2. Choosing **Notes** from the category icons, or **Note** from the capture type button,
   lists only notes and makes the next capture a note. The app opens on **To-do**, not on
   notes (`SPECS.md` §2.2).
3. A note with an empty title cannot be saved. The save control is inert until there is
   at least one non-whitespace character.
4. A saved note appears at the top of the **Notes** view, without a reload.
5. A note carries no done control. Tapping the row opens the note; it toggles nothing.
6. Tags entered on a note are stored as entered, in the order given, with duplicates and
   blanks discarded. `GNSS` and `gnss` are two different tags.
7. A note is found by global search on any word in its title or its body.
8. A soft-deleted note disappears from the **Notes** view and from search results, and
   appears under **Deleted**. Restoring it returns it to both.
9. All of the above work with the device in airplane mode.
10. An open note shows its title and its whole body, line breaks kept. Its pencil turns
    the whole text into one field, first line the title as at capture; Save stores it, and
    back or the × cancels the edit and writes nothing (`SPECS.md` §2.2, Back).
11. Saving an edit that leaves no text at all is refused with a message; the note is never
    left without a title.
12. A note row shows the first line of its body under the title.

## Not in this module

- No rich text, no markdown rendering, no attachments. A note is text.
- No pinning, no colours, no ordering other than newest first.
- No reminders or dates of any kind (`SPECS.md` §1.1 item 6).
