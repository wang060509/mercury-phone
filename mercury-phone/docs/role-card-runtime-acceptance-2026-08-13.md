# Role Card Runtime Acceptance

## Scope

This record covers a local source-folder role card and its embedded worldbook. No source text, asset, credential, or provider request body is copied into this document.

## Import findings

- The card passed generic character-card preflight and produced one independent embedded worldbook bound to the imported role.
- The source used a version suffix in the display label and a long unstructured description. Mercury now removes decimal version suffixes from newly imported contact names and stores that description once as background instead of duplicating it as both summary and background.
- Mercury reports `role_description_preserved_as_background` when it cannot derive concise structured fields from a long opaque description. It preserves the content rather than inventing identity or trait fields.
- Existing contacts are not silently rewritten. Re-import a contact to apply the cleaned display label and non-duplicated profile data.

## Runtime acceptance

- Local request reconstruction selected current-message worldbook entries and retained the matching entry in the assembled system prompt.
- A provider-backed identity and address probe returned the role's expected authority and form of address.
- A provider-backed embedded-worldbook probe returned the expected family relationship and status facts.
- Both responses followed the active short-message presentation shape. Browser error logs were empty after the requests.

## Boundary

These replies are evidence that the assembled context influences the configured provider. They are not a guarantee that every future reply will be factually correct. Selection, truncation, and failures remain observable through the local runtime trace; unavailable worldbook runtime still degrades by omitting worldbook text rather than simulating injection.
