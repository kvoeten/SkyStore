# SkyStore design archive

This directory preserves the approved visual direction and the deterministic prototype that preceded the production application. It contains no backend and makes no network requests.

## Open the historical prototype

Open `prototype/index.html` in a browser. The prototype is split into two linked, responsive surfaces:

- `prototype/core.html`: login, delayed public guide, staff dashboard, inventory, item detail, recipes, and global state examples.
- `prototype/operations.html`: purchase and sale receipts, street reports, stock corrections, approvals, reports, store administration, platform administration, and catalog intake.

Use the **Preview state** control in the core header to inspect loading, empty, low-confidence, and error presentations. Operational forms include pending, validation, warning, empty, and destructive-action examples inline.

The production interface now lives under `src/` and `public/`. Labels and workflows in this prototype are historical and may differ from the implemented product.
