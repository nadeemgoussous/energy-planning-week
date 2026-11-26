/* Energy Planning Week 2026 — participant portal
 *
 * The page is rendered from window.EPW, which is built from data/*.json by
 * tools/build_data.py. The markup holds no content, so dates, sessions and
 * speakers are stated in one place only.
 *
 * To change what the site says, edit data/*.json and re-run the build.
 */
(function () {
  "use strict";

  var D = window.EPW;
  if (!D) {
    document.documentElement.className = "";
    document.body.insertAdjacentHTML("afterbegin",
      '<p class="notice">Site data did not load. Run <code>python tools/build_data.py</code> to rebuild js/data.js.</p>');
    return;
  }

  var event = D.event, programme = D.programme,
      speakers = D.speakers, publications = D.publications, practical = D.practical,
      gallery = D.gallery, about = D.about, faq = D.faq;

  /* Bonn in December is CET (UTC+1) all week — no daylight-saving edge to handle,
     so a fixed offset gives every visitor the same, correct local-to-venue time. */
  var TZ_OFFSET = "+01:00";

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function el(id) { return document.getElementById(id); }

  // A speaker photo that fails to load is hidden (was an inline onerror, which the
  // Content-Security-Policy no longer allows).
  document.addEventListener("error", function (e) {
    var img = e.target;
    if (img && img.classList && img.classList.contains("speaker__photo")) img.style.visibility = "hidden";
  }, true);

  function toDate(day, time) { return new Date(day + "T" + time + ":00" + TZ_OFFSET); }

  function mins(time) {
    var p = time.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function duration(item) { return Math.max(mins(item.end) - mins(item.start), 5); }

  function fmtDuration(m) {
    if (m < 60) return m + " min";
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + " h " + r + " min" : h + " h";
  }

  function component(id) {
    for (var i = 0; i < event.components.length; i++) {
      if (event.components[i].id === id) return event.components[i];
    }
    return null;
  }

  function accentName(id) { return { "ltes-forum": "forum", "gcep-dialogue": "gcep", "implementation": "impl", "partner-sessions": "partner" }[id] || "forum"; }
  function accentVar(id) { return "var(--" + accentName(id) + ")"; }

  /* Each accent is emitted with the ink colour that sits on it: Royal Gold needs
     dark type where the Forum blue needs white. */
  function accentStyle(id) {
    var n = accentName(id);
    return "--accent:var(--" + n + ");--accent-ink:var(--" + n + "-ink)";
  }

  /* An item's component is the day's, unless the day switches part-way through
     (Day 3 hands over from the GCEP Dialogue to the Implementation Lab at lunch). */
  function assignComponents(day) {
    var current = day.component, switched = false;
    day.items.forEach(function (item) {
      item._component = current;
      if (!switched && day.componentSwitch && item.id === day.componentSwitch.afterItem) {
        current = day.componentSwitch.to;
        switched = true;
      }
    });
  }

  programme.days.forEach(assignComponents);

  function allItems() {
    var out = [];
    programme.days.forEach(function (day) {
      day.items.forEach(function (item) { out.push({ day: day, item: item }); });
    });
    return out;
  }

  /* ?now=2026-12-02T12:20 (Bonn time) shows the page as it will be then. */
  var preview = /[?&]now=(\d{4}-\d\d-\d\d)T(\d\d):(\d\d)/.exec(location.search.replace(/%3A/gi, ":"));
  var clockShift = preview ? toDate(preview[1], preview[2] + ":" + preview[3]) - Date.now() : 0;
  if (isNaN(clockShift)) { preview = null; clockShift = 0; }
  function nowDate() { return new Date(Date.now() + clockShift); }

  function bonnDate(now) { return new Date(now.getTime() + 3600000).toISOString().slice(0, 10); }
  function bonnTime(now) { return new Date(now.getTime() + 3600000).toISOString().slice(11, 16); }

  /* Anything with more to say than its title opens in the dialog, and has its
     own address: #<item id>. */
  function hasDetail(item) {
    return Boolean(item.id && (item.summary || item.note || item.access || (item.speakers && item.speakers.length)));
  }

  /* ---------- hero ---------- */

  function registerButton() {
    return '<a class="btn" href="' + esc(event.registration.url) + '" target="_blank" rel="noopener noreferrer">' +
      esc(event.registration.label) + "</a>";
  }

  function renderHero() {
    el("heroHosts").textContent = event.hostLine;

    var facts = [
      ["Dates", event.dates.display],
      ["Venue", event.venue.display, event.venue.mapUrl],
      ["Format", event.format.type]
    ];
    el("heroFacts").innerHTML = facts.map(function (f) {
      var value = f[2]
        ? '<a href="' + esc(f[2]) + '" target="_blank" rel="noopener">' + esc(f[1]) + "</a>"
        : esc(f[1]);
      var days = Math.round((Date.parse(event.dates.start) - Date.parse(bonnDate(nowDate()))) / 864e5);
      var note = f[0] === "Dates" && days > 0 ? '<span class="hero__count">' + (days === 1 ? "Opens tomorrow" : "Opens in " + days + " days") + "</span>" : "";
      return "<div><dt>" + esc(f[0]) + "</dt><dd>" + value + note + "</dd></div>";
    }).join("");

    if (event.registration && event.registration.url) {
      el("heroCta").hidden = false;
      el("heroCta").innerHTML = registerButton() +
        (event.registration.note ? '<span class="hero__cta-note">' + esc(event.registration.note) + "</span>" : "");
    }

    el("footerLine").textContent =
      event.name + ", " + event.hostLine.charAt(0).toLowerCase() + event.hostLine.slice(1) + ". " + event.dates.display + ", " + event.venue.display + ".";

    /* GET.transform asked for its standard description wherever the event is
       presented — it is how GIZ, which has no logo on the site, is credited. */
    el("footerHosts").textContent = event.hosts.filter(function (h) { return h.description; })
      .map(function (h) { return h.name + ": " + h.description; }).join(" ");
  }

  function picture(src, alt, cls, lazy) {
    var webp = src.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    return "<picture>" +
      '<source srcset="' + esc(webp.replace(/\.webp$/, "-sm.webp")) + " 800w, " + esc(webp) + ' 1467w"' +
        ' sizes="(min-width: 60rem) 30rem, 92vw" type="image/webp">' +
      '<img class="' + cls + '" src="' + esc(src) + '" alt="' + esc(alt) + '"' +
        (lazy ? ' loading="lazy"' : ' fetchpriority="high"') + ' decoding="async">' +
    "</picture>";
  }

  function renderHeroPhoto() {
    var ph = about && about.photo;
    if (!ph || !ph.image || !ph.credit) return;   // no credit, no photograph
    el("heroPhoto").innerHTML = picture(ph.image, ph.alt, "hero__img", false) +
      '<figcaption class="hero__credit">' + esc(ph.credit) + "</figcaption>";
    el("heroPhoto").hidden = false;
  }

  /* ---------- about ---------- */

  function renderAbout() {
    if (!about) { el("about").hidden = true; return; }
    el("aboutTitle").textContent = about.title;
    el("aboutLede").textContent = about.lede;
    el("aboutBody").innerHTML = about.background.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    el("aboutObjectives").innerHTML = about.objectives.map(function (o) { return "<li>" + esc(o) + "</li>"; }).join("");
    el("aboutAudience").textContent = about.audience;
  }

  /* ---------- themes ----------
     The four-stage chain, drawn as one sequence rather than four cards: the
     stages are steps of a single planning process. No session mapping: most
     sessions span several stages. */

  function renderThemes() {
    el("themeGrid").innerHTML = '<ol class="chain">' + event.narrative.stages.map(function (stage, i) {
      return '<li class="chain__step">' +
        '<span class="chain__node" aria-hidden="true">' + (i + 1) + "</span>" +
        '<h3 class="chain__title">' + esc(stage.label) + "</h3>" +
        '<p class="chain__text">' + esc(stage.summary || "") + "</p>" +
      "</li>";
    }).join("") + "</ol>";
  }

  /* ---------- FAQ ----------
     Answers may carry links written as {label|url}. */

  function linkify(text) {
    return esc(text).replace(/\{([^|}]+)\|([^}]+)\}/g, function (_, label, url) {
      var external = !/^mailto:/.test(url);
      return '<a href="' + url + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + label + "</a>";
    });
  }

  function renderFaq() {
    if (!faq || !faq.items || !faq.items.length) { el("faq").hidden = true; return; }
    el("faqList").innerHTML = faq.items.map(function (item) {
      return '<details class="faq__item">' +
        '<summary class="faq__q">' + esc(item.q) + "</summary>" +
        '<div class="faq__a"><p>' + linkify(item.a) + "</p></div>" +
      "</details>";
    }).join("");
  }

  /* ---------- the week band ----------
     Each day is a column; the spans within it are sized by the minutes each
     convening takes that day. Day 3 shows its split. */

  function daySegments(day) {
    var order = [], totals = {};
    day.items.forEach(function (item) {
      var c = item._component;
      if (!totals[c]) { totals[c] = 0; order.push(c); }
      totals[c] += duration(item);
    });
    return order.map(function (c) { return { component: c, minutes: totals[c] }; });
  }

  function renderWeekBand() {
    el("weekBand").innerHTML = programme.days.map(function (day) {
      var segments = daySegments(day);
      var spans = segments.map(function (seg) {
        var comp = component(seg.component);
        return '<span class="weekband__span" style="flex:' + seg.minutes + '"' +
          ' data-component="' + esc(seg.component) + '"' +
          (day.tbd ? ' data-tbd="true"' : "") + ">" +
          esc(comp ? comp.shortName : "") + "</span>";
      }).join("");

      return '<button class="weekband__day" type="button" data-day="' + esc(day.id) + '">' +
        '<span class="weekband__head">' +
          '<span class="weekband__dow">' + esc(day.weekday.slice(0, 3)) + " " + parseInt(day.date.slice(8), 10) + " Dec</span>" +
          (day.tbd ? "<span>Sessions TBC</span>" : "") +
        "</span>" +
        '<span class="weekband__body">' + spans + "</span>" +
      "</button>";
    }).join("");

    el("weekBand").addEventListener("click", function (e) {
      var btn = e.target.closest(".weekband__day");
      if (btn) { selectDay(btn.dataset.day); el("programme").scrollIntoView({ block: "start" }); }
    });

    el("componentLegend").innerHTML = event.components.map(function (c, i) {
      var tipId = "legend-tip-" + i;
      return '<li style="--accent:' + accentVar(c.id) + '">' +
        '<button class="legend__item" type="button" aria-describedby="' + tipId + '">' +
          '<span class="legend__swatch" style="background:' + accentVar(c.id) + '"></span>' +
          "<span><span class='legend__name'>" + esc(c.name) + "</span> " +
          "<span class='legend__when'>" + esc(c.days) + "</span></span>" +
        "</button>" +
        '<span class="legend__tip" role="tooltip" id="' + tipId + '">' + esc(c.summary) + "</span>" +
      "</li>";
    }).join("");
  }

  /* ---------- programme ---------- */

  var selectedDay = (programme.days.filter(function (d) { return d.date === bonnDate(nowDate()); })[0] || programme.days[0]).id;

  function renderDayTabs() {
    el("dayTabs").innerHTML = programme.days.map(function (day) {
      return '<button class="daytabs__btn" role="tab" type="button"' +
        ' id="tab-' + esc(day.id) + '" data-day="' + esc(day.id) + '"' +
        ' style="' + accentStyle(day.component) + '"' +
        ' aria-controls="rail" aria-selected="' + (day.id === selectedDay) + '"' +
        ' tabindex="' + (day.id === selectedDay ? 0 : -1) + '">' +
        '<span class="daytabs__day">' + esc(day.label) + "</span>" +
        '<span class="daytabs__date">' + esc(day.weekday) + " " + parseInt(day.date.slice(8), 10) + " Dec</span>" +
      "</button>";
    }).join("");

    el("dayTabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".daytabs__btn");
      if (btn) selectDay(btn.dataset.day);
    });
    el("dayTabs").addEventListener("keydown", function (e) {
      var tabs = Array.prototype.slice.call(this.children), at = tabs.indexOf(document.activeElement);
      var to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (at < 0 || to === undefined) return;
      e.preventDefault();
      var tab = tabs[(to + tabs.length) % tabs.length];
      selectDay(tab.dataset.day);
      tab.focus();
    });
  }

  function selectDay(id) {
    selectedDay = id;
    Array.prototype.forEach.call(el("dayTabs").children, function (btn) {
      btn.setAttribute("aria-selected", String(btn.dataset.day === id));
      btn.tabIndex = btn.dataset.day === id ? 0 : -1;
    });
    renderRail();
  }

  function who(item) {
    var mods = [], rest = [];
    (item.speakers || []).forEach(function (p) {
      (/^moderator/i.test(p.role) ? mods : rest).push(p.name);
    });
    function line(label, names) {
      return names.length ? '<span class="rail__who"><b>' + label + "</b> " + names.map(function (n) { return "<span>" + esc(n) + "</span>"; }).join(", ") + "</span>" : "";
    }
    return line(mods.length > 1 ? "Moderators" : "Moderator", mods) +
      line(rest.length > 1 ? "Speakers" : "Speaker", rest);
  }

  function renderRail() {
    var day = programme.days.filter(function (d) { return d.id === selectedDay; })[0];
    var comp = component(day.component);

    /* A day with parts (Day 3: GCEP Dialogue in the morning, Implementation Lab
       in the afternoon) carries its convening on each part's heading instead
       of on the day title, as the agenda does. */
    var parts = day.parts || [];
    var head =
      '<div class="rail__daytitle" style="' + accentStyle(day.component) + '">' +
        (parts.length ? "" : '<span class="rail__component">' + esc(comp ? comp.shortName : day.label) + "</span>") +
        '<span class="rail__theme">' + esc(day.theme) + "</span>" +
        (day.venue ? '<span class="rail__venue">Venue: ' + esc(day.venue) + "</span>" : "") +
      "</div>" +
      (day.intro ? '<p class="rail__intro">' + esc(day.intro) + "</p>" : "") +
      (day.tbd ? '<p class="notice">' + esc(day.tbdNote) + "</p>" : "");

    var partIndex = 0, lastComponent = null;
    function partHeading(item) {
      if (!parts.length || item._component === lastComponent) return "";
      lastComponent = item._component;
      var c = component(item._component);
      return '<div class="rail__part" style="' + accentStyle(item._component) + '">' +
        '<span class="rail__part-when">' + esc(parts[partIndex++] || "") + "</span>" +
        '<span class="rail__component">' + esc(c ? c.shortName : "") + "</span>" +
        '<span class="rail__part-name">' + esc(c ? c.name : "") + "</span>" +
      "</div>";
    }

    /* Blocks carry time, title and who is speaking; the description, roles and
       bios are in the modal. */
    var items = day.items.map(function (item, index) {
      var accent = accentStyle(item._component);
      var detailed = hasDetail(item);
      var tag = document.createElement(detailed ? "button" : "article");

      tag.className = "rail__item";
      tag.setAttribute("data-kind", item.type);
      tag.setAttribute("data-index", String(index));
      if (!detailed) tag.setAttribute("data-plain", "true");
      tag.style.cssText = "--minutes:" + duration(item) + ";" + accent;
      if (detailed) { tag.type = "button"; tag.setAttribute("data-open", item.id); }

      tag.innerHTML =
        '<span class="rail__time">' +
          '<span class="rail__start">' + esc(item.start) + "–" + esc(item.end) + "</span>" +
          '<span class="rail__dur">' + esc(fmtDuration(duration(item))) + "</span>" +
        "</span>" +
        '<span class="rail__body">' +
          (item.code ? '<span class="rail__code">' + esc(item.code) + "</span>" : "") +
          '<span class="rail__title">' + esc(item.title) + "</span>" +
          (item.subtitle ? '<span class="rail__subtitle">' + esc(item.subtitle) + "</span>" : "") +
          (item.partner ? '<span class="rail__partner">' + esc(item.partner) + "</span>" : "") +
          (item.access ? '<span class="rail__tag" data-tone="closed">' + esc(item.access) + "</span>" : "") +
          changeTag(item) +
          who(item) +
          (item.note ? '<span class="rail__note">' + esc(item.note) + "</span>" : "") +
          (detailed ? '<span class="rail__more">View details</span>' : "") +
        "</span>";

      return partHeading(item) + '<div class="rail__row">' + tag.outerHTML + (detailed ? starButton(item) : "") + "</div>";
    }).join("");

    el("rail").innerHTML = head + items;
    el("rail").setAttribute("aria-labelledby", "tab-" + day.id);
    el("dayTools").innerHTML =
      '<a class="tool" href="calendar/' + esc(day.id) + '.ics">Add ' + esc(day.label) + " to calendar</a>" +
      '<button class="tool" type="button" data-print>Print programme</button>';
    el("rail").style.setProperty("--accent", accentVar(day.component));
    el("rail").style.setProperty("--accent-ink", "var(--" + accentName(day.component) + "-ink)");
    markNow();
  }

  el("rail").addEventListener("click", function (e) {
    var btn = e.target.closest(".rail__item[data-open]");
    if (btn) openSession(btn.dataset.open);
  });
  el("dayTools").addEventListener("click", function (e) {
    if (e.target.closest("[data-print]")) window.print();
  });

  /* ---------- Today, My day and the tab bar ----------
     While the Week is running the page works as four screens: Today, Programme,
     My day and Venue. Before and after, it is one long page ("home") and only
     My day is a screen of its own. */

  var STAR = '<svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20"><path d="M10 1.9l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"/></svg>';
  var stars = {};
  try { JSON.parse(localStorage.getItem("epw.stars") || "[]").forEach(function (id) { stars[id] = true; }); } catch (e) { /* kept in memory */ }

  function toggleStar(id) {
    if (stars[id]) delete stars[id]; else stars[id] = true;
    try { localStorage.setItem("epw.stars", JSON.stringify(Object.keys(stars))); } catch (e) { /* kept in memory */ }
    Array.prototype.forEach.call(document.querySelectorAll("[data-star]"), function (b) {
      if (b.dataset.star === id) paintStar(b);
    });
    renderToday();
    renderMyDay();
  }
  function paintStar(btn) {
    var on = Boolean(stars[btn.dataset.star]);
    btn.setAttribute("aria-pressed", String(on));
    var label = btn.querySelector("[data-star-label]");
    if (label) label.textContent = on ? "In My day" : "Add to My day";
  }
  function starButton(item) {
    return '<button type="button" class="star" data-star="' + esc(item.id) + '" aria-pressed="' + Boolean(stars[item.id]) +
      '" aria-label="My day: ' + esc(fullTitle(item)) + '">' + STAR + "</button>";
  }

  function fullTitle(item) { return (item.code ? item.code + ": " : "") + item.title; }
  function cancelled(item) { return Boolean(item.change && item.change.flag === "cancelled"); }

  function changeTag(item) {
    if (!item.change) return "";
    var label = { moved: "Room changed", retimed: "Time changed", cancelled: "Cancelled" }[item.change.flag] || "Changed";
    return '<span class="change"><b>' + label + "</b>" + (item.change.note ? " " + esc(item.change.note) : "") + "</span>";
  }

  function isSession(item) {
    return item.type !== "break" && item.type !== "social" && !(item.type === "meal" && !item.summary);
  }
  /* Mirrors place() in tools/build_data.py */
  function place(item) {
    return item.location || (item.room || (isSession(item) ? event.venue.room : "")) || event.venue.name;
  }

  function phase(now) {
    var b = eventBounds();
    return now < b.start ? "before" : now < b.end ? "during" : "after";
  }

  function minsUntil(then, now) { return Math.max(1, Math.ceil((then - now) / 60000)); }

  /* Replaces content only when it changed, and gives focus back to the same control. */
  function fill(node, html) {
    if (node._html === html) return;
    var a = document.activeElement, key = a && node.contains(a) && a.dataset.key;
    node._html = html;
    node.innerHTML = html;
    if (key) { var again = node.querySelector('[data-key="' + key + '"]'); if (again) again.focus(); }
  }

  function nowCard(item, label, state) {
    var join = item.join || event.join.url, online = isSession(item) && item.type !== "closed";
    var canJoin = online && /^https:/.test(join || "");
    return '<article class="now" data-zone="now" data-state="' + state + '">' +
      '<p class="now__label">' + esc(label) + "</p>" +
      '<h2 class="now__title">' + esc(fullTitle(item)) + "</h2>" +
      changeTag(item) +
      '<p class="now__meta">' + esc(item.start + "–" + item.end) + ', <span data-field="room">' + esc(place(item)) + "</span></p>" +
      (item.access ? "<p>" + esc(item.access) + "</p>" : "") +
      (item.note && item.note !== item.location ? "<p>" + esc(item.note) + "</p>" : "") +
      who(item) +
      '<p class="now__links">' +
        (canJoin && state === "live" ? '<a data-action="join" data-key="join" href="' + esc(join) + '" target="_blank" rel="noopener noreferrer">Join online</a>' : "") +
        (hasDetail(item) ? '<a data-key="details" href="#' + esc(item.id) + '">View details</a>' : "") + "</p>" +
    "</article>";
  }

  function myRows(day, items, now) {
    var html = "";
    items.forEach(function (item, i) {
      var prev = items[i - 1];
      var gap = prev ? mins(item.start) - mins(prev.end) : 0;
      if (gap >= 20) html += '<li class="mine__gap">' + esc(fmtDuration(gap)) + " between</li>";
      var s = toDate(day.date, item.start), e = toDate(day.date, item.end);
      var state = cancelled(item) ? "" : now >= e ? "done" : now >= s ? "now" : "";
      html += '<li class="mine"' + (state ? ' data-state="' + state + '"' : "") + ">" +
        '<a class="line" data-key="mine-' + esc(item.id) + '" href="#' + esc(item.id) + '">' +
          '<span class="line__time">' + esc(item.start) + '</span><span class="line__body"><span class="line__title">' + esc(fullTitle(item)) + "</span>" +
          '<span class="line__place">' + (state === "now" ? "On now, " : "") + esc(place(item)) + "</span></span></a>" + changeTag(item) +
        starButton(item) + "</li>";
    });
    return html;
  }

  function starred(day) {
    return day.items.filter(function (i) { return i.id && stars[i.id] && hasDetail(i); });
  }

  function renderToday() {
    var now = nowDate(), box = el("todayBody");
    if (phase(now) !== "during") { fill(box, ""); return; }
    var today = programme.days.filter(function (d) { return d.date === bonnDate(now); })[0];
    var at = programme.days.indexOf(today);
    var live = today.items.filter(function (i) { return !cancelled(i); });
    var current = null, later = [];
    live.forEach(function (i) {
      var s = toDate(today.date, i.start), e = toDate(today.date, i.end);
      if (now >= s && now < e) current = i;
      else if (s > now) later.push(i);
    });

    var card, spoken;
    if (current) {
      card = nowCard(current, "Now, " + fmtDuration(minsUntil(toDate(today.date, current.end), now)) + " left", "live");
      spoken = "On now: " + fullTitle(current);
    } else if (later.length) {
      var up = later.shift();
      card = nowCard(up, "Starts in " + fmtDuration(minsUntil(toDate(today.date, up.start), now)), "between");
      spoken = "Up next: " + fullTitle(up);
    } else {
      var next = programme.days[at + 1];
      var first = next && next.items.filter(function (i) { return !cancelled(i) && i.type !== "break" && i.type !== "closed"; })[0];
      var early = next && next.items[0].type === "break" ? ", coffee from " + next.items[0].start : "";
      card = first ? nowCard(first, "Tomorrow, " + next.weekday + early, "end-of-day") : "";
      spoken = "No more sessions today";
    }
    var rows = later.filter(function (i) { return i.type !== "break"; }).slice(0, 3).map(function (i) {
      var m = minsUntil(toDate(today.date, i.start), now);
      var inner = '<span class="line__time">' + esc(i.start) + '</span><span class="line__body"><span class="line__title">' + esc(fullTitle(i)) + "</span>" +
        '<span class="line__place">' + esc(place(i)) + (m <= 120 ? ", in " + esc(fmtDuration(m)) : "") + "</span></span>";
      return "<li>" + (hasDetail(i) ? '<a class="line" data-key="next-' + esc(i.id) + '" href="#' + esc(i.id) + '">' + inner + "</a>" : '<span class="line">' + inner + "</span>") + changeTag(i) + "</li>";
    }).join("");
    var dropped = today.items.filter(cancelled).map(function (i) { return "<li>" + esc(i.start + " " + fullTitle(i)) + changeTag(i) + "</li>"; }).join("");
    var mine = starred(today);

    var spot = current && place(current) !== event.venue.name ? place(current) : event.venue.room;
    fill(box,
      '<header class="today__head today__head--day"><h1>' + esc(today.weekday + " " + parseInt(today.date.slice(8), 10)) + " December</h1>" +
        "<span>" + esc(today.label) + " of " + programme.days.length + "</span><span>" + bonnTime(now) + " in Bonn</span></header>" +
      '<div class="today__grid"><div>' + card +
        (dropped ? '<h2 class="subhead">Changes today</h2><ul class="lines">' + dropped + "</ul>" : "") +
        (rows ? '<h2 class="subhead">Later today</h2><ul class="lines" data-zone="next">' + rows + "</ul>" : "") +
      '</div><div><h2 class="subhead">My day</h2><div data-zone="my-day">' +
        (mine.length ? '<ul class="lines">' + myRows(today, mine, now) + "</ul>"
          : '<p class="today__empty">Star sessions in the <a data-key="prog" href="#programme">programme</a> and they appear here.</p>') + "</div>" +
        '<h2 class="subhead">Venue</h2><p class="today__venue" data-zone="venue">' +
          (current && current.location ? esc(current.location)
            : esc(spot) + "<br>" + esc(event.venue.name) + "<br>" + esc(event.venue.address) +
              '<br><a data-key="map" href="' + esc(event.venue.mapUrl) + '" target="_blank" rel="noopener">Open map</a>') + "</p>" +
      "</div></div>");
    if (el("todayLive").textContent !== spoken) el("todayLive").textContent = spoken;
  }

  function renderMyDay() {
    var now = nowDate();
    var html = programme.days.map(function (day) {
      var items = starred(day);
      return items.length ? '<h2 class="subhead">' + esc(day.label + ", " + day.weekday + " " + parseInt(day.date.slice(8), 10) + " December") +
        '</h2><ul class="lines">' + myRows(day, items, now) + "</ul>" : "";
    }).join("");
    fill(el("myDayBody"), html ||
      '<p class="today__empty">Nothing starred yet. Select the star beside a session in the <a data-key="prog" href="#programme">programme</a> and it appears here.</p>');
  }

  var view = "", viewHash = "";
  var SCREENS = {
    today: ["today"], "my-day": ["my-day"], programme: ["programme", "speakers"],
    venue: ["practical", "join", "resources", "faq"]
  };

  function showView(name) {
    if (name === view) return false;
    view = name;
    document.documentElement.setAttribute("data-view", name);
    Array.prototype.forEach.call(document.querySelectorAll("main > section"), function (s) {
      var on = SCREENS[name] ? SCREENS[name].indexOf(s.id) >= 0 : s.id !== "today" && s.id !== "my-day";
      s.toggleAttribute("data-off", !on);
    });
    markTabs(name);
    window.dispatchEvent(new Event("resize"));   // the decorative line and the now marker re-measure
    return true;
  }

  function markTabs(name) {
    var running = phase(nowDate()) === "during";
    Array.prototype.forEach.call(document.querySelectorAll("[data-tab]"), function (a) {
      var on = a.dataset.tab === name || (a.dataset.tab === "today" && name === "home" && !running);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  /* The address after # is a section or a session. */
  function route() {
    var id = location.hash.slice(1), running = phase(nowDate()) === "during", hit = id && findItem(id);
    if (hit && hasDetail(hit.item)) {
      if (!view) { viewHash = running ? "programme" : ""; showView(running ? "programme" : "home"); }
      if (view === "programme" || view === "home") {
        if (selectedDay !== hit.day.id) selectDay(hit.day.id);
        var block = el("rail").querySelector('[data-open="' + hit.item.id + '"]');
        if (block) block.scrollIntoView({ block: "center", behavior: "instant" });
      }
      openSession(id);
      return;
    }
    var toTop = id === "" || id === "top" || id === "today", wanted = "home";
    var target = id === "venue" ? el("practical") : toTop ? null : document.getElementById(id);
    if (id === "my-day") wanted = "my-day";
    else if (running) {
      if (id === "venue") wanted = "venue";
      else if (toTop) wanted = "today";
      else Object.keys(SCREENS).forEach(function (k) { if (SCREENS[k].indexOf(id) >= 0) wanted = k; });
    }
    var first = !view, changed = showView(wanted);
    viewHash = id;
    if (wanted !== "home" && (toTop || SCREENS[wanted][0] === id || id === "venue")) window.scrollTo({ top: 0, behavior: "instant" });
    else if (target) target.scrollIntoView({ behavior: changed ? "instant" : "auto" });
    else if (!first) window.scrollTo({ top: 0, behavior: changed ? "instant" : "auto" });
  }

  function initApp() {
    document.addEventListener("click", function (e) {
      var star = e.target.closest("[data-star]");
      if (star) { toggleStar(star.dataset.star); return; }
      /* Sessions open over the screen they were opened from. */
      var link = e.target.closest('#todayBody a[href^="#"], #myDayBody a[href^="#"], #statusStrip a[href^="#"]');
      if (link && findItem(link.getAttribute("href").slice(1))) {
        e.preventDefault();
        openSession(link.getAttribute("href").slice(1));
      }
    });
    var tick = function () {
      var p = phase(nowDate()), was = document.documentElement.getAttribute("data-phase");
      if (was !== p) {
        document.documentElement.setAttribute("data-phase", p);
        el("tabToday").textContent = p === "during" ? "Today" : "Home";
        if (was) { view = ""; route(); }   // the Week starts or ends while the page is open
      }
      renderStatus(); renderToday(); renderMyDay(); markNow();
    };
    tick();
    route();
    setInterval(tick, 20000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });
    window.addEventListener("focus", tick);
    window.addEventListener("hashchange", function () { if (modal.open) modal.close(); route(); });
    if (preview) {
      el("previewNote").hidden = false;
      el("previewNote").textContent = "Preview: clock set to " + preview[1] + " " + preview[2] + ":" + preview[3] + " in Bonn";
    }
  }

  /* ---------- session detail ---------- */

  var modal = el("sessionModal");

  function showModal() {
    if (!modal.open) {
      if (typeof modal.showModal === "function") modal.showModal();
      else modal.setAttribute("open", "");
    }
    el("modalBody").scrollTop = 0;
    el("modalClose").focus({ preventScroll: true });
  }

  function setHash(id) {
    try { history.replaceState(null, "", id || viewHash ? "#" + (id || viewHash) : location.pathname + location.search); } catch (e) { /* file:// */ }
  }

  function pageUrl() { return location.href.split(/[?#]/)[0]; }

  function googleUrl(day, item) {
    function utc(time) { return toDate(day.date, time).toISOString().replace(/[-:]|\.\d+/g, ""); }
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent("EPW 2026: " + (item.code ? item.code + " - " : "") + item.title) +
      "&dates=" + utc(item.start) + "/" + utc(item.end) +
      "&location=" + encodeURIComponent(item.location || (place(item) === event.venue.name ? "" : place(item) + ", ") + event.venue.name + ", " + event.venue.address) +
      "&details=" + encodeURIComponent("Provisional programme, check for changes: " + pageUrl() + "#" + item.id);
  }

  function openSession(id) {
    var hit = findItem(id);
    if (!hit || !hasDetail(hit.item)) return false;
    var day = hit.day, item = hit.item;
    var comp = component(item._component);

    /* Each speaker shows a headshot and, when they are on the speaker list,
       opens their bio (with a way back to this session). */
    var people = (item.speakers || []).map(function (p) {
      var pi = personIndex(p.name);
      var person = pi >= 0 ? speakers.people[pi] : null;
      var photo = person && person.photo;
      var inner =
        (photo
          ? '<img class="modal__person-photo" decoding="async" src="images/speakers/thumbs/' + esc(photo) + '" alt="" loading="lazy">'
          : '<span class="modal__person-photo speaker__initials" aria-hidden="true">' + esc(initials(p.name)) + "</span>") +
        '<span class="modal__person-text">' +
          (p.role ? '<span class="modal__person-role">' + esc(p.role) + (p.provisional ? " · to be confirmed" : "") + "</span>" : "") +
          '<span class="modal__person-name">' + esc(p.name) + "</span>" +
          (p.title ? '<span class="modal__person-org">' + esc(p.title) + "</span>" : "") +
          (p.org ? '<span class="modal__person-org">' + esc(p.org) + "</span>" : "") +
        "</span>";
      return "<li>" + (pi >= 0
        ? '<button type="button" class="modal__person" data-person="' + pi + '" data-from="' + esc(id) + '">' + inner + "</button>"
        : '<div class="modal__person">' + inner + "</div>") + "</li>";
    }).join("");

    el("modalBody").innerHTML =
      '<div style="' + accentStyle(item._component) + '">' +
        '<p class="modal__eyebrow">' + esc(comp ? comp.shortName : "") + (item.code ? " · " + esc(item.code) : "") + "</p>" +
        '<h2 class="modal__title" id="modalTitle">' + esc(item.title) + "</h2>" +
        '<p class="modal__meta">' + esc(day.weekday) + " " + parseInt(day.date.slice(8), 10) + " December · " +
          esc(item.start) + "–" + esc(item.end) + " " + esc(event.dates.timezoneLabel) +
          " · " + esc(fmtDuration(duration(item))) + " · " + esc(place(item)) +
          (item.partner ? " · " + esc(item.partner) : "") + "</p>" +
        changeTag(item) +
        '<div class="modal__actions">' +
          '<button class="tool tool--star" type="button" data-star="' + esc(item.id) + '" aria-pressed="' + Boolean(stars[item.id]) + '">' + STAR +
            "<span data-star-label>" + (stars[item.id] ? "In My day" : "Add to My day") + "</span></button>" +
          '<a class="tool" href="calendar/' + esc(item.id) + '.ics">Add to calendar</a>' +
          '<a class="tool" href="' + esc(googleUrl(day, item)) + '" target="_blank" rel="noopener noreferrer">Google Calendar</a>' +
          '<button class="tool" type="button" data-copy="' + esc(item.id) + '"><span aria-live="polite">Copy link</span></button>' +
        "</div>" +
        (item.access ? '<p class="modal__summary"><strong>' + esc(item.access) + "</strong></p>" : "") +
        (item.summary ? '<p class="modal__summary">' + esc(item.summary) + "</p>" : "") +
        (item.note ? '<p class="modal__summary" style="margin-top:.9rem;font-style:italic">' + esc(item.note) + "</p>" : "") +
        (people
          ? '<div class="modal__section"><p class="modal__label">Speakers</p><ul class="modal__people">' + people + "</ul></div>"
          : "") +
      "</div>";

    setHash(item.id);
    showModal();
    return true;
  }

  function copyLink(btn) {
    var url = pageUrl() + "#" + btn.dataset.copy, label = btn.firstChild;
    function done(text) {
      label.textContent = text;
      setTimeout(function () { label.textContent = "Copy link"; }, 2000);
    }
    function fallback() {
      var box = document.createElement("textarea");
      box.value = url;
      btn.parentNode.appendChild(box);   // inside the dialog: the rest of the page is inert
      box.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { /* reported below */ }
      box.remove();
      btn.focus();
      done(ok ? "Copied" : "Copy the address bar");
    }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { done("Copied"); }, fallback);
    else fallback();
  }

  el("modalClose").addEventListener("click", function () { modal.close(); });
  modal.addEventListener("close", function () { setHash(""); });
  modal.addEventListener("click", function (e) {
    if (e.target === modal) { modal.close(); return; }
    var person = e.target.closest(".modal__person[data-person]");
    if (person) { openSpeaker(parseInt(person.dataset.person, 10), person.dataset.from); return; }
    var back = e.target.closest("[data-back]");
    if (back) { openSession(back.dataset.back); return; }
    var session = e.target.closest("[data-session]");
    if (session) { openSession(session.dataset.session); return; }
    var copy = e.target.closest("[data-copy]");
    if (copy) copyLink(copy);
  });

  function personIndex(name) {
    var list = speakers.people || [];
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return i;
    return -1;
  }

  /* ---------- now / next ---------- */

  function eventBounds() {
    var first = programme.days[0], last = programme.days[programme.days.length - 1];
    return {
      start: toDate(first.date, first.items[0].start),
      end: toDate(last.date, last.items[last.items.length - 1].end)
    };
  }

  function findNow(now) {
    var entries = allItems(), current = null, next = null;
    for (var i = 0; i < entries.length; i++) {
      if (cancelled(entries[i].item)) continue;
      var s = toDate(entries[i].day.date, entries[i].item.start);
      var e = toDate(entries[i].day.date, entries[i].item.end);
      if (now >= s && now < e) current = entries[i];
      if (!next && s > now) next = entries[i];
    }
    return { current: current, next: next };
  }

  function markNow() {
    var now = nowDate();
    var day = programme.days.filter(function (d) { return d.id === selectedDay; })[0];
    var rail = el("rail");
    var old = rail.querySelector(".rail__now");
    if (old) old.remove();
    Array.prototype.forEach.call(rail.querySelectorAll(".rail__item"), function (n) { n.removeAttribute("data-now"); });

    day.items.forEach(function (item, index) {
      if (cancelled(item)) return;
      var s = toDate(day.date, item.start), e = toDate(day.date, item.end);
      if (now < s || now >= e) return;
      var node = rail.querySelector('.rail__item[data-index="' + index + '"]');
      if (!node) return;
      node.setAttribute("data-now", "true");
      var share = (now - s) / (e - s);
      var line = document.createElement("div");
      line.className = "rail__now";
      line.style.top = (node.parentNode.offsetTop + node.offsetHeight * share) + "px";
      rail.appendChild(line);
    });
  }

  function renderStatus() {
    var strip = el("statusStrip"), now = nowDate(), bounds = eventBounds();

    var live = now >= bounds.start && now <= bounds.end;
    strip.hidden = now < bounds.start;
    document.documentElement.toggleAttribute("data-strip", !strip.hidden);
    strip.toggleAttribute("data-live", live);
    var html = "";

    if (live) {
      var state = findNow(now);
      var line = function (label, entry, when) {
        var text = '<span class="status-strip__label">' + label + "</span>" +
          '<span class="status-strip__value">' + when + esc((entry.item.code ? entry.item.code + ": " : "") + entry.item.title) + "</span>";
        return hasDetail(entry.item)
          ? '<a class="status-strip__item" href="#' + esc(entry.item.id) + '">' + text + "</a>"
          : '<span class="status-strip__item">' + text + "</span>";
      };
      if (state.current) html += line("Now", state.current, "");
      if (state.next) {
        var today = state.next.day.date === bonnDate(now);
        html += line("Next", state.next, esc((today ? "" : state.next.day.weekday.slice(0, 3) + " ") + state.next.item.start) + " · ");
      }
      html += '<span class="status-strip__clock">' + bonnTime(now) + " in Bonn</span>";
    } else if (now > bounds.end) {
      html = '<span class="status-strip__item"><span class="status-strip__value">Energy Planning Week 2026 has concluded.</span></span>' +
        '<a class="status-strip__item" href="#resources"><span class="status-strip__value">Documents</span></a>';
    }
    /* Only rewritten when it changes, so a focused link keeps its focus. */
    if (strip._html !== html) { strip._html = html; strip.innerHTML = '<div class="wrap status-strip__inner">' + html + "</div>"; }
  }

  /* ---------- search ----------
     Words match from their start, accents ignored, and every word has to be
     found: "bra plan" finds Brazil's energy plan, "ai" does not find "sustainable". */

  function fold(text) {
    return " " + String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  var searchIndex = null;
  function buildSearch() {
    var sessions = allItems().filter(function (x) { return hasDetail(x.item); }).map(function (x) {
      var c = component(x.item._component), i = x.item;
      return {
        id: i.id, day: x.day, item: i,
        strong: fold([i.code, i.title].join(" ")),
        all: fold([i.code, i.title, i.subtitle, i.summary, i.partner, i.note, i.access, x.day.label, x.day.weekday, c && c.name, c && c.shortName]
          .concat((i.speakers || []).map(function (p) { return [p.name, p.org, p.title, p.role].join(" "); })).join(" "))
      };
    });
    var people = (speakers.people || []).map(function (p, index) {
      return { index: index, person: p, strong: fold(p.name), all: fold([p.name, p.org, p.title].join(" ")) };
    });
    return { sessions: sessions, people: people };
  }

  function runSearch() {
    searchIndex = searchIndex || buildSearch();
    var raw = el("searchInput").value.trim(), words = fold(raw).trim().split(" ").filter(Boolean);
    el("searchResults").scrollTop = 0;
    if (!words.length) {
      el("searchResults").innerHTML = "";
      el("searchCount").textContent = raw ? "No results for “" + raw + "”." : "Try a surname, an organisation or a topic.";
      return;
    }
    function every(text) { return words.every(function (w) { return text.indexOf(" " + w) >= 0; }); }
    function pick(list) {
      var hits = list.filter(function (x) { return every(x.all); });
      return hits.filter(function (x) { return every(x.strong); }).concat(hits.filter(function (x) { return !every(x.strong); }));
    }
    var sessions = pick(searchIndex.sessions), people = pick(searchIndex.people);

    function count(n, one) { return n + " " + one + (n === 1 ? "" : "s"); }
    el("searchCount").textContent = sessions.length || people.length
      ? count(people.length, "speaker") + ", " + count(sessions.length, "session")
      : "No results for “" + raw + "”.";

    var peopleHtml = people.map(function (x) {
      var p = x.person;
      return '<li><button type="button" class="modal__person" data-person="' + x.index + '">' +
        (p.photo
          ? '<img class="modal__person-photo" decoding="async" src="images/speakers/thumbs/' + esc(p.photo) + '" alt="" loading="lazy">'
          : '<span class="modal__person-photo speaker__initials" aria-hidden="true">' + esc(initials(p.name)) + "</span>") +
        '<span class="modal__person-text"><span class="modal__person-name">' + esc(p.name) + "</span>" +
        (p.org ? '<span class="modal__person-org">' + esc(p.org) + "</span>" : "") + "</span></button></li>";
    }).join("");
    var sessionHtml = sessions.map(function (x) {
      return '<li><button type="button" class="modal__person" data-session="' + esc(x.id) + '"><span class="modal__person-text">' +
        '<span class="modal__person-role">' + esc(x.day.label + " · " + x.item.start + "–" + x.item.end) + "</span>" +
        '<span class="modal__person-name">' + esc((x.item.code ? x.item.code + ": " : "") + x.item.title) + "</span>" +
      "</span></button></li>";
    }).join("");

    function group(label, html) {
      return html ? '<p class="modal__label">' + label + '</p><ul class="modal__people">' + html + "</ul>" : "";
    }
    /* A name is usually what was typed when it matches a person's name outright. */
    var named = people.length && every(people[0].strong);
    var a = group("Speakers", peopleHtml), b = group("Sessions", sessionHtml);
    el("searchResults").innerHTML = named ? a + b : b + a;
  }

  function initSearch() {
    var box = el("searchModal"), input = el("searchInput");
    el("searchOpen").addEventListener("click", function () {
      input.value = "";
      runSearch();
      box.showModal();
      input.focus();
    });
    input.addEventListener("input", runSearch);
    el("searchClose").addEventListener("click", function () { box.close(); });
    box.addEventListener("click", function (e) {
      if (e.target === box) { box.close(); return; }
      var hit = e.target.closest("[data-person], [data-session]");
      if (!hit) return;
      box.close();
      if (hit.dataset.session) openSession(hit.dataset.session);
      else openSpeaker(parseInt(hit.dataset.person, 10));
    });
  }

  /* ---------- print ----------
     All four days as plain tables; the screen layout is not printed. */

  function renderPrint() {
    el("printProgramme").innerHTML =
      "<h1>" + esc(event.name) + "</h1>" +
      "<p>" + esc(event.hostLine + ". " + event.dates.display + ". " + event.venue.name + ", " + event.venue.address) + "<br>" +
        (event.status.showBanner ? esc(event.status.banner) + " " : "") +
        "All times are " + esc(event.dates.timezoneLabel) + ".</p>" +
      programme.days.map(function (day) {
        return "<section><h2>" + esc(day.label + ", " + day.weekday + " " + parseInt(day.date.slice(8), 10) + " December: " + day.theme) + "</h2><table><tbody>" +
          day.items.map(function (item) {
            var names = (item.speakers || []).map(function (p) {
              return esc(p.name) + (/^moderator/i.test(p.role) ? " (moderator)" : "");
            }).join(", ");
            return "<tr><th scope='row'>" + esc(item.start + "–" + item.end) + "</th><td>" +
              "<b>" + esc(fullTitle(item)) + "</b>" + changeTag(item) +
              (item.partner ? "<br>" + esc(item.partner) : "") +
              (item.access ? "<br>" + esc(item.access) : "") +
              (names ? "<br>" + names : "") +
              (item.note ? "<br><i>" + esc(item.note) + "</i>" : "") + "</td></tr>";
          }).join("") + "</tbody></table></section>";
      }).join("");
  }

  /* ---------- speakers ---------- */

  /* Initials stand in until a headshot arrives: "Prof. Maarten Hajer" -> "MH". */
  function initials(name) {
    var parts = name.replace(/^(?:(?:prof|dr|ir|mr|ms|mrs)\.\s+)+/i, "").split(/\s+/);
    return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")).toUpperCase();
  }

  function renderSpeakers() {
    var people = speakers.people || [];
    var grid = el("speakerGrid");

    if (!people.length) {
      el("speakersLede").textContent =
        "Speakers are being confirmed. Confirmed speakers are listed here and shown with their sessions in the programme.";
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">' +
        "<strong>The speaker list is not yet published</strong>" +
        "It is updated as confirmations are received." +
        "</div>";
      return;
    }

    el("speakersLede").textContent = people.length + " confirmed speakers, moderators and chairs.";
    /* No role on the card: many people hold several roles across the week.
       Roles are shown per session in the speaker dialog instead. */
    grid.innerHTML = people.map(function (p, index) {
      var comp = (p.appearances && p.appearances[0] && p.appearances[0].component) || "";
      return '<button class="speaker" type="button" data-person="' + index + '" style="' + accentStyle(comp) + '">' +
        (p.photo
          ? '<img class="speaker__photo" decoding="async" src="images/speakers/thumbs/' + esc(p.photo) + '" alt="" loading="lazy">'
          : '<span class="speaker__photo speaker__initials" aria-hidden="true">' + esc(initials(p.name)) + "</span>") +
        '<span class="speaker__body">' +
          '<span class="speaker__name">' + esc(p.name) + "</span>" +
          (p.org ? '<span class="speaker__org">' + esc(p.org) + "</span>" : "") +
        "</span></button>";
    }).join("");
  }

  /* A speaker card opens the same dialog as a session: photo, affiliation,
     bio (when there is one) and the sessions the person appears in. */
  function findItem(id) {
    for (var d = 0; d < programme.days.length; d++) {
      var items = programme.days[d].items;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return { day: programme.days[d], item: items[i] };
      }
    }
    return null;
  }

  function openSpeaker(index, fromSession) {
    var p = (speakers.people || [])[index];
    if (!p) return;
    var back = fromSession
      ? '<button type="button" class="modal__back" data-back="' + esc(fromSession) + '">← Back to session</button>'
      : "";
    var comp = (p.appearances && p.appearances[0] && p.appearances[0].component) || "";

    var sessions = (p.appearances || []).map(function (a) {
      var hit = findItem(a.item);
      if (!hit) return "";
      return '<li><button type="button" class="modal__person" data-session="' + esc(a.item) + '"><span class="modal__person-text">' +
        (a.role ? '<span class="modal__person-role">' + esc(a.role) + "</span>" : "") +
        '<span class="modal__person-name">' + esc((hit.item.code ? hit.item.code + ": " : "") + hit.item.title) + "</span>" +
        '<span class="modal__person-org">' + esc(hit.day.label + ", " + hit.day.weekday + " " + parseInt(hit.day.date.slice(8), 10) +
          " December · " + hit.item.start + "–" + hit.item.end) + "</span>" +
      "</span></button></li>";
    }).join("");

    el("modalBody").innerHTML =
      '<div style="' + accentStyle(comp) + '">' +
        back +
        '<div class="modal__speaker">' +
          (p.photo
            ? '<img class="modal__speaker-photo" decoding="async" src="images/speakers/thumbs/' + esc(p.photo) + '" alt="">'
            : '<span class="modal__speaker-photo speaker__initials" aria-hidden="true">' + esc(initials(p.name)) + "</span>") +
          "<div>" +
            '<h2 class="modal__title" id="modalTitle">' + esc(p.name) + "</h2>" +
            (p.title ? '<p class="modal__person-org">' + esc(p.title) + "</p>" : "") +
            (p.org ? '<p class="modal__person-org">' + esc(p.org) + "</p>" : "") +
          "</div>" +
        "</div>" +
        (p.bio ? '<p class="modal__summary">' + esc(p.bio) + "</p>" : "") +
        (sessions
          ? '<div class="modal__section"><p class="modal__label">At Energy Planning Week</p><ul class="modal__people">' + sessions + "</ul></div>"
          : "") +
      "</div>";

    setHash("");
    showModal();
  }

  el("speakerGrid").addEventListener("click", function (e) {
    var card = e.target.closest(".speaker[data-person]");
    if (card) openSpeaker(parseInt(card.dataset.person, 10));
  });

  /* ---------- join ---------- */

  function renderJoin() {
    var hasLink = Boolean(event.join.url);
    el("joinCard").innerHTML =
      '<div class="join-card__text">' +
        "<p><strong>" + esc(event.join.platform) + ".</strong> " + esc(event.format.note) + " " +
        "All sessions are open to online participants except the closed-door LTES Network strategic meeting on Day 3.</p>" +
      "</div>" +
      (hasLink
        ? '<a class="btn" href="' + esc(event.join.url) + '" target="_blank" rel="noopener noreferrer">' + esc(event.join.label) + "</a>"
        : '<div class="join-card__action">' +
          (event.registration && event.registration.url ? registerButton() : "") +
          "<p>The joining link is sent to registered participants before the event.</p></div>");

    var navJoin = el("navJoin");
    if (!hasLink && event.registration && event.registration.url) {
      navJoin.textContent = "Register";
      navJoin.href = event.registration.url;
      navJoin.target = "_blank";
      navJoin.rel = "noopener noreferrer";
    } else if (!hasLink) navJoin.setAttribute("aria-disabled", "true");
  }

  /* ---------- resources ---------- */

  function renderResources() {
    el("docGrid").innerHTML = practical.documents.map(function (doc) {
      return '<article class="doc">' +
        '<h3 class="doc__title">' + esc(doc.title) + "</h3>" +
        '<p class="doc__desc">' + esc(doc.description) + "</p>" +
        '<p class="doc__action">' + (doc.url
          ? '<a class="btn btn--quiet" href="' + esc(doc.url) + '" rel="noopener noreferrer">Download ' + esc(doc.format) + "</a>"
          : '<span class="doc__pending">Not published yet</span>') + "</p>" +
      "</article>";
    }).join("");

    el("pubGrid").innerHTML = publications.items.map(function (p) {
      var webp = p.image.replace(/\.(jpg|png)$/i, ".webp");
      return '<a class="pub" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' +
        "<picture>" +
          '<source srcset="' + esc(webp.replace(/\.webp$/, "-sm.webp")) + '" type="image/webp">' +
          '<img class="pub__cover" src="' + esc(p.image) + '" alt="" loading="lazy" decoding="async">' +
        "</picture>" +
        '<span class="pub__year">' + esc(p.year) + "</span>" +
        '<span class="pub__title">' + esc(p.title) + "</span>" +
        '<span class="pub__sub">' + esc(p.subtitle) + "</span>" +
      "</a>";
    }).join("");

    /* GET.transform publications and country stories: one card each, one or
       more links (a country story can pair two articles). */
    var gt = (publications.getTransform || {}).items || [];
    el("storyFold").hidden = !gt.length;
    el("pubCount").textContent = publications.items.length;
    el("storyCount").textContent = gt.length;
    el("storyGrid").innerHTML = gt.map(function (s) {
      var webp = s.image.replace(/\.(jpg|png)$/i, ".webp");
      return '<article class="story">' +
        "<picture>" +
          '<source srcset="' + esc(webp.replace(/\.webp$/, "-sm.webp")) + '" type="image/webp">' +
          '<img class="story__img" src="' + esc(s.image) + '" alt="" loading="lazy" decoding="async">' +
        "</picture>" +
        '<div class="story__body">' +
          '<p class="story__label">' + esc(s.label) + "</p>" +
          '<h4 class="story__title">' + esc(s.title) + "</h4>" +
          '<p class="story__text">' + esc(s.text) + "</p>" +
          '<ul class="story__links">' + s.links.map(function (l) {
            return '<li><a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.label) + "</a></li>";
          }).join("") + "</ul>" +
        "</div>" +
      "</article>";
    }).join("");
  }

  /* ---------- scene ---------- */

  /* Photographs from the previous Forum. Hidden unless there is both a credit and
     at least one image, so 2025 photographs are never shown uncredited. */
  function renderScene() {
    if (!gallery || gallery.show === false) return;
    var images = (gallery.images || []).filter(function (img) { return img.image; });
    if (!images.length || !gallery.credit) return;

    el("sceneGrid").innerHTML = images.map(function (img) {
      return '<figure class="scene__item" data-span="' + esc(img.span || "half") + '">' +
        picture(img.image, img.alt, "scene__img", true) +
      "</figure>";
    }).join("");
    if (gallery.layout) el("sceneGrid").setAttribute("data-layout", gallery.layout);

    el("sceneCredit").textContent = gallery.credit;
    el("scene").hidden = false;
  }

  /* ---------- practical ---------- */

  function renderPractical() {
    var venue = practical.venue;
    var address = venue.addressLines && venue.addressLines.length
      ? venue.addressLines.map(esc).join("<br>") + "<br>" + esc(venue.city)
      : "<span class='todo'>Full address to be confirmed</span><br>" + esc(venue.city);

    var panels = [];

    panels.push('<div class="panel">' +
      '<h3 class="panel__heading">Venue</h3>' +
      '<address class="addr"><strong>' + esc(venue.name) + "</strong><br>" + address +
      (venue.phone ? "<br>" + esc(venue.phone) : "") + "</address>" +
      (venue.mapEmbed
        ? '<button type="button" class="map map--ask" id="mapLoad"><span class="map__label">Show map</span>' +
          '<span class="map__hint">Loads Google Maps</span></button>'
        : "") +
      (event.venue.mapUrl
        ? '<p class="map__link"><a href="' + esc(event.venue.mapUrl) + '" target="_blank" rel="noopener">Open in Google Maps</a></p>'
        : "") +
      '<h3 class="panel__heading" style="margin-top:1.5rem">Getting there</h3>' +
      '<ul class="panel__list">' + practical.gettingThere.map(function (line) {
        return "<li>" + (/^TODO/.test(line) ? "<span class='todo'>" + esc(line) + "</span>" : esc(line)) + "</li>";
      }).join("") + "</ul>" +
    "</div>");

    practical.sections.forEach(function (s) {
      panels.push('<div class="panel">' +
        '<h3 class="panel__heading">' + esc(s.heading) + "</h3>" +
        '<div class="panel__body"><p>' + esc(s.body) + "</p>" +
          (s.id === "format" && event.registration && event.registration.url
            ? '<p class="panel__action">' + registerButton() + "</p>" : "") +
        "</div>" +
      "</div>");
    });

    panels.push('<div class="panel">' +
      '<h3 class="panel__heading">Contact</h3>' +
      '<ul class="contact-list">' + event.contacts.map(function (c) {
        return "<li>" + esc(c.label) + "<br><a href='mailto:" + esc(c.email) + "'>" + esc(c.email) + "</a></li>";
      }).join("") + "</ul>" +
      '<div class="emergency">' + practical.emergency.map(function (e) {
        return "<span><b>" + esc(e.number) + "</b> " + esc(e.label) + "</span>";
      }).join("") + "</div>" +
    "</div>");

    el("practicalGrid").innerHTML = panels.join("");

    /* Google Maps is 2 MB and sees the visitor's IP address, so it is only
       fetched for someone who asks for it. */
    var ask = el("mapLoad");
    if (ask) ask.addEventListener("click", function () {
      var frame = document.createElement("iframe");
      frame.className = "map";
      frame.title = "Map of " + venue.name;
      frame.referrerPolicy = "no-referrer-when-downgrade";
      frame.src = venue.mapEmbed;
      ask.replaceWith(frame);
      frame.focus();
    });
  }

  /* ---------- chrome ---------- */

  function initNav() {
    var toggle = el("navToggle"), list = el("navList");
    toggle.addEventListener("click", function () {
      var open = list.dataset.open === "true";
      list.dataset.open = String(!open);
      toggle.setAttribute("aria-expanded", String(!open));
    });
    list.addEventListener("click", function (e) {
      if (e.target.closest("a")) { list.dataset.open = "false"; toggle.setAttribute("aria-expanded", "false"); }
    });

    var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link[href^='#']:not([data-tab])"));
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (view === "home") markTabs({ programme: "programme", speakers: "programme", practical: "venue", join: "venue", resources: "venue", faq: "venue" }[entry.target.id] || "home");
        links.forEach(function (a) {
          a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + entry.target.id));
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });

    document.querySelectorAll("main section[id]").forEach(function (s) { observer.observe(s); });
  }

  function renderNotices() {
    if (event.status.showBanner && event.status.banner) {
      var n = el("draftNotice");
      n.hidden = false;
      n.textContent = event.status.banner;
    }

    el("programmeLede").textContent =
      "Select a day to view its sessions, and a session for its description. " +
      "All times are " + event.dates.timezoneLabel + ".";
  }

  /* ---------- go ---------- */

  renderHero();
  renderHeroPhoto();
  renderAbout();
  renderThemes();
  renderWeekBand();
  renderNotices();
  renderDayTabs();
  renderRail();
  renderScene();
  renderSpeakers();
  renderJoin();
  renderResources();
  renderPractical();
  renderFaq();
  initNav();
  initSearch();
  renderPrint();
  renderStatus();
  document.documentElement.className = "";   // content is in place: show the page

  window.addEventListener("resize", markNow);
  initApp();
})();
