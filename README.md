# Energy Planning Week 2026 — participant portal

Static site for participants of Energy Planning Week 2026, 1–4 December 2026, Bonn.
Co-hosted by IRENA and GET.transform. Served by GitHub Pages; not indexed by search engines.

The date line is **1–4 December 2026** — confirmed, and it is the four-day event across all
materials. Earlier drafts that say 1–3 December or "three days" are superseded.

## How to change what the site says

All content lives in `data/*.json`. The HTML holds no copy at all — this is deliberate.
The 2025 portal kept every speaker and session in two places (the markup *and* a
JavaScript object), so the agenda and the speaker list drifted apart. Here there is
one copy of each fact.

```
data/event.json         dates, venue, hosts, registration and join links, contacts, the four parts of the week
data/about.json         About the Week — background, objectives, audience (from the agenda); hero photo
data/faq.json           frequently asked questions; links written as {label|url}
data/programme.json     days, sessions, times, summaries
data/practical.json     venue address, travel, meals, visas, documents
data/publications.json  LTES Network publications
data/gallery.json       photographs from the previous Forum, and their credit
data/speakers.json      GENERATED — do not edit by hand
```

After any edit, rebuild and commit:

```sh
python tools/build_data.py
```

That regenerates `js/data.js`, which is what the browser actually loads. **If you skip
this step your change will not appear on the site.** It also stamps the CSS and JS links
in `index.html` with a content hash (`?v=…`), so visitors never get a new page against
stale cached scripts — run it after editing `css/` or `js/main.js` too.

### Speakers

Speakers come from `06 Speakers/EPW2026_Speakers_Tracker.xlsx` in the project folder —
the same tracker the rest of the project uses. Only rows with `Status = Confirmed` are
published. To add a speaker: edit the tracker, then run `python tools/build_data.py`.

The tracker has no `Title`, `Bio` or `Photo` columns yet. Add them and the build picks
them up automatically; without them, speaker cards show name, organisation and role only.

Speaker names are currently **not** published anywhere on the site. The session data in
`programme.json` has empty `speakers` arrays by design.

### Images

Never commit camera-original photos. Run them through the optimiser first:

```sh
python tools/optimize_images.py speakers  "path/to/headshot/originals"
python tools/optimize_images.py covers    "path/to/cover/originals"
python tools/optimize_images.py scene     "path/to/room/photo/originals"
```

It resizes, crops headshots square, and writes a `.jpg` and a `.webp` for each file,
named from a slug of the original filename. The 2025 repo carried 33 MB of unoptimised
images — a single 5.7 MB headshot — which made the speakers page unusable on a weak
connection. This site is about 2.8 MB on disk, but a browser only ever fetches the
WebP half of each pair: roughly 1.2 MB for the whole page, of which the photographs
are 390 KB and load lazily, below the fold.

Keep originals outside the repo, or in `_originals/` which is git-ignored.

## Previewing locally

```sh
python -m http.server 8765
```

then open <http://127.0.0.1:8765/>. Opening `index.html` directly from the file system
also works, because the data is loaded as a plain script rather than by `fetch()`.

## Design notes

**Every colour and typeface comes from IRENA Brand Guidelines (April 2026)**, kept in
`12 Comms/`. Nothing here is an invented brand value — check that PDF before adding one.

| Colour | Guideline name | Meaning |
|---|---|---|
| `#0073ab` | IRENA Blue (primary) | 7th LTES Forum — scenarios and planning systems |
| `#00a3ca` | Turquoise Surf (accent) | GCEP Planning–Investment Dialogue — investment signals |
| `#f1d64b` | Royal Gold (accent) | Implementation Lab — delivery |
| `#575757` | IRENA Grey (primary) | Partner-hosted sessions (Day 4) — neutral while still TBC |
| `#012a3d` | Deep Space Blue (accent) | Body ink; the dark theme's ground |
| `#575757` | IRENA Grey (primary) | Secondary text |
| `#9f3620` | Geothermal (RE palette) | What is happening right now |

Blue → turquoise → gold is the planning value chain the whole event is built around, so
the week band and the programme rail read as one sequence rather than three colour
choices.

Two constraints follow from the guidelines and are easy to break by accident:

- **Accents are used sparingly and never as the dominant colour.** Turquoise and gold
  appear as segments, tags, rules and swatches. They never ground a page or a section.
- **An accent never becomes type.** Gold and turquoise are light; as small text on white
  they fall below readable contrast, and gold effectively vanishes. Coloured text is
  always IRENA Blue. Each accent has a paired `--*-ink` token for the text that sits *on*
  it — gold needs dark type where blue needs white. Add a colour, add its ink.

`#d62828` was previously used for "happening now" and is not an IRENA colour at all. It
is now Geothermal from the renewable-energy palette, which is at least in the brand, but
using an energy-source colour as a status colour is off-label — worth Communications
sign-off.

**The scenario thread** (`js/thread.js`) is the one decorative element. Five scenario
pathways leave a single origin in the hero, fan out, and sweep across the page at every
section boundary before converging on one point in the footer. The lines draw in as you
scroll, shading from IRENA Blue to Turquoise Surf, and the end point lights up in Royal
Gold. It is laid out from the live page, so new or hidden sections need no changes. It
only runs through the side gutters and the empty padding between sections, never under
text. With reduced motion it is drawn in full and does not move.

Typography is **Montserrat** throughout. The guidelines name Gotham as the primary online
face and Montserrat as its sanctioned substitute; ITC Avant Garde is print-only and must
never be used digitally. There is no approved monospace, so there is none here — times
and counters use `font-variant-numeric: tabular-nums` to stay aligned instead.

Light is the default for every visitor, including those whose OS is set to dark. The dark
palette is kept but opted into via `:root[data-theme="dark"]` and is not currently wired
to anything. **If it is ever switched on it needs the white IRENA logo**, per the logo
rules.

### Logos — still missing, and the biggest gap

`images/brand/` does not exist. `event.json` references `irena.svg` and
`get-transform.svg` that were never added, so the page currently carries neither host's
identity, which is most of why it reads as a generic template.

The guidelines are strict: only official logo files from Communications may be used, and
the logo must never be redrawn, recreated, recoloured or distorted. So these files have to
come from Comms — they cannot be approximated. When they arrive:

- minimum 118 px wide on screen;
- clear space on all sides of at least half the height of the capital "I" in IRENA;
- co-branding: IRENA must not be smaller than GET.transform, equal visual weight, never
  merged or combined;
- white version on dark grounds.

**The programme rail is drawn to scale, with two deliberate exceptions.** A block's
height is its real duration — which only stays true if blocks stay terse, so session
detail belongs in the modal, not in the rail. Adding a couple of lines to a rail block
will quietly make a 30-minute keynote look longer than an hour of registration.

The exceptions exist because a literal scale broke down on a real agenda. Sessions here
run from 15 minutes to 7 hours, a 28:1 range:

1. **A ceiling** (`--rail-max`, 13rem). Day 4's 7-hour placeholder drew a 630px block to
   hold one line of text. The cap bites only above about 2h20 — 3 of 29 items. Everything
   shorter is still drawn at exactly its duration.
2. **Breaks, meals and the dinner are not to scale** — they collapse to `--rail-min` and
   take a dotted rule instead of a solid one. Their height was pure void: the 3-hour
   welcome dinner drew 198px to hold two words. Their times are printed beside them,
   which is all a delegate needs. Only the programme itself is measured.

If you add a new item `type` that is logistics rather than programme, add it to the
compact list in the rail section of `main.css` alongside `break`, `meal` and `social`.

`--px-per-min` sets the scale itself: 1.1px, so an hour is 66px.

**The photographs are deliberately small.** The band between the programme and the
speakers is held to 42rem, well inside the page's own width. Shown large the pictures
become a feature and start competing with the programme rail; at this size they sit
under it as an aside, which is all they are for. It also keeps individual faces below
the size at which participants are identifiable.

They also carry a credit, and must. They are 2025 photographs on a 2026 event site,
and without the line naming the 6th Forum they read as pictures of the coming week.
`renderScene()` hides the whole band if the credit is missing rather than publish an
uncredited photograph.

The site derives its own phase from the programme dates: the opening date and time
before the event, a live now/next strip and a moving "now" line during it, a closing
message afterwards.
There is nothing to switch over on the day.

## Deployment

GitHub Pages from `main`, root. `CNAME` holds the custom domain.

## Still open

- Teams join link — `event.json` → `join.url` (GDPR: EU-hosted platforms only, no Zoom)
- Venue phone, map and travel directions — `practical.json` (address confirmed: GIZ Campus, Friedrich-Ebert-Allee 32 + 36, 53113 Bonn)
- Programme and logistical note PDFs — `practical.json` → `documents[].url`
- IRENA and GET.transform logos — `images/brand/`, referenced from `event.json`
- Favicon
