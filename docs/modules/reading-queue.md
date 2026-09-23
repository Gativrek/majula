# Reading queue

`items.type = 'reading'`. A title, an optional URL, an optional attached PDF, and a read
status (`SPECS.md` §2.1). The read status is the generic `done` flag.

## Payload

```jsonc
{ "pdf_path": "pdfs/<uuid>.pdf", "page_count": 14, "last_page": 6 }
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

10. **Open PDF** shows one page at a time, fitted to the screen width.
11. **Previous** and **Next** are in the lower half of the screen (`SPECS.md` §6), with the
    page number and the total between them.
12. The viewer **opens on the page it was last left on**, across closing the viewer,
    closing the app and restarting the phone.
13. The back button closes the viewer (`SPECS.md` §2.2, Back); back again closes the
    detail.
14. No annotation, highlighting or margin notes of any kind (`SPECS.md` §1.1 item 8).
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
- No zoom beyond fit-to-width in v1. Two-column academic PDFs read poorly on a phone
  regardless; ADR-004 accepts that, since the use case is short articles.
- No replacing an attached PDF (criterion 9).
