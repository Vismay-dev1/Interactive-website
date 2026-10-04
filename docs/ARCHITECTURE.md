# BREACHAI architecture

## Implemented runtime

The repository currently runs without third-party packages:

```text
Browser
  ├─ live GitHub repository metadata
  ├─ local file/folder static inspection
  └─ same-origin API client
       │
       ▼
Node HTTP API
  ├─ authorization gate
  ├─ rate limits
  ├─ in-process scan queue
  ├─ passive website checks
  ├─ GitHub tree/blob inspection
  ├─ scan status polling
  └─ append-only development audit records
       │
       ▼
.data/store.json (development persistence, ignored by git)
```

`npm start` serves the static website and the API from the same origin. This avoids browser calls to localhost in the deployed preview and keeps the API origin-relative.

## Scan lifecycle

1. The operator selects a website or GitHub repository.
2. The operator signs in and confirms the exact authorization statement.
3. `POST /api/scans` validates the account, source, authorization statement and rate limit.
4. A target and audit record are created before any network request is made.
5. The scan is queued and its id is returned.
6. The worker performs only the selected safe checks.
7. `GET /api/scans/:id` returns queued, recon, scanning, done or failed state.
8. Results contain redacted evidence and source links, never secret values.

## Current engines

- Website: one passive `GET`, response status and readable security headers.
- GitHub: public repository metadata, recursive tree and bounded text blobs.
- Local files/folders: browser-local text inspection with size and file-count limits.
- Source rules: sensitive paths, credential-shaped assignments, private-key headers, unsafe HTML sinks, dynamic execution, command execution and plaintext HTTP references.

No code from a target is executed. No crawler, exploit payload, credential attempt, persistence, form submission or destructive action is present.

## API

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/targets`
- `POST /api/scans`
- `GET /api/scans/:scanId`
- `GET /api/scans/:scanId/report`

## Production hardening before deployment

The development JSON store should be replaced with PostgreSQL/Prisma, the in-process queue with a durable queue, and authentication should be backed by a managed identity provider or a reviewed session service. Active engines such as ZAP or Nuclei must remain disabled until isolated execution, scope locking, rate limits, authorization records, operator approvals and audit review are implemented.
