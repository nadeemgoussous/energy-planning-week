"""Build the site's data bundle.

Four jobs:

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

4. Write the calendar files in calendar/ (one per session, one per day).

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

# Never shown on the page, so never sent to visitors.
INTERNAL_KEYS = {"_comment", "bioSource", "sourceDocument", "itemTypes"}

# Order people are listed in within a session.
ROLE_ORDER = ("master of ceremonies", "moderator", "welcome", "keynote", "scene-setting")

HONORIFICS = re.compile(r"^(?:(?:prof|dr|ir|mr|ms|mrs)\.\s+)+", re.I)


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

    # Alphabetical by name as shown, ignoring "Prof."/"Dr." and accents.
    people.sort(key=lambda p: slugify(HONORIFICS.sub("", p["name"])))
    with_photo = sum(1 for p in people if p["photo"])
    print(f"  speakers: {len(people)} on the site ({with_photo} with photos)")


def role_rank(person: dict) -> int:
    role = person["role"].lower()
    for rank, key in enumerate(ROLE_ORDER):
        if role.startswith(key):
            return rank
    return len(ROLE_ORDER) + (1 if role.startswith("closing") else 0)


def strip_internal(value):
    if isinstance(value, dict):
        return {k: strip_internal(v) for k, v in value.items() if k not in INTERNAL_KEYS}
    if isinstance(value, list):
        return [strip_internal(v) for v in value]
    return value


def make_small_images() -> None:
    """Write the display-size copies the page actually loads.

    speakers/thumbs/ (360 px square) serves every card and dialog; *-sm.webp
    are the narrow copies offered in srcset. Rewritten only when they change.
    """
    try:
        from PIL import Image
    except ImportError:
        print("! Pillow is not installed: thumbnails were not refreshed")
        return
    import io

    jobs = [(p, SPEAKER_PHOTOS / "thumbs" / p.name, 360) for p in SPEAKER_PHOTOS.glob("*.webp")]
    for folder, width in (("scene", 800), ("publications", 400)):
        jobs += [(p, p.with_name(p.stem + "-sm.webp"), width)
                 for p in (REPO / "images" / folder).glob("*.webp") if not p.stem.endswith("-sm")]
    (SPEAKER_PHOTOS / "thumbs").mkdir(exist_ok=True)
    wanted = {dst for _, dst, _ in jobs}
    for old in (SPEAKER_PHOTOS / "thumbs").glob("*.webp"):
        if old not in wanted:
            old.unlink()
    for src, dst, width in jobs:
        with Image.open(src) as im:
            im = im.convert("RGB")
            im.thumbnail((width, width * 4), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=76, method=6)
        if not dst.exists() or dst.read_bytes() != buf.getvalue():
            dst.write_bytes(buf.getvalue())
    print(f"  {len(jobs)} display-size images ready")


def bundle() -> None:
    """Concatenate data/*.json into js/data.js as window.EPW."""
    payload = {}
    for path in sorted(DATA.glob("*.json")):
        with path.open(encoding="utf-8") as fh:
            payload[path.stem] = json.load(fh)
        print(f"  bundled data/{path.name}")
    attach_speakers(payload)
    for day in payload["programme"]["days"]:
        for item in day["items"]:
            item.get("speakers", []).sort(key=role_rank)
    for person in payload["speakers"]["people"]:
        person.pop("sessions", None)  # "appearances" carries this in the bundle
    payload = strip_internal(payload)
    write_calendars(payload)

    BUNDLE.parent.mkdir(parents=True, exist_ok=True)
    with BUNDLE.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write("/* GENERATED FILE — do not edit.\n")
        fh.write("   Built from data/*.json by tools/build_data.py.\n")
        fh.write("   Edit the JSON in data/, then re-run: python tools/build_data.py\n")
        fh.write(f"   Built {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} */\n")
        fh.write("window.EPW = ")
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")

    size = BUNDLE.stat().st_size
    print(f"  wrote js/data.js ({size/1024:.0f} KB)")


def ics_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def ics_fold(line: str) -> str:
    """Lines may be 75 bytes at most; longer ones continue after a space."""
    parts, current, limit = [], "", 75
    for ch in line:
        if len((current + ch).encode("utf-8")) > limit:
            parts.append(current)
            current, limit = "", 74
        current += ch
    return "\r\n ".join(parts + [current])


def place(item: dict, venue: dict) -> str:
    """Where an item happens. Mirrors place() in main.js."""
    if item.get("location"):
        return item["location"]
    session = item["type"] not in ("break", "social") and not (item["type"] == "meal" and not item.get("summary"))
    room = item.get("room") or (venue.get("room") if session else "")
    return (room + ", " if room else "") + f"{venue['name']}, {venue['address']}"


def write_calendars(payload: dict) -> None:
    """Write calendar/<item id>.ics for every session, and calendar/<day id>.ics.

    Real files, not browser-made downloads: phones open them in the calendar
    app directly. Times are UTC, so every calendar converts them correctly.
    A file is rewritten only when its event changes.
    """
    for day in payload["programme"]["days"]:
        for item in day["items"]:
            flag = (item.get("change") or {}).get("flag")
            if flag not in (None, "moved", "retimed", "cancelled"):
                raise SystemExit(f"! unknown change flag '{flag}' on '{item['title']}'")
    folder = REPO / "calendar"
    folder.mkdir(exist_ok=True)
    site = "https://" + (REPO / "CNAME").read_text(encoding="utf-8").strip() + "/"
    venue = payload["event"]["venue"]
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    wanted = set()

    def vevent(day: dict, item: dict) -> list:
        def utc(clock: str) -> str:
            local = datetime.fromisoformat(f"{day['date']}T{clock}:00+01:00")
            return local.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

        title = (item["code"] + ": " if item.get("code") else "") + item["title"]
        change = item.get("change") or {}
        if change.get("flag") == "cancelled":
            title = "CANCELLED: " + title
        about = [change.get("note"), item.get("access"), item.get("summary"), item.get("note"),
                 f"Provisional programme, check for changes: {site}#{item['id']}"]
        return ["BEGIN:VEVENT",
                f"UID:{item['id']}@energyplanningweek.info",
                f"DTSTAMP:{now}",
                f"DTSTART:{utc(item['start'])}",
                f"DTEND:{utc(item['end'])}",
                "SUMMARY:" + ics_text("EPW 2026: " + title),
                "LOCATION:" + ics_text(place(item, venue)),
                "DESCRIPTION:" + ics_text("\n\n".join(t for t in about if t)),
                f"URL:{site}#{item['id']}",
                "END:VEVENT"]

    def write(name: str, events: list) -> None:
        lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Energy Planning Week 2026//EN",
                 "CALSCALE:GREGORIAN", "METHOD:PUBLISH", *events, "END:VCALENDAR"]
        data = "\r\n".join(ics_fold(line) for line in lines) + "\r\n"
        path = folder / f"{name}.ics"
        wanted.add(path)
        undated = lambda text: re.sub(r"DTSTAMP:\S+", "", text)
        if not path.exists() or undated(path.read_bytes().decode("utf-8")) != undated(data):
            path.write_bytes(data.encode("utf-8"))

    for day in payload["programme"]["days"]:
        # Same rule as hasDetail() in main.js
        items = [i for i in day["items"] if i.get("id") and
                 (i.get("summary") or i.get("note") or i.get("access") or i.get("speakers"))]
        for item in items:
            write(item["id"], vevent(day, item))
        # The day file leaves out what only some participants attend.
        write(day["id"], [line for i in items if i["type"] not in ("closed", "social") for line in vevent(day, i)])
    for old in folder.glob("*.ics"):
        if old not in wanted:
            old.unlink()
    print(f"  {len(wanted)} calendar files ready")


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
    make_small_images()
    bundle()
    stamp_assets()
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
