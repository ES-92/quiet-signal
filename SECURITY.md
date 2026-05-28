# Security Policy

Quiet Signal is a **local-first** app with **no backend**: your entries live only in your browser (IndexedDB) and never leave your device. There is no server, account system, or third-party data processing. Optional **PIN lock** and **AES-GCM vault encryption** protect entries at rest in the browser.

## Reporting a vulnerability

If you find a security issue (e.g. an XSS vector in rendered content, a flaw in the encryption/PIN handling, or an unsafe import path), please report it **privately** rather than opening a public issue:

- Email: **erik.schroeder.92@web.de**

Please include reproduction steps and the affected version. I'll acknowledge and respond as soon as I reasonably can. Coordinated disclosure is appreciated.

## Supported versions

This is a single-maintainer project; only the latest released version receives fixes.
