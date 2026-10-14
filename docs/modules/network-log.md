# Network log

`items.type = 'contact'`. Who you met, where, and a line of context (`SPECS.md` §2.1).

**Capture only.** No follow-up, no reminders, no "last contacted" staleness, no
relationship state (`SPECS.md` §1.1 item 10). The module records that a meeting happened
and stops there.

## Acceptance criteria

1. Quick capture with the **Contact** type creates a contact whose title is the person's
   name as typed.
2. Where they were met and the line of context go in the body. They are one free-text
   field, not two structured ones: the spec asks for a line of context, not a schema for
   an encounter.
3. A contact carries no done control and no status of any kind.
4. A contact is found by global search on the name **or** on anything in the body — which
   is the point, since "the GNSS person from SBAI" is how it will actually be recalled.
5. Tags work as they do on a note, and are the only grouping mechanism.
6. Nowhere does the app prompt to follow up, surface an age, sort by how long ago someone
   was met, or mark a contact stale.
7. A soft-deleted contact leaves the list and search, and returns intact on restore.

## Not in this module

- No phone numbers, emails, addresses or any other contact-detail fields. If a number
  matters it goes in the body, in whatever form it was written down.
- No integration with the device's address book. That is an account-shaped dependency and
  `SPECS.md` §1.1 item 4 rules it out.
- No follow-up workflow, no review queue, no reminders (§1.1 item 10).
