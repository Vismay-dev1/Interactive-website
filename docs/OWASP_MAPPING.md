# Current check mapping

These mappings describe the current safe heuristics. They are not a claim that a finding is a confirmed vulnerability.

| Check | OWASP area | Output meaning |
|---|---|---|
| Direct HTML-writing sink | A03 Injection | Review whether untrusted data reaches the sink without contextual encoding. |
| Credential-like assignment | A02 Cryptographic Failures / A05 Security Misconfiguration | A secret-shaped assignment or sensitive path was observed; value is redacted. |
| Private-key header | A02 Cryptographic Failures | Private-key material appears in source; contents are not printed. |
| Command execution API | A03 Injection | Review data flow into the API; no command is executed by the scanner. |
| Plain HTTP reference | A02 Cryptographic Failures | A source reference uses plaintext HTTP and should be reviewed. |
| Missing CSP / frame protection | A05 Security Misconfiguration | The requested response did not expose a browser protection header. |
| Missing HSTS / content type / referrer / permissions policy | A05 Security Misconfiguration | The requested response did not expose a defense-in-depth header. |

The mapping and severity are deliberately conservative. A production engine should attach the originating rule id, evidence, validation state and confidence before classifying a finding as confirmed.
