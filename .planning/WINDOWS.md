---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-22T08:32:35.221Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | deviation | src/App.shelfIsolation.integration.test.tsx |  | Switch-back assertion uses stale-leak semantics not URL identity | open |  | 2026-09-22T08:32:35.221Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "03",
    "file": "src/App.shelfIsolation.integration.test.tsx",
    "line": null,
    "description": "Switch-back assertion uses stale-leak semantics not URL identity",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-22T08:32:35.221Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
