"""Build the site's data bundle.

Three jobs:

1. Bundle every data/*.json file into js/data.js as `window.EPW`.
   The bundle exists so the site works when opened straight from disk.
   Browsers block fetch() on file:// URLs, so a colleague double-clicking
   index.html would otherwise see an empty page.

2. Put the confirmed speakers from data/speakers.json (hand-edited) on their
   programme sessions, in the bundle only. programme.json stays name-free, so
   each person is written down once and the speaker list and the agenda
   cannot drift apart. An unknown session id stops the build.

3. Stamp the CSS and JS links in index.html with a content hash, so a
   deploy never serves a new page against stale cached scripts.

Usage
-----
    python tools/build_data.py

Run it after editing anything in data/, css/ or js/main.js.

Speaker photos
--------------
A headshot at images/speakers/<slug>.webp (slug of the name without
"Prof."/"Dr.") is picked up automatically; a "photo" field overrides the
filename. Without a photo the speaker card shows initials.
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"
BUNDLE = REPO / "js" / "data.js"

SPEAKER_PHOTOS = REPO / "images" / "speakers"

HONORIFICS = re.compile(r"^(prof|dr|mr|ms|mrs)\.?\s+", re.I)


def slugify(name: str) -> str:
    ascii_name = (
        unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    )
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_name).strip("-").lower()
    return re.sub(r"-{2,}", "-", slug)


def item_components(programme: dict) -> dict:
    """Map each programme item id to its day, item and convening.

    Mirrors assignComponents() in main.js: a day's component applies to every
    item, unless the day switches part-way (Day 3 hands over after lunch).
    """
    found = {}
    for day in programme["days"]:
        current, switch = day["component"], day.get("componentSwitch")
        for item in day["items"]:
            if "id" in item:
                found[item["id"]] = (item, current)
            if switch and item.get("id") == switch["afterItem"]:
                current = switch["to"]
    return found


def attach_speakers(payload: dict) -> None:
    """Put each confirmed speaker on their sessions, and fill in card details."""
    items = item_components(payload["programme"])
    people = payload.get("speakers", {}).get("people", [])
    unknown = []

    for person in people:
        slug = slugify(HONORIFICS.sub("", person["name"]))
        person.setdefault("id", slug)
        if "photo" not in person:
            person["photo"] = f"{slug}.webp" if (SPEAKER_PHOTOS / f"{slug}.webp").exists() else ""

        person["appearances"] = []
        for s in person.get("sessions", []):
            if s["item"] not in items:
                unknown.append(f"{person['name']}: '{s['item']}'")
                continue
            item, component = items[s["item"]]
            item.setdefault("speakers", []).append({
                "name": person["name"],
                "title": person.get("title", ""),
                "org": person.get("org", ""),
                "role": s.get("role", ""),
            })
            item["speakersStatus"] = "partial"
            person["appearances"].append({"item": s["item"], "role": s.get("role", ""), "component": component})

    if unknown:
        print("! speakers.json names sessions that are not in programme.json:")
        for line in unknown:
            print(f"    - {line}")
        raise SystemExit(1)

    people.sort(key=lambda p: HONORIFICS.sub("", p["name"]).split()[-1].lower())
    with_photo = sum(1 for p in people if p["photo"])
    print(f"  speakers: {len(people)} on the site ({with_photo} with photos)")


def bundle() -> None:
    """Concatenate data/*.json into js/data.js as window.EPW."""
    payload = {}
    for path in sorted(DATA.glob("*.json")):
        with path.open(encoding="utf-8") as fh:
            payload[path.stem] = json.load(fh)
        print(f"  bundled data/{path.name}")
    attach_speakers(payload)

    BUNDLE.parent.mkdir(parents=True, exist_ok=True)
    with BUNDLE.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write("/* GENERATED FILE — do not edit.\n")
        fh.write("   Built from data/*.json by tools/build_data.py.\n")
        fh.write("   Edit the JSON in data/, then re-run: python tools/build_data.py\n")
        fh.write(f"   Built {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} */\n")
        fh.write("window.EPW = ")
        json.dump(payload, fh, ensure_ascii=False, indent=1)
        fh.write(";\n")

    size = BUNDLE.stat().st_size
    print(f"  wrote js/data.js ({size/1024:.0f} KB)")


def stamp_assets() -> None:
    """Version the CSS and JS links in index.html by content hash.

    Browsers cache these files, so after a deploy a visitor could get the new
    index.html with yesterday's main.js — the two disagree and parts of the
    page silently break. A hash in the URL changes only when the file does.
    """
    index = REPO / "index.html"
    html = index.read_text(encoding="utf-8")
    for rel in ("css/main.css", "js/data.js", "js/main.js", "js/thread.js"):
        digest = hashlib.sha1((REPO / rel).read_bytes()).hexdigest()[:8]
        html, n = re.subn(
            r'((?:href|src)=")' + re.escape(rel) + r'(?:\?v=[0-9a-f]+)?"',
            lambda m: f'{m.group(1)}{rel}?v={digest}"',
            html,
        )
        if n != 1:
            print(f"! expected one reference to {rel} in index.html, found {n}")
    with index.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write(html)
    print("  stamped asset versions in index.html")


def main() -> int:
    bundle()
    stamp_assets()
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
