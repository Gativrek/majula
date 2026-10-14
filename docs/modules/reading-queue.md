# Reading queue

`items.type = 'reading'`. A title, an optional URL, an optional attached PDF, and a read
status (`SPECS.md` §2.1). The read status is the generic `done` flag.

## Payload

```jsonc
{ "pdf_path": "pdfs/<uuid>.pdf", "page_count": 14, "last_page": 6,
  "zoom": 1.5, "trim_margins": true }
```

Every field is optional; an entry with no PDF has an empty payload. `pdf_path` is relative
to the app's private data directory, never a path the owner chose (ADR-004).

## Acceptance criteria

**Capturing and editing**

1. Quick capture with the **Reading** chip creates an entry from the typed title, unread,
   with no URL and no PDF. Like a note, it is written at once: it is a single-field
   capture, not an edit in progress.
2. Tapping an entry opens its detail: title, URL, the PDF if one is attached, and the read
   status. Title and URL can be edited and saved there.
3. The URL is shown as text and can be opened, which hands it to the system browser. The
   app itself never fetches it (`SPECS.md` §1.1 item 5, §6).

**Attaching a PDF — ADR-004**

4. **Attach PDF** opens the system file picker filtered to PDFs.
5. The chosen file is **copied** into the app's private storage. The entry refers to the
   copy, never to the original.
6. **The original can then be deleted, moved or renamed** and the entry still opens. This
   is the reason ADR-004 exists.
7. A file that is not a readable PDF is refused with a message, and nothing is copied or
   written.
8. After attaching, the entry shows its page count.
9. An entry has at most one PDF. Attach is offered only while there is none. To change the
   PDF, delete the entry and create another — replacing would leave the old copy
   referenced by nothing, and purge only removes files belonging to deleted rows.

**Reading — the viewer**

10. **Open PDF** shows one page at a time, fitted to the screen width edge to edge, and
    centred vertically when the page is shorter than the screen — as an A4 page is on a
    phone held upright (owner’s device check, 2026-10-13).
11. **Previous** and **Next** are in the lower half of the screen (`SPECS.md` §6), with the
    page number and the total between them.
11a. **Swiping** turns pages too: left for the next, right for the previous (owner’s
     request, 2026-10-13). A swipe is quick and mostly sideways, so scrolling down a page
     never turns it. Zoomed past the width, a swipe scrolls the page sideways first and
     turns only when it starts with the page already at that edge.
12. The viewer **opens on the page it was last left on**, across closing the viewer,
    closing the app and restarting the phone.
13. The back button closes the viewer (`SPECS.md` §2.2, Back); back again closes the
    detail.
14. No annotation, highlighting or margin notes of any kind (`SPECS.md` §1.1 item 8).

**Reading size — added 2026-10-13 at the owner’s request, after an A4 page read too small**

15a. **Trim margins** crops each page’s white margins so its text fills the width. The
     crop is found by looking at the rendered page, so it works on any PDF; a page with
     no blank margin, or a blank page, is shown whole. Pages with different margins
     enlarge by different amounts.
15b. **Zoom** steps through 100%, 150%, 200% and 250%. Above 100% the page is wider
     than the screen and scrolls sideways as well as down.
15c. Both are remembered per document, alongside the last page, and survive a restart
     and an export/import. They change only how the page is drawn, never the PDF.
15d. The zoom and margin controls sit above the page; Previous, Next and Close stay at
     the thumb (`SPECS.md` §6).
15. If the entry names a PDF that is not on the phone — an import from an export made
    without PDFs — the viewer says so plainly instead of failing, and the entry is
    otherwise untouched. The path is logged as `reading.pdf_missing` (`CODESTYLE.md` §6).

**Deleting — `SPECS.md` §4.1**

16. Soft-deleting an entry **keeps** its PDF. Restoring it from Deleted opens the PDF at
    the same page.
17. **Purge** removes the entry and its PDF together.

**Backup — `SPECS.md` §5**

18. **Export** copies every attached PDF into `Majula/pdfs/`. **Export without PDFs**
    leaves them out.
19. **Import** on a fresh install restores the PDFs, and each entry opens at its saved page.

**Everything else**

20. **Reading** appears as a type view. The read check works as it does for a to-do.
21. An entry is found by global search on its title. The PDF's own text is not indexed.
22. Everything above works in airplane mode.

## Not in this module

- No annotation, highlighting, bookmarks or notes on pages (`SPECS.md` §1.1 item 8).
- No downloading a PDF from the URL. That is network, and the app has none (ADR-003).
- No text search inside PDFs, no reflow, no reading statistics.
- No pinch-to-zoom or free zoom levels: the four steps above are the interface.
- No text reflow. Two-column academic PDFs still read poorly on a phone; ADR-004 accepts
  that, since the use case is short articles.
- No replacing an attached PDF (criterion 9).
