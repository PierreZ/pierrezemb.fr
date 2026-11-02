/* Deck runtime: paged 1600x900 canvas scaled to the window, steps, keyboard, deep links and helpers.
   Every part script calls Deck.slide(...) at load time; index.html calls Deck.start() last.

   Steps: Deck.slide({ id, label, steps: n, html, init, onStep }). The runtime sets data-step="i"
   (0-based) on the current <section>, then for each element inside it:
     data-from="a"        visible when step >= a
     data-until="b"       visible when step <= b (combine with data-from for a window)
     data-now="a b ..."   gets class .now (highlight) when step is one of the listed values
   Visible elements carry class .st-on (works in HTML and inside SVG). onStep(sec, i) runs after
   every change, including when the slide is entered, for states CSS cannot express. */
(function () {
  'use strict';
  const slides = [];
  let sections = [];
  let started = false;
  let idx = -1;  // current slide (-1 until the first go)
  let step = 0;  // current step of the current slide
  let deckEl = null, countEl = null;

  const SVGNS = 'http://www.w3.org/2000/svg';

  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(c => append(node, c)); return; }
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  function build(node, attrs, children) {
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class' || k === 'className') node.setAttribute('class', v);
        else if (k === 'style' && typeof v === 'object') {
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith('--')) node.style.setProperty(sk, sv); else node.style[sk] = sv;
          }
        }
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    append(node, children);
    return node;
  }
  function el(tag, attrs, ...children) { return build(document.createElement(tag), attrs, children); }
  function svg(tag, attrs, ...children) { return build(document.createElementNS(SVGNS, tag), attrs, children); }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  function prng(seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- code highlighter ---------- */
  const KW = {
    rust: 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while Some None Ok Err',
    go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil',
    sql: 'select from where and or not insert into values update set delete create table index primary key on as order by group limit null is in join left right inner outer drop alter add column begin commit rollback',
    text: ''
  };
  function code(src, lang) {
    lang = lang || 'text';
    const kws = new Set((KW[lang] || '').split(' ').filter(Boolean));
    const ci = lang === 'sql';
    const parts = [];
    const comment = lang === 'sql' ? '--[^\\n]*' : '//[^\\n]*';
    const re = new RegExp([
      '(' + comment + ')',                       // 1 comment
      '("(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\')', // 2 string
      '(#!?\\[[^\\]\\n]*\\])',                   // 3 attribute
      '(\\b\\d[\\d_]*(?:\\.\\d+)?\\b)',          // 4 number
      '([A-Za-z_][A-Za-z0-9_]*!?)'               // 5 identifier
    ].join('|'), 'g');
    let last = 0, m;
    if (lang === 'text') return '<pre class="code" data-lang="text"><code>' + esc(src) + '</code></pre>';
    while ((m = re.exec(src))) {
      parts.push(esc(src.slice(last, m.index)));
      const t = m[0];
      let cls = null;
      if (m[1]) cls = 'tk-com';
      else if (m[2]) cls = 'tk-str';
      else if (m[3]) cls = 'tk-attr';
      else if (m[4]) cls = 'tk-num';
      else if (m[5]) {
        const w = ci ? t.toLowerCase() : t;
        if (kws.has(w)) cls = 'tk-kw';
        else if (t.endsWith('!')) cls = 'tk-mac';
        else if (/^[A-Z]/.test(t) && lang === 'rust') cls = 'tk-ty';
        else if (src[re.lastIndex] === '(') cls = 'tk-fn';
      }
      parts.push(cls ? '<span class="' + cls + '">' + esc(t) + '</span>' : esc(t));
      last = re.lastIndex;
    }
    parts.push(esc(src.slice(last)));
    return '<pre class="code" data-lang="' + lang + '"><code>' + parts.join('') + '</code></pre>';
  }

  /* ---------- SVG schema helpers (return strings for a slide's html, canvas coordinates) ---------- */
  /* Deck.box(x, y, w, h, opts): an .sbox group (tinted rounded rect with an accent border, stacked text lines).
       opts.c     accent color name: ink|blue|green|violet|amber|red|grey|cc (default ink)
       opts.lines [[text, cls], ...] with cls 'lbl' (default, 24px), 't1' (30px title in the accent
                  color), 'm' (24px mono) or 'sm' (24px secondary, grey); text is raw SVG text, escape it yourself
       opts.top   baseline of the first line below y (default 38); opts.lh line height (default 34)
       opts.valign 'middle': the block of lines is centered vertically in the box (lh apart, top ignored)
       opts.from  step where it appears (data-from); opts.now step list where it is highlighted (data-now,
                  the stronger tint of the accent)
       opts.hero  true: when highlighted, solid accent fill with white text (at most one per slide)
       opts.cls   extra classes on the group; opts.labels 5 row labels instead of A-E .. U-Z.
     Row i also gets the class r<i> (or opts.rowCls[i]), so a slide can color the rows one by one */
  function box(x, y, w, h, o) {
    o = o || {};
    const lines = o.lines || [];
    const lh = o.lh || 34, top = o.top || 38, r = 10;
    const attrs = (o.from != null ? ` data-from="${o.from}"` : '') + (o.now != null ? ` data-now="${o.now}"` : '');
    const cls = 'sbox c-' + (o.c || 'ink') + (o.hero ? ' hero' : '') + (o.cls ? ' ' + o.cls : '');
    const mid = o.valign === 'middle';
    const ty = i => mid ? y + h / 2 + (i - (lines.length - 1) / 2) * lh : y + top + i * lh;
    const text = lines.map((l, i) =>
      `<text class="${l[1] || 'lbl'}" x="${x + 22}" y="${ty(i)}"${mid ? ' dominant-baseline="central"' : ''}>${l[0]}</text>`).join('');
    return `<g class="${cls}"${attrs}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>${text}</g>`;
  }
  /* Deck.frame(x, y, w, h, color, label, opts): an outline group in the accent color with its title,
     always visible (frames keep the layout stable while their contents appear by step).
       opts.tint  true: a light fill of the accent; opts.cls extra classes on the group */
  function frame(x, y, w, h, c, label, o) {
    o = o || {};
    return `<g class="frame c-${c}${o.tint ? ' tint' : ''}${o.cls ? ' ' + o.cls : ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/></g>` +
      (label ? `<text class="t1 c-${c}" x="${x + 24}" y="${y + 40}">${label}</text>` : '');
  }
  /* Deck.arrow(d, from, color): an arrow along SVG path d (e.g. 'M342 305 H428'), with the shared
     arrow head. from = step where it appears (omit for always visible), color = optional accent name. */
  function arrow(d, from, c) {
    return `<path class="arrow${c ? ' c-' + c : ''}" d="${d}"${from != null ? ` data-from="${from}"` : ''}/>`;
  }

  /* Deck.crown(x, y): the leader's crown (34 x 24, top-left at x, y), amber (see .crown in deck.css) */
  function crown(x, y) {
    return `<path class="crown" d="M${x} ${y + 24} L${x + 2} ${y + 6} L${x + 10} ${y + 14} L${x + 17} ${y} L${x + 24} ${y + 14} L${x + 32} ${y + 6} L${x + 34} ${y + 24} Z"/>`;
  }

  /* Deck.keyspace(x, y, w, filled, opts): the keyspace as a vertical strip of 5 rows A-E, F-J, K-O, P-T, U-Z
     (top to bottom), each a rounded rect of width w.
       filled     5 booleans, or a 5-char string of '1'/'0'; filled = tint fill + accent stroke, empty = dashed grey
       opts.rh    row height (default 34); opts.gap space between rows (default 6)
       opts.c     accent color name (default ink); opts.from step where it appears (data-from)
       opts.cls   extra classes on the group; opts.labels 5 row labels instead of A-E .. U-Z.
     Row i also gets the class r<i> (or opts.rowCls[i]), so a slide can color the rows one by one */
  function keyspace(x, y, w, filled, o) {
    o = o || {};
    const rh = o.rh || 34, gap = o.gap == null ? 6 : o.gap;
    const f = Array.from(filled, v => v === true || v === '1' || v === 1);
    const rows = (o.labels || ['A-E', 'F-J', 'K-O', 'P-T', 'U-Z']).map((k, i) => {
      const ry = y + i * (rh + gap), st = (f[i] ? 'on' : 'off') + ' ' + (o.rowCls ? o.rowCls[i] : `r${i}`);
      return `<rect class="${st}" x="${x}" y="${ry}" width="${w}" height="${rh}" rx="8"/>` +
        `<text class="m ${st}" x="${x + 14}" y="${ry + rh / 2}" dominant-baseline="central">${k}</text>`;
    }).join('');
    return `<g class="ks c-${o.c || 'ink'}${o.cls ? ' ' + o.cls : ''}"${o.from != null ? ` data-from="${o.from}"` : ''}>${rows}</g>`;
  }

  /* ---------- registry ---------- */
  function slide(def) {
    if (!def || !def.id) throw new Error('Deck.slide needs an id');
    if (slides.some(s => s.id === def.id)) console.warn('Deck: duplicate slide id ' + def.id);
    if (started) { console.warn('Deck.slide called after Deck.start: ' + def.id + ' ignored'); return; }
    slides.push(def);
  }

  let styleEl = null;
  function css(text) {
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'deck-slide-css'; document.head.appendChild(styleEl); }
    styleEl.appendChild(document.createTextNode(text + '\n'));
  }

  /* ---------- canvas ---------- */
  function fit() {
    const s = Math.min(innerWidth / 1600, innerHeight / 900);
    deckEl.style.setProperty('--s', s.toFixed(5));
  }

  /* ---------- steps ---------- */
  function paintSteps(sec, i) {
    sec.dataset.step = String(i);
    sec.querySelectorAll('[data-from],[data-until]').forEach(n => {
      const from = n.hasAttribute('data-from') ? Number(n.getAttribute('data-from')) : -Infinity;
      const until = n.hasAttribute('data-until') ? Number(n.getAttribute('data-until')) : Infinity;
      n.classList.toggle('st-on', i >= from && i <= until);
    });
    sec.querySelectorAll('[data-now]').forEach(n => {
      n.classList.toggle('now', n.getAttribute('data-now').split(/\s+/).includes(String(i)));
    });
  }

  function stepsOf(i) { return Math.max(1, slides[i].steps || 1); }

  function go(target, s) {
    if (!sections.length) return;
    let i = typeof target === 'string' ? sections.findIndex(x => x.id === target) : target;
    if (i < 0 || i == null || Number.isNaN(i)) return;
    i = Math.max(0, Math.min(sections.length - 1, i));
    const n = stepsOf(i);
    let k = s === 'last' ? n - 1 : (s || 0);
    k = Math.max(0, Math.min(n - 1, k));
    if (i !== idx) { if (idx >= 0) sections[idx].classList.remove('cur'); sections[i].classList.add('cur'); }
    idx = i; step = k;
    paintSteps(sections[i], k);
    deckEl.dataset.cur = slides[i].id;
    countEl.textContent = (i + 1) + ' / ' + sections.length;
    try { history.replaceState(null, '', '#' + slides[i].id + (k ? '/' + k : '')); } catch (e) { /* file:// may refuse */ }
    if (typeof slides[i].onStep === 'function') {
      try { slides[i].onStep(sections[i], k); } catch (e) { console.error('Deck: onStep of #' + slides[i].id + ' failed', e); }
    }
  }
  function next() { if (idx < 0) return; if (step < stepsOf(idx) - 1) go(idx, step + 1); else if (idx < sections.length - 1) go(idx + 1, 0); }
  function prev() { if (idx < 0) return; if (step > 0) go(idx, step - 1); else if (idx > 0) go(idx - 1, 'last'); }

  function fromHash() {
    const m = /^#([^/]+)(?:\/(\d+))?$/.exec(decodeURIComponent(location.hash || ''));
    if (!m || !sections.some(s => s.id === m[1])) return false;
    go(m[1], m[2] === undefined ? 0 : Number(m[2]));
    return true;
  }

  function start() {
    if (started) return;
    started = true;
    deckEl = document.getElementById('deck');
    const main = deckEl.querySelector('main');
    countEl = deckEl.querySelector('.foot-r');
    main.innerHTML = '';
    for (const s of slides) {
      const sec = el('section', { id: s.id, class: 'sec' + (s.cls ? ' ' + s.cls : ''), 'data-label': s.label || s.id });
      sec.innerHTML = typeof s.html === 'function' ? s.html() : (s.html || '');
      main.appendChild(sec);
      s.el = sec;
    }
    sections = slides.map(s => s.el);
    for (const s of slides) {
      if (typeof s.init !== 'function') continue;
      try { s.init(s.el); } catch (e) { console.error('Deck: init of #' + s.id + ' failed', e); }
    }
    fit();
    addEventListener('resize', fit);
    addEventListener('hashchange', fromHash);

    addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown' || k === 'Enter') next();
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') prev();
      else if (k === 'Home') go(0, 0);
      else if (k === 'End') go(sections.length - 1, 0);
      else if (k === 'f' || k === 'F') {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      } else return;
      e.preventDefault();
    });
    addEventListener('click', e => {
      if (e.target.closest && e.target.closest('a, button, input, select, textarea')) return;
      next();
    });

    if (!fromHash()) go(0, 0);
  }

  window.Deck = { slide, css, start, go, el, svg, esc, code, wait, prng, box, frame, arrow, crown, keyspace };
})();
