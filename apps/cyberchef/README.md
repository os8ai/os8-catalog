# CyberChef

The "Cyber Swiss Army Knife" — a browser-based toolkit for encoding, encryption, compression, hashing, and data analysis. Used daily by security pros, CTF players, and anyone working with weird-format data.

## What it does

- **300+ operations** chained as a "recipe" pipeline. Drag, drop, pipe.
- **All client-side.** Your inputs never leave the browser.
- **Encoding/decoding** — Base64, URL, HTML entities, Unicode escapes, hex, binary.
- **Encryption** — AES, DES, RC4, RSA, etc.
- **Hashing** — MD5, SHA family, BLAKE, Keccak, etc.
- **Compression** — gzip, deflate, raw inflate.
- **Parsing** — JSON, XML, regex extraction, ASCII art.
- **Data analysis** — entropy, frequency, file type detection.

## Notes for OS8 users

- First install runs `npm ci && npm run build` — takes a couple of minutes (large dep graph; webpack production build).
- After install, the app is served as static files; zero outbound network at runtime.
- All processing happens in your browser. Inputs and outputs stay local.

## Source

[github.com/gchq/CyberChef](https://github.com/gchq/CyberChef) · License: **Apache-2.0** · Maintained by GCHQ as open source.
