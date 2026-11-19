# Test-Fixtures

Alle Dateien hier sind SYNTHETISCH – nach Format im Code gebaut (keine echten Nutzerdaten).

- `kindle-en.txt` – Kindle-`My Clippings.txt`, englisch; 2 Bücher, 1 doppelte Markierung, 1 überholte (Text ist Präfix einer längeren)
- `kindle-de-bom.txt` – deutsch („Hinzugefügt am“), beginnt mit BOM (U+FEFF)
- `kindle-crlf.txt` – wie `kindle-en.txt`, aber mit Windows-Zeilenenden (`\r\n`)
- `readwise-standard.csv` – Readwise-CSV-Export mit Standard-Kopfzeile; 2 Bücher, kommaseparierte Tags (mit Duplikat/Großschreibung), 1 ungültiges Datum, 1 Duplikat nach Whitespace-/Case-Normalisierung, 1 Zeile ohne Titel
- `readwise-header-variants.csv` – Readwise-CSV mit alternativen Header-Aliassen (`HIGHLIGHT_TEXT`, `Source Title`, `Annotation`, `Created-At`, …), Tags mit Semikolon
