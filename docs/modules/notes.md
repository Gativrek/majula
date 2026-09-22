# Notes

`items.type = 'note'`. Free text with optional tags (`SPECS.md` §2.1).

A note is the default capture type. It has no state of its own: no done flag, no status,
no dates beyond the timestamps every row carries.

## Acceptance criteria

Observable behaviour only. Each one is checked on the device.

1. Quick capture with the **Note** chip selected creates a note whose title is the text
   typed, exactly as typed. Nothing is trimmed but leading and trailing whitespace,
   nothing is capitalised, nothing is translated (`CODESTYLE.md` §1).
2. **Note** is the chip selected when the app opens. No other chip is.
3. A note with an empty title cannot be saved. The save control is inert until there is
   at least one non-whitespace character.
4. A saved note appears at the top of the **Notes** view and of the unfiltered list,
   without a reload.
5. A note carries no done control. Tapping the row does not toggle anything.
6. Tags entered on a note are stored as entered, in the order given, with duplicates and
   blanks discarded. `GNSS` and `gnss` are two different tags.
7. A note is found by global search on any word in its title or its body.
8. A soft-deleted note disappears from the **Notes** view and from search results, and
   appears under **Deleted**. Restoring it returns it to both.
9. All of the above work with the device in airplane mode.

## Not in this module

- No rich text, no markdown rendering, no attachments. A note is text.
- No pinning, no colours, no ordering other than newest first.
- No reminders or dates of any kind (`SPECS.md` §1.1 item 6).
