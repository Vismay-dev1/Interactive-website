BREACHAI OPEN-SOURCE WEBSITE
============================

This repository contains the BREACHAI frontend product experience: an open-source,
frontend-only website for an authorized AI web security testing platform.

The site includes safe browser-based scans. Website mode makes one CORS request and
checks readable response headers only. GitHub repository mode reads public source blobs.
Files/folder mode scans selected text files locally. It does not execute target code,
crawl websites, exploit systems, create accounts, or store projects. Authorization is
required for every scan mode.

LIVE GITHUB DATA
----------------
The page reads public repository metadata from the GitHub API, including stars, forks,
open issues, watchers, repository timestamps, public issues and public contributors.
When GitHub data is unavailable, the interface shows a dash or unavailable state instead
of a fabricated value.

RUN LOCALLY
-----------
The real API and safe scan worker run with Node.js 20+:

npm start

Then open http://localhost:4173. The server exposes authorization-gated scan jobs,
status polling and development persistence in .data/store.json. A network connection
is required for live GitHub values and remote scans.

npm run check

RESPONSIBLE USE
---------------
Only assess systems you own or have explicit permission to test. This repository is not
an unrestricted offensive security tool.

CONTRIBUTE
----------
Fork the repository, make a focused change, and open a pull request. Do not add fake
customers, owners, reviews, scan counts or security metrics.
