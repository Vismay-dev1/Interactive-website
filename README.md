# BREACHAI

An open-source, frontend-only product experience for an authorized AI web security testing platform.

The website presents the product concept, responsible-testing principles, a non-networked scan-flow UI, and a live public view of this repository. It does **not** run a scanner, contact target URLs, create accounts, store projects, or fabricate security findings.

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

## Responsible use

The scan form and project form are UI-only previews. They require an authorization confirmation for the interaction, but they do not send requests to the supplied URL. Do not use this repository to test systems you do not own or have explicit permission to assess.

## Contributing

1. Fork the repository.
2. Create a focused branch.
3. Make a change with no hardcoded customer, owner, review, scan or security metrics.
4. Open a pull request with a clear explanation.

Please use the public issue tracker for bugs and feature discussions:

<https://github.com/Vismay-dev1/Interactive-website/issues>
