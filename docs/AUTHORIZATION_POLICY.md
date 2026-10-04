# Authorization policy

BREACHAI is for authorized security testing only.

## Required confirmation

Before a target can be created or a server scan can be queued, the operator must be signed in and the API requires this exact statement:

> I confirm that I own this target or have explicit authorization to test it.

The API stores the authorization timestamp and statement with the target. The frontend checkbox is not the security control; the server rejects requests that do not include the exact confirmation.

## Safe scan profile

The current server scanner is passive by design:

- one website `GET` request
- response headers and status only
- no crawling
- no payload injection
- no authentication attempts
- no form submissions
- no exploit execution
- no persistence
- no credential use
- no destructive actions
- no target code execution

GitHub scans read public metadata and text blobs. Local file scans stay in the browser.

## Network protections

Server-side website scanning blocks localhost, private address ranges, reserved ranges and internal hostnames after DNS resolution. Redirects are not followed. Scan requests are rate limited and audit records store a hashed source IP rather than the raw address.

## Handling findings

The scanner reports source-derived observations and heuristic confidence. It does not call an observation a confirmed vulnerability without evidence. Secrets and key contents are never copied into output.

Any future active engine integration must be isolated and disabled by default until scope, authorization, rate limits, cancellation and audit logging are reviewed.
