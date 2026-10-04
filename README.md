# BREACHAI

An open-source, frontend-only product experience for an authorized AI web security testing platform.

The website presents the product concept, responsible-testing principles, a safe browser-based scan engine, and a live public view of this repository. It does not execute target code, crawl websites, exploit systems, create accounts, store projects, or fabricate security findings.

## Live repository data

The page reads public metadata from the GitHub API for:

- stars
- forks
- open issues
- watchers
- repository description, language, license and default branch
- repository timestamps
- public issues
- public contributors

If GitHub is unavailable or rate-limited, the interface shows an unavailable state or a dash. It does not substitute invented values.

## Run locally

No build step is required:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Open `http://localhost:4173` in a browser.

The public GitHub API is requested directly by the browser. A network connection is required to populate live repository values.

## Scan modes and responsible use

- **Website:** makes one browser CORS request and checks the response status, content type and readable security headers. It does not crawl, authenticate, send payloads or exploit anything. Targets that do not allow browser CORS reads are reported as unavailable rather than bypassed.
- **GitHub repository:** reads the public repository tree and text blobs, then checks paths and source for credential-like assignments, private-key material, unsafe sinks, command execution patterns and plaintext HTTP references. Values that look secret are never printed.
- **Files / folder:** reads selected text files locally in the browser. Files are not uploaded or stored.

All modes require confirmation that you own the target or have explicit authorization to assess it. The project form is a frontend convenience and does not persist a project. Do not use this repository to test systems you do not own or have explicit permission to assess.

## Contributing

1. Fork the repository.
2. Create a focused branch.
3. Make a change with no hardcoded customer, owner, review, scan or security metrics.
4. Open a pull request with a clear explanation.

Please use the public issue tracker for bugs and feature discussions:

<https://github.com/Vismay-dev1/Interactive-website/issues>
