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
    document.body.insertAdjacentHTML("afterbegin",
      '<p class="notice">Site data did not load. Run <code>python tools/build_data.py</code> to rebuild js/data.js.</p>');
    return;
  }

  var event = D.event, programme = D.programme,
      speakers = D.speakers, publications = D.publications, practical = D.practical,
      gallery = D.gallery;

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

  function accentName(id) { return { "ltes-forum": "forum", "gcep-dialogue": "gcep", "implementation": "impl" }[id] || "forum"; }
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

  /* ---------- hero ---------- */

  function renderHero() {
    el("heroHosts").textContent = event.hostLine;
    el("heroTagline").textContent = event.tagline;

    var facts = [
      ["Dates", event.dates.display],
      ["Venue", event.venue.display],
      ["Format", event.format.type]
    ];
    el("heroFacts").innerHTML = facts.map(function (f) {
      return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>";
    }).join("");

    el("footerLine").textContent =
      event.name + " — " + event.hostLine + ". " + event.dates.display + ", " + event.venue.display + ".";
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
          '<span class="weekband__dow">' + esc(day.weekday.slice(0, 3)) + " " + esc(day.date.slice(8)) + " Dec</span>" +
          "<span>" + esc(day.label) + (day.tbd ? " · sessions TBC" : "") + "</span>" +
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

  var selectedDay = programme.days[0].id;

  function renderDayTabs() {
    el("dayTabs").innerHTML = programme.days.map(function (day) {
      return '<button class="daytabs__btn" role="tab" type="button"' +
        ' id="tab-' + esc(day.id) + '" data-day="' + esc(day.id) + '"' +
        ' style="' + accentStyle(day.component) + '"' +
        ' aria-selected="' + (day.id === selectedDay) + '">' +
        '<span class="daytabs__day">' + esc(day.label) + "</span>" +
        '<span class="daytabs__date">' + esc(day.weekday) + " " + esc(day.date.slice(8)) + " Dec</span>" +
      "</button>";
    }).join("");

    el("dayTabs").addEventListener("click", function (e) {
      var btn = e.target.closest(".daytabs__btn");
      if (btn) selectDay(btn.dataset.day);
    });
  }

  function selectDay(id) {
    selectedDay = id;
    Array.prototype.forEach.call(el("dayTabs").children, function (btn) {
      btn.setAttribute("aria-selected", String(btn.dataset.day === id));
    });
    renderRail();
  }

  function renderRail() {
    var day = programme.days.filter(function (d) { return d.id === selectedDay; })[0];
    var comp = component(day.component);

    var head =
      '<div class="rail__daytitle" style="' + accentStyle(day.component) + '">' +
        '<span class="rail__component">' + esc(comp ? comp.shortName : day.label) + "</span>" +
        '<span class="rail__theme">' + esc(day.theme) + "</span>" +
      "</div>" +
      (day.tbd ? '<p class="notice">' + esc(day.tbdNote) + "</p>" : "");

    /* Blocks carry only time, code and title. The rail is drawn to scale, so
       content must not push a block beyond its duration; the full description
       is in the modal. */
    var items = day.items.map(function (item, index) {
      var accent = accentStyle(item._component);
      var detailed = Boolean(item.summary);
      var tag = document.createElement(detailed ? "button" : "article");

      tag.className = "rail__item";
      tag.setAttribute("data-kind", item.type);
      tag.setAttribute("data-index", String(index));
      if (!detailed) tag.setAttribute("data-plain", "true");
      tag.style.cssText = "--minutes:" + duration(item) + ";" + accent;
      if (detailed) { tag.type = "button"; tag.setAttribute("data-open", String(index)); }

      tag.innerHTML =
        '<span class="rail__time">' +
          '<span class="rail__start">' + esc(item.start) + "</span>" +
          "<span>" + esc(item.end) + "</span>" +
          '<span class="rail__dur">' + esc(fmtDuration(duration(item))) + "</span>" +
        "</span>" +
        '<span class="rail__body">' +
          (item.code ? '<span class="rail__code">' + esc(item.code) + "</span>" : "") +
          '<span class="rail__title">' + esc(item.title) + "</span>" +
          (item.subtitle ? '<span class="rail__subtitle">' + esc(item.subtitle) + "</span>" : "") +
          (item.partner ? '<span class="rail__partner">' + esc(item.partner) + "</span>" : "") +
          (item.access ? '<span class="rail__tag" data-tone="closed">' + esc(item.access) + "</span>" : "") +
        "</span>";

      return tag.outerHTML;
    }).join("");

    el("rail").innerHTML = head + items;
    el("rail").style.setProperty("--accent", accentVar(day.component));
    el("rail").style.setProperty("--accent-ink", "var(--" + accentName(day.component) + "-ink)");
    markNow();
  }

  el("rail").addEventListener("click", function (e) {
    var btn = e.target.closest(".rail__item[data-open]");
    if (btn) openSession(parseInt(btn.dataset.open, 10));
  });

  /* ---------- session detail ---------- */

  var modal = el("sessionModal");

  function openSession(index) {
    var day = programme.days.filter(function (d) { return d.id === selectedDay; })[0];
    var item = day.items[index];
    var comp = component(item._component);

    var people = (item.speakers || []).map(function (p) {
      return "<li>" +
        (p.role ? '<div class="modal__person-role">' + esc(p.role) + (p.provisional ? " · to be confirmed" : "") + "</div>" : "") +
        '<div class="modal__person-name">' + esc(p.name) + "</div>" +
        (p.title ? '<div class="modal__person-org">' + esc(p.title) + "</div>" : "") +
        (p.org ? '<div class="modal__person-org">' + esc(p.org) + "</div>" : "") +
      "</li>";
    }).join("");

    el("modalBody").innerHTML =
      '<div style="' + accentStyle(item._component) + '">' +
        '<p class="modal__eyebrow">' + esc(comp ? comp.shortName : "") + (item.code ? " · " + esc(item.code) : "") + "</p>" +
        '<h2 class="modal__title" id="modalTitle">' + esc(item.title) + "</h2>" +
        '<p class="modal__meta">' + esc(day.weekday) + " " + esc(day.date.slice(8)) + " December · " +
          esc(item.start) + "–" + esc(item.end) + " " + esc(event.dates.timezoneLabel) +
          " · " + esc(fmtDuration(duration(item))) +
          (item.partner ? " · " + esc(item.partner) : "") + "</p>" +
        (item.summary ? '<p class="modal__summary">' + esc(item.summary) + "</p>" : "") +
        (item.note ? '<p class="modal__summary" style="margin-top:.9rem;font-style:italic">' + esc(item.note) + "</p>" : "") +
        (people
          ? '<div class="modal__section"><p class="modal__label">Speakers</p><ul class="modal__people">' + people + "</ul></div>"
          : "") +
      "</div>";

    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  el("modalClose").addEventListener("click", function () { modal.close(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.close(); });

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
      var s = toDate(entries[i].day.date, entries[i].item.start);
      var e = toDate(entries[i].day.date, entries[i].item.end);
      if (now >= s && now < e) current = entries[i];
      if (!next && s > now) next = entries[i];
    }
    return { current: current, next: next };
  }

  function markNow() {
    var now = new Date();
    var day = programme.days.filter(function (d) { return d.id === selectedDay; })[0];
    var rail = el("rail");
    var old = rail.querySelector(".rail__now");
    if (old) old.remove();
    Array.prototype.forEach.call(rail.querySelectorAll(".rail__item"), function (n) { n.removeAttribute("data-now"); });

    day.items.forEach(function (item, index) {
      var s = toDate(day.date, item.start), e = toDate(day.date, item.end);
      if (now < s || now >= e) return;
      var node = rail.querySelector('.rail__item[data-index="' + index + '"]');
      if (!node) return;
      node.setAttribute("data-now", "true");
      var share = (now - s) / (e - s);
      var line = document.createElement("div");
      line.className = "rail__now";
      line.style.top = (node.offsetTop + node.offsetHeight * share) + "px";
      rail.appendChild(line);
    });
  }

  function renderStatus() {
    var strip = el("statusStrip"), now = new Date(), bounds = eventBounds();

    if (now < bounds.start) {
      strip.hidden = true;
      return;
    }

    if (now > bounds.end) {
      strip.hidden = false;
      strip.removeAttribute("data-live");
      strip.innerHTML = '<span class="status-strip__label">Closed</span>' +
        '<span class="status-strip__value">Energy Planning Week 2026 has concluded.</span>';
      return;
    }

    var state = findNow(now);
    strip.hidden = false;
    strip.setAttribute("data-live", "true");
    var parts = [];
    if (state.current) {
      parts.push('<span class="status-strip__label"><span class="live-dot"></span>Now</span>' +
        '<span class="status-strip__value">' + esc(state.current.item.title) + "</span>");
    }
    if (state.next) {
      parts.push('<span class="status-strip__label">Next</span>' +
        '<span class="status-strip__value">' + esc(state.next.item.start) + " · " + esc(state.next.item.title) + "</span>");
    }
    strip.innerHTML = parts.join("") || '<span class="status-strip__label">Between sessions</span>';
  }

  /* ---------- speakers ---------- */

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
    grid.innerHTML = people.map(function (p) {
      var role = (p.appearances && p.appearances[0] && p.appearances[0].role) || "";
      var comp = (p.appearances && p.appearances[0] && p.appearances[0].component) || "";
      return '<button class="speaker" type="button" style="' + accentStyle(comp) + '">' +
        '<img class="speaker__photo" src="images/speakers/' + esc(p.photo) + '" alt="" loading="lazy"' +
        " onerror=\"this.style.visibility='hidden'\">" +
        '<span class="speaker__body">' +
          '<span class="speaker__name">' + esc(p.name) + "</span>" +
          (p.org ? '<span class="speaker__org">' + esc(p.org) + "</span>" : "") +
          (role ? '<span class="speaker__role">' + esc(role) + "</span>" : "") +
        "</span></button>";
    }).join("");
  }

  /* ---------- join ---------- */

  function renderJoin() {
    var hasLink = Boolean(event.join.url);
    el("joinCard").innerHTML =
      '<div class="join-card__text">' +
        "<p><strong>" + esc(event.join.platform) + ".</strong> " + esc(event.format.note) + " " +
        "All sessions are open to online participants except the closed-door LTES Network strategic meeting on Day 2.</p>" +
      "</div>" +
      (hasLink
        ? '<a class="btn" href="' + esc(event.join.url) + '" target="_blank" rel="noopener noreferrer">' + esc(event.join.label) + "</a>"
        : '<span class="btn" aria-disabled="true">Joining link to be published</span>');

    var navJoin = el("navJoin");
    if (!hasLink) navJoin.setAttribute("aria-disabled", "true");
  }

  /* ---------- resources ---------- */

  function renderResources() {
    el("docGrid").innerHTML = practical.documents.map(function (doc) {
      return '<article class="doc">' +
        '<h3 class="doc__title">' + esc(doc.title) + "</h3>" +
        '<p class="doc__desc">' + esc(doc.description) + "</p>" +
        '<p class="doc__action">' + (doc.url
          ? '<a class="btn btn--quiet" href="' + esc(doc.url) + '" rel="noopener noreferrer">Download ' + esc(doc.format) + "</a>"
          : '<span class="btn btn--quiet" aria-disabled="true">Not published yet</span>') + "</p>" +
      "</article>";
    }).join("");

    el("pubGrid").innerHTML = publications.items.map(function (p) {
      var webp = p.image.replace(/\.(jpg|png)$/i, ".webp");
      return '<a class="pub" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' +
        "<picture>" +
          '<source srcset="' + esc(webp) + '" type="image/webp">' +
          '<img class="pub__cover" src="' + esc(p.image) + '" alt="" loading="lazy">' +
        "</picture>" +
        '<span class="pub__year">' + esc(p.year) + "</span>" +
        '<span class="pub__title">' + esc(p.title) + "</span>" +
        '<span class="pub__sub">' + esc(p.subtitle) + "</span>" +
      "</a>";
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
      var webp = img.image.replace(/\.(jpg|jpeg|png)$/i, ".webp");
      return '<figure class="scene__item" data-span="' + esc(img.span || "half") + '">' +
        "<picture>" +
          '<source srcset="' + esc(webp) + '" type="image/webp">' +
          '<img class="scene__img" src="' + esc(img.image) + '" alt="' + esc(img.alt) + '" loading="lazy" decoding="async">' +
        "</picture>" +
      "</figure>";
    }).join("");

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
      '<h3 class="panel__heading" style="margin-top:1.5rem">Getting there</h3>' +
      '<ul class="panel__list">' + practical.gettingThere.map(function (line) {
        return "<li>" + (/^TODO/.test(line) ? "<span class='todo'>" + esc(line) + "</span>" : esc(line)) + "</li>";
      }).join("") + "</ul>" +
    "</div>");

    practical.sections.forEach(function (s) {
      panels.push('<div class="panel">' +
        '<h3 class="panel__heading">' + esc(s.heading) + "</h3>" +
        '<div class="panel__body"><p>' + esc(s.body) + "</p></div>" +
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

    var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link[href^='#']"));
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
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
      event.components.map(function (c) { return c.shortName + " (" + c.days.toLowerCase() + ")"; }).join(", ") +
      ". Select a day to view its sessions, and a session for its description. " +
      "All times are " + event.dates.timezoneLabel + ".";
  }

  /* ---------- go ---------- */

  renderHero();
  renderWeekBand();
  renderNotices();
  renderDayTabs();
  renderRail();
  renderScene();
  renderSpeakers();
  renderJoin();
  renderResources();
  renderPractical();
  initNav();
  renderStatus();

  setInterval(function () { renderStatus(); markNow(); }, 30000);
  window.addEventListener("resize", markNow);
})();
