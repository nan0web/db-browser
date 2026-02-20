> 🌐 **Translations**: [Українська (Original)](../next.md)

# @nan0web/db-browser Plan

## Architecture 2.0

We are adopting a transparent **Mount/Attach** architecture defined in [ARCHITECTURE_2_0.md](../../db/ARCHITECTURE_2_0.md).

### Objectives

1. Implement `BrowserDriver` (fetch/XHR) as a pure I/O backend.
2. Support `attach` for Offline Mode (e.g., `remote.attach(localCache)`).
3. Test fallback scenarios (404/Error → Fallback).
