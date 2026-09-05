# Third-Party Notices

Mercury Phone includes or derives production assets from the following third-party projects. The referenced license files are distributed with the production output.

## Iconoir

- Project: https://github.com/iconoir-icons/iconoir
- Copyright: Copyright (c) 2021 Luca Burgio
- License: MIT
- Local notice: `third-party/Iconoir-LICENSE.txt`

The SVG files under `assets/icons/iconoir/` are selected Iconoir assets.

## Cinema Fonts

The WOFF2 files listed below are modified versions produced by deterministic subsetting and webfont conversion. Source revisions, source/output SHA256 values, and acquisition URLs are pinned in `scripts/cinema-font-sources.json`; the approved Unicode ranges are pinned in `scripts/cinema-font-codepoints.json`; build dependencies are pinned in `requirements-cinema-fonts.txt`.

| Mercury role | Upstream family | Production asset | License notice |
| --- | --- | --- | --- |
| Chinese display | Zhuque Fangsong | `assets/fonts/cinema/cinema-zhuque-display.woff2` | `assets/fonts/cinema/Zhuque-LICENSE.txt` |
| Chinese reading | Noto Serif SC | `assets/fonts/cinema/cinema-noto-serif-reading.woff2` | `assets/fonts/cinema/NotoSerifSC-OFL.txt` |
| Chinese UI | Noto Sans SC | `assets/fonts/cinema/cinema-noto-sans-ui.woff2` | `assets/fonts/cinema/NotoSansSC-OFL.txt` |
| Chinese handwriting annotations | JasonHandwriting 8 | `assets/fonts/cinema/cinema-jason-handwriting-8.woff2` | `assets/fonts/cinema/JasonHandwriting8-OFL.txt` |
| English editorial script | Pinyon Script | `assets/fonts/cinema/PinyonScript-Regular.ttf` | `assets/fonts/cinema/Pinyon-OFL.txt` |

The JasonHandwriting 8 subset remains annotation-only. Its current subset is intentionally limited to approved/product text with whole-string fallback. Broader dynamic handwriting Unicode shards are deferred until dynamic annotation authoring requires them.
