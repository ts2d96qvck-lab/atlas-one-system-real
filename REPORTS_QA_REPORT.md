# Reports QA Report

**Date:** 2026-05-25 (updated)

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Dashboard loads | PARTIAL | API blocked for agent; UI not tested |
| 2 | Supervisor dashboard | **PASS** | GET /ops/sla 200 |
| 3 | Date filters | NOT TESTED | |
| 4 | Agent filter | NOT TESTED | |
| 5 | SLA metrics returned | **PASS** | supervisor token |
| 6 | CSV export downloads | **PASS** | GET /ops/export/leads.csv → 200 |
| 7 | Export content valid | PARTIAL | Status 200; content not parsed |
| 8 | Empty report states | NOT TESTED | |
| 9 | Agent blocked from reports | **PASS** | agent → ops/sla 403 |

Audit CSV export also **PASS**: GET `/admin/audit-logs/export.csv` → 200
