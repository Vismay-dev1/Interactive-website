BREACHAI OPEN-SOURCE WEBSITE
============================

This repository contains the BREACHAI frontend product experience: an open-source,
frontend-only website for an authorized AI web security testing platform.

The site does not run a security scanner, contact target URLs, create accounts, store
projects, or generate security findings. The scan and project forms are UI-only flows.
They require explicit authorization confirmation and do not send requests anywhere.

LIVE GITHUB DATA
----------------
The page reads public repository metadata from the GitHub API, including stars, forks,
open issues, watchers, repository timestamps, public issues and public contributors.
When GitHub data is unavailable, the interface shows a dash or unavailable state instead
of a fabricated value.

RUN LOCALLY
-----------
python3 -m http.server 4173 --bind 0.0.0.0

Then open http://localhost:4173. A network connection is required for live GitHub values.

RESPONSIBLE USE
---------------
Only assess systems you own or have explicit permission to test. This repository is not
an unrestricted offensive security tool.

CONTRIBUTE
----------
Fork the repository, make a focused change, and open a pull request. Do not add fake
customers, owners, reviews, scan counts or security metrics.
