/* Energy Planning Week 2026 — the scenario thread
 *
 * Five scenario pathways run the length of the page. They leave one origin in
 * the hero (the base year), fan out, and cross the page at every section
 * boundary — pulling apart mid-crossing, as scenarios do — before converging
 * on a single point in the footer. Their colour follows the planning chain the
 * brand mark already uses: IRENA Blue (scenarios) at the top, shading into
 * Turquoise Surf (investment), and the point they converge on lights up in
 * Royal Gold (implementation) when the reader gets there. The lines never blend
 * into gold themselves — turquoise mixed with gold passes through a lime that
 * is not in the brand.
 *
 * The lines draw themselves as the reader scrolls. They only ever run in the
 * side gutters and through the empty padding between sections, so they never
 * sit under text. Purely decorative: aria-hidden, no pointer events, and with
 * reduced motion the thread is drawn in full and holds still.
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var COUNT = 5;
  var MID = (COUNT - 1) / 2;
  var LEAD_AT = 0.72;   // the tip of the thread sits this far down the viewport
  var STEP = 10;        // px between samples on the vertical runs
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  var svg, grad, tip, origin, goal;
  var lines = [];
  var geo = null, shown = 0, frame = 0, pending = 0;

  function node(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function smooth(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  function build() {
    svg = node("svg", { "class": "thread", "aria-hidden": "true", focusable: "false" });
    var defs = node("defs", {}, svg);
    grad = node("linearGradient", { id: "threadInk", gradientUnits: "userSpaceOnUse", x1: 0, x2: 0 }, defs);
    [["0", "--forum"], ["0.35", "--forum"], ["1", "--gcep"]].forEach(function (s) {
      node("stop", { offset: s[0], style: "stop-color: var(" + s[1] + ")" }, grad);
    });

    for (var i = 0; i < COUNT; i++) {
      var u = Math.abs(i - MID) / MID;   // 0 for the lead line, 1 for the outermost
      lines.push({
        u: (i - MID) / MID,
        phase: i * 1.7,
        el: node("path", {
          "class": "thread__line" + (u === 0 ? " thread__line--lead" : ""),
          "stroke-opacity": u === 0 ? 1 : (0.75 - 0.3 * u).toFixed(2)
        }, svg)
      });
    }

    origin = node("circle", { "class": "thread__origin", r: 3.5 }, svg);
    goal = node("circle", { "class": "thread__goal", r: 5 }, svg);
    tip = node("g", { "class": "thread__tip" }, svg);
    node("circle", { "class": "thread__halo", r: 9 }, tip);
    node("circle", { "class": "thread__dot", r: 3.2 }, tip);

    document.body.appendChild(svg);
  }

  /* ---------- geometry ---------- */

  function layout() {
    pending = 0;
    var hero = document.querySelector(".hero");
    var footer = document.querySelector(".footer");
    var wrap = document.querySelector("main .wrap");
    if (!hero || !footer || !wrap) return;

    var sy = window.scrollY;
    var W = document.documentElement.clientWidth;
    var box = wrap.getBoundingClientRect();
    var side = [box.left / 2, W - (W - box.right) / 2];
    var gutter = Math.min(box.left, W - box.right);
    var spread = Math.max(5, Math.min(gutter * 0.3, 44));   // half-width of the fan in a gutter
    var wobble = spread * 0.45;

    function top(el) { return el.getBoundingClientRect().top + sy; }
    function pad(el, edge) { return parseFloat(getComputedStyle(el)["padding" + edge]) || 0; }

    var blocks = [].slice.call(document.querySelectorAll("main > section"))
      .filter(function (s) { return !s.hidden && s.offsetHeight; });
    blocks.push(footer);

    var start = top(hero) + pad(hero, "Top") + 8;
    var bottom = top(footer) + footer.offsetHeight;
    var end = top(footer) + footer.offsetHeight / 2;
    var fanIn = 320;

    /* One crossing per section boundary, inside the empty padding either side
       of it, alternating left→right and right→left down the page. */
    var crossings = [];
    for (var k = 1; k < blocks.length; k++) {
      var b = top(blocks[k]);
      crossings.push({
        a: b - pad(blocks[k - 1], "Bottom") * 0.7,
        c: b + pad(blocks[k], "Top") * 0.7,
        from: (k - 1) % 2,
        to: k % 2
      });
    }
    var last = crossings.length ? crossings[crossings.length - 1].to : 0;

    lines.forEach(function (ln) {
      var pts = [], drive = [];
      function push(x, y, d) { pts.push(x, y); drive.push(d); }
      function gx(y, s) {
        var env = smooth((y - start) / fanIn) * smooth((end - y) / fanIn);
        return side[s] + env * (ln.u * spread + wobble * Math.sin(y / 340 + ln.phase));
      }

      var y = start, s = 0;
      crossings.forEach(function (cr) {
        for (; y < cr.a; y += STEP) push(gx(y, s), y, y);
        var xa = gx(cr.a, cr.from), xc = gx(cr.c, cr.to);
        var band = cr.c - cr.a;
        var fanY = Math.min(band * 0.3, 36);
        var n = Math.max(40, Math.round(Math.abs(xc - xa) / 8));
        for (var j = 0; j <= n; j++) {
          var t = j / n;
          var bell = Math.sin(Math.PI * t); bell *= bell;
          var wave = ln.u * fanY + fanY * 0.55 * Math.sin(t * Math.PI * 4 + ln.phase);
          push(xa + (xc - xa) * smoother(t), cr.a + band * t + bell * wave, cr.a + band * t);
        }
        y = cr.c + STEP;
        s = cr.to;
      });
      for (; y < end; y += STEP) push(gx(y, s), y, y);
      push(side[s], end, end);

      var d = "M" + pts[0].toFixed(1) + " " + pts[1].toFixed(1);
      var cum = new Float32Array(drive.length), total = 0;
      for (var i = 1; i < drive.length; i++) {
        total += Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
        cum[i] = total;
        d += "L" + pts[2 * i].toFixed(1) + " " + pts[2 * i + 1].toFixed(1);
      }
      ln.el.setAttribute("d", d);
      ln.el.style.strokeDasharray = total + " " + total;
      ln.pts = pts; ln.drive = drive; ln.cum = cum; ln.total = total;
    });

    svg.setAttribute("width", W);
    svg.setAttribute("height", bottom);
    grad.setAttribute("y1", start);
    grad.setAttribute("y2", end);
    origin.setAttribute("cx", side[0]); origin.setAttribute("cy", start);
    goal.setAttribute("cx", side[last]); goal.setAttribute("cy", end);

    var first = !geo;
    geo = { start: start, end: end };
    if (first) shown = start;   // the thread draws itself in on load
    draw(shown);
    kick();
  }

  /* ---------- drawing ---------- */

  // Where each line has got to when the reader is at depth T: the drive values
  // rise monotonically down the page, so a binary search finds the sample.
  function at(ln, T) {
    var d = ln.drive, n = d.length;
    if (T <= d[0]) return { len: 0, i: 0, f: 0 };
    if (T >= d[n - 1]) return { len: ln.total, i: n - 2, f: 1 };
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (d[m] <= T) lo = m; else hi = m; }
    var f = (T - d[lo]) / (d[hi] - d[lo] || 1);
    return { len: ln.cum[lo] + (ln.cum[hi] - ln.cum[lo]) * f, i: lo, f: f };
  }

  function draw(T) {
    var lead = null;
    lines.forEach(function (ln) {
      var p = at(ln, T);
      ln.el.style.strokeDashoffset = ln.total - p.len;
      if (ln.u === 0) lead = { ln: ln, p: p };
    });

    var live = T > geo.start && T < geo.end;
    tip.style.opacity = live ? 1 : 0;
    if (live && lead) {
      var q = lead.ln.pts, i = lead.p.i, f = lead.p.f;
      var x = q[2 * i] + (q[2 * i + 2] - q[2 * i]) * f;
      var y = q[2 * i + 1] + (q[2 * i + 3] - q[2 * i + 1]) * f;
      tip.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")");
    }
    goal.classList.toggle("is-reached", T >= geo.end);
  }

  // Over the last screen of scrolling the tip runs ahead of LEAD_AT, so it
  // still reaches the footer when the page cannot scroll any further.
  function target() {
    if (reduced.matches) return Infinity;
    var vh = window.innerHeight, sy = window.scrollY;
    var max = document.documentElement.scrollHeight - vh;
    var T = sy + vh * LEAD_AT;
    var short = geo.end + 2 - (max + vh * LEAD_AT);
    if (short > 0) T += short * smooth(1 - (max - sy) / vh);
    return T;
  }

  // The drawn length eases toward the scroll position rather than jumping to
  // it, so a flick of the wheel reads as a sweep instead of a stutter.
  function tick() {
    frame = 0;
    var T = target();
    if (T === Infinity || !isFinite(shown) || Math.abs(T - shown) < 0.5) shown = T;
    else { shown += (T - shown) * 0.12; frame = requestAnimationFrame(tick); }
    draw(shown);
  }

  function kick() { if (geo && !frame) frame = requestAnimationFrame(tick); }
  function relayout() { if (!pending) pending = requestAnimationFrame(layout); }

  build();
  layout();

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", relayout);
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if (reduced.addEventListener) reduced.addEventListener("change", kick);
})();
