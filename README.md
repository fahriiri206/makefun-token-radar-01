# FIELDNOTE · token launch radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/fahriiri206/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/fahriiri206/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

FIELDNOTE is an original static dashboard for make.fun's **Build the best token launch radar** bounty. It reads the sealed DefiLlama snapshot (`758` protocols, `40` on the watchlist) and ranks `198` records that carry no token: all `40` watchlist names plus `158` early records below the floor. Each row carries a conservative implied launch value with the exact valuation walk, live peer comps, a risk register and a seven-step farm plan.

The estimate is derived, never fabricated: `TVL × clamp(median peer mcap/TVL, 0.05..4) × 0.60 haircut × growth × maturity × confidence`. A protocol with `gecko_id`, `symbol` and `mcap_usd` all null is described as **no token in the record**, not as a protocol that has none. The snapshot is static; the dashboard does not claim live yields, eligibility or prices.

**Our referral link: <https://make.fun/r/c1tn127a>** — we may receive referral rewards; this is an independent entry, not an official make.fun page.

## Run it

Node.js 22.18 or later, standard library only. No dependencies and no network at build or run time.

```sh
mkdir -p out
# inside the grader, the snapshot is mounted at /input
MAKEFUN_OUTPUT_DIR=out node main.ts
# outside it, point MAKEFUN_INPUT_DIR at the directory holding snapshot.json
MAKEFUN_INPUT_DIR=/path/to/snapshot-dir MAKEFUN_OUTPUT_DIR=out node main.ts
# or: node main.ts --input /path/to/snapshot.json --output out
```

By default `main.ts` reads `/input/snapshot.json`; `MAKEFUN_INPUT_DIR` (or `--input`) overrides it.

It writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. The dossier is written last with the unmodified `vendor/makefun-board.ts` library and the kit's caps: 65,536 text bytes, four screenshots at most 512 KiB each, dashboard at most 400 files and 4 MiB.

To preview the generated page locally, serve the output root (the page reads `../data.js` from beside `dashboard/`):

```sh
python3 -m http.server 18108 --directory out
# open http://127.0.0.1:18108/dashboard/
```

The server is only for local preview and screenshot capture. The page itself makes no network requests and contains no external addresses, fonts, analytics or remote images.

## What is in the entry

| Path | Purpose |
| --- | --- |
| `main.ts` | Node 22 entrypoint: read snapshot, build board, write data/dashboard/screenshots/dossier |
| `lib/radar.ts` | The valuation model, confidence, risk register, farm plan and board gate |
| `vendor/makefun-board.ts` | Kit library, byte for byte; builds `dossier.json` |
| `dashboard/index.html`, `app.css`, `app.js` | The offline FIELDNOTE page |
| `screenshots/1-board.jpg` | Actual browser capture: ranked board |
| `screenshots/2-detail.jpg` | Actual browser capture: protocol note and valuation walk |
| `screenshots/3-filtered.jpg` | Actual browser capture: watchlist/category filter |
| `screenshots/4-search.jpg` | Actual browser capture: search results with filter chips |
| `LICENSE` | MIT |

## Limits, stated honestly

- The model uses only the sealed snapshot's own fields. It has no live TVL, yield, points, contract or eligibility feed.
- The peer comp is a median of live-token protocols in the same category; if fewer than three exist it falls back to chain peers, then all live peers. A thin sample lowers confidence and is shown in the detail note.
- The `0.60` haircut, growth weight, maturity curve and confidence discounts are explicit model choices, not market facts. They are stated in the page and in `lib/radar.ts`.
- A null token record is not proof that no token exists. The watchlist is DefiLlama's floor, not a ceiling, and the board adds pre-token protocols below that floor.
- Farm plans are generic operational steps derived from category, chains, TVL and age. They are not financial advice and do not promise an airdrop or a return.
- The dashboard is a static three-file page. It reads `window.FIELDNOTE` from `data.js` and renders in the browser; there is no server-side component and no model call at runtime.

## Screenshots

The four images in `screenshots/` are actual headless Chromium captures of this page rendered from the generated `out/` data at 1440×900: the board, a protocol detail drawer, a filtered watchlist view and a search view. They are not mockups, generated art or hand-edited composites.

## License

MIT. See `LICENSE`.
