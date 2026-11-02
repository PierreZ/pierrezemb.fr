/* Part 1 slides. Reference slides for the patterns the others copy:
   1. hero (static) and 7. s-write (stepped SVG schema). */
(function () {
  'use strict';

  const { box, frame, arrow } = Deck;

  /* =====================================================================
     1. hero
     ===================================================================== */
  Deck.css(`
#hero{padding:0}
#hero .logos{position:absolute;left:100px;top:96px;display:flex;align-items:center;gap:48px}
#hero .logos .x{font-family:var(--fm);font-size:44px;font-weight:400;color:var(--ink2)}
#hero h1{position:absolute;left:100px;top:290px;margin:0;font-size:116px;font-weight:600;letter-spacing:-.035em;line-height:1.04}
#hero .by{position:absolute;left:100px;top:610px;margin:0;font-size:40px;font-weight:500}
#hero .date{position:absolute;left:100px;top:672px;margin:0;font-family:var(--fm);font-size:24px;font-weight:400;letter-spacing:.04em;color:var(--ink2)}
#hero .cc{position:absolute;right:100px;top:700px;height:72px}
`);
  Deck.slide({
    id: 'hero', label: 'Houston, we have a problem with etcd', cls: 'hero',
    html: `
<div class="logos"><img src="assets/img/etcd-logo.png" alt="etcd" height="104"><span class="x">×</span><img src="assets/img/kubernetes-logo.png" alt="Kubernetes" height="86"></div>
<h1>Houston, we have<br>a problem with etcd</h1>
<p class="by">Alexandre Burgoni and Pierre Zemb</p>
<p class="date">Cloud Nord 2026 · 30 October</p>
<img class="cc" src="assets/img/clever-cloud-logo.png" alt="Clever Cloud">`
  });

  /* =====================================================================
     2. s-who
     ===================================================================== */
  Deck.css(`
#s-who .cols{display:grid;grid-template-columns:1fr 1fr;gap:72px;margin-top:60px}
#s-who .bullets{font-size:30px}
#s-who .id{display:flex;align-items:center;gap:28px;margin-bottom:32px}
#s-who .id img{width:220px;height:220px;border-radius:14px;border:1.5px solid var(--edge);object-fit:cover}
#s-who .name{font-size:40px;font-weight:600;line-height:1.15}
`);
  Deck.slide({
    id: 's-who', label: 'Who are we?',
    html: `
<div class="sh"><h2>Who are we?</h2></div>
<div class="cols">
  <div>
    <div class="id"><img src="assets/img/speaker-alexandre.png" alt="Alexandre Burgoni"><div class="name">Alexandre Burgoni</div></div>
    <ul class="bullets c-cc">
      <li>SRE at Clever Cloud, distributed systems</li>
      <li>Co-organizes Sunny Tech</li>
    </ul>
  </div>
  <div>
    <div class="id"><img src="assets/img/speaker-pierre.png" alt="Pierre Zemb"><div class="name">Pierre Zemb</div></div>
    <ul class="bullets c-cc">
      <li>Staff Engineer at Clever Cloud, distributed systems</li>
      <li>OSS libraries in Rust</li>
    </ul>
  </div>
</div>`
  });

  /* =====================================================================
     2b. s-clever: the Clever Cloud logo, full screen
     ===================================================================== */
  Deck.css(`
#s-clever .logo{position:absolute;left:150px;top:281px;width:1300px;height:auto}
`);
  Deck.slide({
    id: 's-clever', label: 'Clever Cloud',
    html: `<img class="logo" src="assets/img/clever-cloud-logo.png" alt="Clever Cloud">`
  });

  /* =====================================================================
     3. s-meme
     ===================================================================== */
  Deck.css(`
#s-meme .meme{position:absolute;left:50%;top:160px;height:640px;transform:translateX(-50%);border:1.5px solid var(--edge);border-radius:14px}
`);
  Deck.slide({
    id: 's-meme', label: 'Kubernetes × etcd',
    html: `
<div class="sh"><h2>Kubernetes × etcd</h2></div>
<img class="meme" src="assets/img/meme-k8s-etcd.png" alt="Kubernetes and etcd handshake meme">`
  });

  /* =====================================================================
     4. s-etcd
     ===================================================================== */
  Deck.css(`
#s-etcd .logo{position:absolute;right:80px;top:52px;height:104px}
#s-etcd .bullets{position:absolute;left:80px;right:80px;top:200px;bottom:0;display:flex;flex-direction:column;justify-content:center;font-size:44px}
#s-etcd .bullets>li{margin-bottom:44px}
#s-etcd .bullets>li::before{width:14px;height:14px}
`);
  Deck.slide({
    id: 's-etcd', label: 'etcd at a glance',
    html: `
<div class="sh"><h2>etcd at a glance</h2></div>
<img class="logo" src="assets/img/etcd-logo.png" alt="etcd">
<ul class="bullets c-blue">
  <li>A strongly <b>consistent</b>, <b>distributed</b> key-value store</li>
  <li>Started by CoreOS in 2013</li>
  <li>CNCF <b>graduated</b></li>
</ul>`
  });

  /* =====================================================================
     5. s-k8s: who talks to etcd (3 steps)
     Top row: client, API server, etcd. Bottom row: the components fed by watch.
     ===================================================================== */
  const comps = ['Controller manager', 'Scheduler', 'Kubelet', 'Operators'];
  const compX = i => 130 + i * 350;  // 290 wide, 60 apart, from 130 to 1470
  Deck.css(`
#s-k8s svg.full{--dy:70px}
`);
  Deck.slide({
    id: 's-k8s', label: 'Kubernetes × etcd', cls: 'big', steps: 3,
    html: `
<div class="sh"><h2>Kubernetes × etcd</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${box(120, 210, 260, 100, { c: 'ink', valign: 'middle', lines: [['Client', 't1']] })}
  ${box(620, 210, 360, 100, { c: 'blue', valign: 'middle', lines: [['API server', 't1']] })}
  ${box(1220, 210, 260, 100, { c: 'blue', now: 2, hero: true, valign: 'middle', lines: [['etcd', 't1']] })}
  ${arrow('M382 260 H616')}
  <text class="lbl" x="499" y="245" text-anchor="middle">write</text>
  ${arrow('M982 244 H1216')}
  <text class="lbl" x="1099" y="229" text-anchor="middle">persist</text>
  ${arrow('M1218 280 H984', 1)}
  <text class="lbl" x="1099" y="309" text-anchor="middle" data-from="1">watch</text>

  <path class="line" d="M800 312 V430 M275 430 H1325" data-from="1"/>
  ${comps.map((_, i) => arrow(`M${compX(i) + 145} 430 V496`, 1)).join('')}
  <text class="sm" x="818" y="388" data-from="1">every change pushed, no polling</text>
  ${comps.map((n, i) => `<g data-from="1">${box(compX(i), 500, 290, 110, { c: 'blue', lines: [[n, 'lbl']], top: 46 })}</g>
  <text class="sm" x="${compX(i) + 22}" y="586" data-from="2">own cache</text>`).join('')}
</svg>`
  });

  /* =====================================================================
     6. s-listwatch: one cache per resource, each built the same way: list, then watch (3 steps,
     happy path only). The scheduler's caches, the API server's watch caches, etcd; only the pods
     cache is opened, the other resources are closed boxes. Messages cross the gaps, their labels
     sit in the gap above the arrow.
     ===================================================================== */
  const LW = { s: [98, 234], a: [640, 320], e: [1300, 240] };  // x, w of the three columns
  // the opened pods cache of column g: the running example's pods, pods/api from step 2
  const lwPods = (g, title, shown) => {
    const [x, w] = g;
    return box(x, 240, w, 300, { c: 'blue', lines: [[title, 't1']] }) +
      ['pods/db', 'pods/web', 'pods/api'].map((p, i) =>
        `<text class="rm" x="${x + 22}" y="${340 + i * 56}" data-from="${i < 2 ? shown : 2}">${p}</text>`).join('');
  };
  // a closed cache: another resource, same list then watch, not opened
  const lwRes = (g, y, name) => box(g[0], y, g[1], 56, { c: 'blue', valign: 'middle', lines: [[name, 'lbl']] });
  /* a message across a gap at height y, label centered above; reply = dashed */
  const lw = (x1, x2, y, label, at, reply) => {
    const d = x2 > x1 ? 4 : -4;
    return `<path class="arrow${reply ? ' reply' : ''}" d="M${x1 + d / 2} ${y} H${x2 - d}" data-from="${at}"/>` +
      `<text class="lwl${reply ? ' rep' : ''}" x="${(x1 + x2) / 2}" y="${y - 12}" text-anchor="middle" data-from="${at}">${label}</text>`;
  };
  Deck.css(`
#s-listwatch svg.full{--dy:25px}
#s-listwatch svg .rm{font-family:var(--fm);font-size:26px}
#s-listwatch svg .rm.rep{fill:var(--ink2)}
#s-listwatch svg .lwl{font-family:var(--fm);font-size:26px}
#s-listwatch svg .lwl.rep{fill:var(--ink2)}
#s-listwatch svg .cn{font-weight:700;fill:var(--blue)}
#s-listwatch svg .rule{stroke:var(--blue);stroke-opacity:.3;stroke-width:1.5px}
`);
  Deck.slide({
    id: 's-listwatch', label: 'List, then watch', cls: 'big', steps: 3,
    html: `
<div class="sh"><h2>List, then watch</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${frame(80, 150, 270, 550, 'blue', 'scheduler')}
  <text class="sm" x="104" y="216">or any operator</text>
  ${frame(620, 150, 360, 550, 'blue', 'API server')}
  ${lwPods(LW.s, 'pods cache', 1)}
  ${lwRes(LW.s, 556, 'nodes cache')}
  ${lwPods(LW.a, 'pods cache', 0)}
  ${lwRes(LW.a, 556, 'services cache')}
  ${lwRes(LW.a, 624, 'configmaps cache')}
  ${box(LW.e[0], 240, LW.e[1], 440, { c: 'blue', lines: [['etcd', 't1']] })}
  ${['pods/db', 'pods/web', 'pods/api'].map((p, i) =>
    `<text class="rm" x="${LW.e[0] + 22}" y="${340 + i * 56}" data-from="${i < 2 ? 0 : 2}">${p}</text>`).join('')}
  <line class="rule" x1="${LW.e[0] + 20}" x2="${LW.e[0] + LW.e[1] - 20}" y1="500" y2="500"/>
  ${['nodes/…', 'services/…', 'configmaps/…'].map((p, i) =>
    `<text class="rm rep" x="${LW.e[0] + 22}" y="${552 + i * 46}">${p}</text>`).join('')}

  ${lw(960, 1300, 290, '<tspan class="cn">LIST</tspan> pods', 0)}
  ${lw(1300, 960, 360, 'all pods', 0, true)}
  ${lw(1300, 960, 430, '<tspan class="cn">WATCH</tspan> pods', 0)}

  ${lw(332, 640, 290, '<tspan class="cn">LIST</tspan> pods', 1)}
  ${lw(640, 332, 360, 'all pods', 1, true)}
  ${lw(640, 332, 430, '<tspan class="cn">WATCH</tspan> pods', 1)}

  ${lw(1300, 960, 520, 'PUT pods/api', 2)}
  <text class="lwl" x="1130" y="478" text-anchor="middle" data-from="2"><tspan class="cn">WATCH</tspan> event</text>
  ${lw(640, 332, 520, 'PUT pods/api', 2)}
  <text class="lwl" x="486" y="478" text-anchor="middle" data-from="2"><tspan class="cn">WATCH</tspan> event</text>
  <text class="sm" x="790" y="750" text-anchor="middle" data-from="2">one cache per resource, one etcd watch, many watchers</text>
</svg>`
  });

  /* =====================================================================
     7. s-apply: what a kubectl apply asks of etcd (3 steps), a sequence diagram.
     Columns: kubectl, the API server (one frame: handler + watch cache), etcd, the watchers.
     One exchange per step, stacked from the top: Range, Txn, Watch. The current exchange sits
     on an amber band; the earlier ones stay above it. Lifelines take their column's color.
     ===================================================================== */
  // lifeline x of each column; the handler to etcd labels sit between the API server frame's
  // right edge (830) and the etcd lifeline, so no line runs through them
  const SQ = { k: 165, h: 495, c: 705, e: 1180, w: 1395, le: 1005, lw: 1287 };
  /* a message from lifeline x1 to x2 at height y, its label above, centered between the lifelines
     (at lx if given; anchor 'start' puts its left end at lx); reply = dashed. Appears at step `at`
     and stays. The label has a white halo so it stays readable across a lifeline. */
  const call = (x1, x2, y, label, at, reply, lx, anchor) => {
    const d = x2 > x1 ? 4 : -4;
    return `<path class="arrow${reply ? ' reply' : ''}" d="M${x1 + d / 2} ${y} H${x2 - d}" data-from="${at}"/>` +
      `<text class="call${reply ? ' rep' : ''}" x="${lx || (x1 + x2) / 2}" y="${y - 12}" text-anchor="${anchor || 'middle'}" data-from="${at}">${label}</text>`;
  };
  const note = (x, y, text, at) => `<text class="sm" x="${x}" y="${y}" text-anchor="middle" data-from="${at}">${text}</text>`;
  /* the band under the exchange of step `at`, from y1 to y2 */
  const band = (y1, y2, at) => `<rect class="band" x="100" y="${y1}" width="1420" height="${y2 - y1}" rx="12" data-from="${at}" data-until="${at}"/>`;
  const life = (x, c) => `<path class="life c-${c}" d="M${x} 286 V846"/>`;
  Deck.css(`
#s-apply svg .call{font-family:var(--fm);font-size:26px}
#s-apply svg .call.rep{fill:var(--ink2)}
#s-apply svg .cn{font-weight:700;fill:var(--blue)}
#s-apply svg .life{fill:none;stroke:var(--c);stroke-opacity:.35;stroke-width:3.6px}
#s-apply svg .band{fill:color-mix(in srgb,var(--amber) 12%,#fff)}
`);
  Deck.slide({
    id: 's-apply', label: 'What happens during a kubectl apply', steps: 3,
    html: `
<div class="sh"><h2>What happens during a kubectl apply</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${band(292, 466, 0)}${band(470, 700, 1)}${band(748, 846, 2)}
  ${frame(400, 150, 430, 700, 'blue', 'API server', { tint: true })}
  ${life(SQ.k, 'ink')}${life(SQ.h, 'blue')}${life(SQ.c, 'blue')}${life(SQ.e, 'blue')}${life(SQ.w, 'blue')}
  ${box(80, 200, 170, 84, { c: 'ink', valign: 'middle', lines: [['kubectl', 't1']] })}
  ${box(415, 200, 160, 84, { c: 'blue', valign: 'middle', lines: [['handler', 't1']] })}
  ${box(600, 200, 210, 84, { c: 'blue', valign: 'middle', lines: [['watch cache', 't1']] })}
  ${box(1110, 200, 140, 84, { c: 'blue', valign: 'middle', lines: [['etcd', 't1']] })}
  ${box(1270, 200, 250, 84, { c: 'blue', valign: 'middle', lh: 30, lines: [['watchers', 't1'], ['scheduler, kubelet', 'sm']] })}

  <text class="sm" x="${(SQ.h + SQ.c) / 2}" y="314" text-anchor="middle">LIST, WATCH:</text>
  <text class="sm" x="${(SQ.h + SQ.c) / 2}" y="340" text-anchor="middle">served from here</text>

  ${call(SQ.k, SQ.h, 332, 'GET pods/web', 0, false, SQ.k + 10, 'start')}
  ${call(SQ.h, SQ.e, 378, '<tspan class="cn">Range</tspan> pods/web', 0, false, SQ.le)}
  ${call(SQ.e, SQ.h, 424, 'v1 @101', 0, true, SQ.le)}
  ${note(SQ.le, 454, '@101 = its resourceVersion', 0)}

  ${call(SQ.k, SQ.h, 506, 'PATCH pods/web', 1, false, SQ.k + 10, 'start')}
  ${call(SQ.h, SQ.c, 550, 'get pods/web', 1)}
  ${call(SQ.c, SQ.h, 594, 'v1 @101', 1, true)}
  ${call(SQ.h, SQ.e, 638, '<tspan class="cn">Txn</tspan>: if @101, put v2', 1, false, SQ.le)}
  ${call(SQ.e, SQ.h, 682, 'ok, rev 103', 1, true, SQ.le)}

  ${call(SQ.e, SQ.c, 784, '<tspan class="cn">Watch</tspan>: PUT web @103', 2, false, SQ.le)}
  ${call(SQ.c, SQ.w, 826, 'PUT web @103', 2, false, SQ.lw)}
  ${note(SQ.lw, 712, 'one etcd watch,', 2)}
  ${note(SQ.lw, 738, 'many watchers', 2)}
</svg>`
  });

  /* =====================================================================
     7. s-raft (3 steps) and 8. s-write (3 steps) share one picture: the API server on the left,
     the leader (crown) in the middle, etcd-2 and etcd-3 stacked on the right, every member with
     its log (db, web v1, ev1, then web v2: the running example). s-write opens the leader to show
     the history box (bbolt) below its log, drawn by the same code as s-storage, at the same x and
     width, so slide 9 shows the same box. No quorum on these slides: the followers are in sync.
     ===================================================================== */
  const RAPI = [120, 190, 240, 140];  // the API server box (slide 9's, 20px narrower)
  const RN = { l: [420, 190, 520, 130], e2: [1000, 190, 480, 130], e3: [1000, 390, 480, 130] };
  const SLOT = { w: 100, h: 42, gap: 8, top: 62 };  // the log slots, below the node title
  const LOG = ['db', 'web v1', 'ev1'];  // already in every log; web v2 lands in the 4th slot
  const slotX = (g, i) => g[0] + 20 + i * (SLOT.w + SLOT.gap);
  const slotY = g => g[1] + SLOT.top;
  /* a node [x, y, w, h]: box (h overridden for the opened leader), optional crown, title, "log",
     the three entries of the example and an empty 4th slot */
  function raftNode(g, c, title, withCrown, h) {
    const [x, y, w] = g;
    return box(x, y, w, h || g[3], { c }) +
      (withCrown ? Deck.crown(x + 22, y + 22) : '') +
      `<text class="t1 c-${c}" x="${x + (withCrown ? 68 : 22)}" y="${y + 44}">${title}</text>` +
      `<text class="sm" x="${x + w - 22}" y="${y + 44}" text-anchor="end">log</text>` +
      [0, 1, 2, 3].map(i => `<rect class="slot" x="${slotX(g, i)}" y="${slotY(g)}" width="${SLOT.w}" height="${SLOT.h}" rx="6"/>` +
        (LOG[i] ? `<text class="ent" x="${slotX(g, i) + SLOT.w / 2}" y="${slotY(g) + 29}" text-anchor="middle">${LOG[i]}</text>` : '')).join('');
  }
  /* the new entry "web v2" in the 4th slot, tinted: appears at step from */
  function raftEntry(g, c, from) {
    const x = slotX(g, 3), y = slotY(g);
    return `<g class="entry c-${c}" data-from="${from}"><rect x="${x}" y="${y}" width="${SLOT.w}" height="${SLOT.h}" rx="6"/>` +
      `<text class="ent" x="${x + SLOT.w / 2}" y="${y + 29}" text-anchor="middle">web v2</text></g>`;
  }
  /* the API server box with its request, and the arrow into the leader */
  const raftApi = (from, now) =>
    box(RAPI[0], RAPI[1], RAPI[2], RAPI[3], { c: 'blue', from, now, lines: [['API server', 't1'], ['put pods/web v2', 'lbl']], lh: 38, top: 46 }) +
    arrow('M362 260 H416', from);
  /* the leader copies the entry to both followers (log to log) */
  const raftCopies = from => arrow('M942 273 H996', from) + arrow('M942 305 H970 V473 H996', from);
  Deck.css(`
:is(#s-raft,#s-write) svg .slot{fill:#fff;stroke:var(--c);stroke-opacity:.45;stroke-width:2.4px}
:is(#s-raft,#s-write) svg .entry rect{fill:var(--hi);stroke:var(--c);stroke-width:2.4px}
:is(#s-raft,#s-write) svg .ent{font-family:var(--fm);font-size:24px}
`);
  Deck.slide({
    id: 's-raft', label: 'etcd, powered by Raft', cls: 'big', steps: 3,
    html: `
<div class="sh"><h2>etcd, powered by Raft</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${raftNode(RN.l, 'amber', 'etcd-1 · leader', true)}
  ${raftNode(RN.e2, 'blue', 'etcd-2 · follower')}
  ${raftNode(RN.e3, 'blue', 'etcd-3 · follower')}

  ${raftApi(1)}
  ${raftEntry(RN.l, 'amber', 1)}

  ${raftCopies(2)}
  ${raftEntry(RN.e2, 'blue', 2)}
  ${raftEntry(RN.e3, 'blue', 2)}
  <text class="sm" x="1020" y="556" data-from="2">the same log on every member</text>
</svg>`
  });

  /* =====================================================================
     9 to 11. s-storage, s-watch, s-scan share one picture: the API server slot on the left,
     the history (bbolt, disk, by revision) in the middle, the index (memory, by key) on the
     right, with the same rows. stg() draws the two boxes; only the per-row options change.
     The index is only introduced on s-scan (o.noIx leaves its slot empty on the other two).
     s-write (8) draws the same history box inside the leader.
     ===================================================================== */
  const ST = {
    api: [120, 200, 260, 140],  // the API server request
    ans: [120, 390, 260, 170],  // what comes back to the API server
    // the two boxes; rows every 58px, row i is centered at 333 + i * 58
    bb: { x: 440, w: 480, y: 200, h: 360, row0: 304, rowh: 58 },
    ix: { x: 1000, w: 480, y: 200, h: 360, row0: 304, rowh: 58 }
  };
  const BB = [['rev 100', 'pods/db'], ['rev 101', 'pods/web v1'], ['rev 102', 'events/ev1'], ['rev 103', 'pods/web v2']];
  const IX = [['events/ev1', '→ 102'], ['pods/db', '→ 100'], ['pods/web', '→ 101, <tspan class="last">103</tspan>']];

  const stepAttrs = o => (o.from != null ? ` data-from="${o.from}"` : '') + (o.now != null ? ` data-now="${o.now}"` : '');
  /* a row: plain text on a thin rule; .now tints it. g: box geometry { x, w, row0, rowh } */
  function stRow(g, i, c, a, b, bx, o) {
    const { x, w, rowh } = g, y = g.row0 + i * rowh, base = y + rowh / 2 + 9;
    return `<g class="srow r${i} c-${c}"${stepAttrs(o)}>` +
      `<rect class="rbg" x="${x + 14}" y="${y + 4}" width="${w - 28}" height="${rowh - 8}" rx="6"/>` +
      (i ? `<line class="rule" x1="${x + 20}" x2="${x + w - 20}" y1="${y}" y2="${y}"/>` : '') +
      `<text class="rm" x="${x + 32}" y="${base}">${a}</text><text class="rm" x="${x + bx}" y="${base}">${b}</text>` +
      (o.note ? `<text class="note" x="${x + w - 30}" y="${base - 2}" text-anchor="end"${o.noteFrom != null ? ` data-from="${o.noteFrom}"` : ''}>${o.note}</text>` : '') +
      `</g>`;
  }
  /* opens a group with the box; the caller adds the rows and closes it */
  function stBox(g, c, title, sub, cls, from, until) {
    return `<g${from != null ? ` data-from="${from}"` : ''}${until != null ? ` data-until="${until}"` : ''} class="${cls}">` +
      box(g.x, g.y, g.w, g.h, { c, lines: [[title, 't1'], [sub, 'sm']], lh: 38, top: 50 });
  }
  /* the bbolt box alone (also used inside the leader on s-write), drawn as a key-value table: a
     "key | value" header row (BB_HEAD tall, so the box is BB_HEAD taller than g and its rows
     BB_HEAD lower) and a divider between the two columns */
  const BB_HEAD = 40;
  function bbolt(g, rows, from, until) {
    const t = Object.assign({}, g, { h: g.h + BB_HEAD, row0: g.row0 + BB_HEAD }), bx = 160, dx = g.x + bx - 16;
    return stBox(t, 'green', 'history, by revision', 'bbolt · disk', 'bbbox', from, until) +
      `<g class="c-green"><text class="bbh" x="${g.x + 32}" y="${t.row0 - 12}">key</text>` +
      `<text class="bbh" x="${g.x + bx}" y="${t.row0 - 12}">value</text>` +
      `<line class="rule bbhr" x1="${g.x + 20}" x2="${g.x + g.w - 20}" y1="${t.row0}" y2="${t.row0}"/></g>` +
      BB.map((r, i) => stRow(t, i, 'green', r[0], r[1], bx, rows[i] || {})).join('') +
      `<line class="rule c-green" x1="${dx}" x2="${dx}" y1="${g.row0 + 6}" y2="${t.row0 + BB.length * g.rowh - 6}"/></g>`;
  }
  /* the index box at geometry g (ST.ix, or ST.bb's slot on s-scan) */
  const index = (g, rows, from, ic) => stBox(g, ic, 'where is key X?', 'index · memory', 'ixbox', from) +
    IX.map((r, i) => stRow(g, i, ic, r[0], r[1], 240, rows[i] || {})).join('') + `</g>`;
  /* o.bb[i], o.ix[i]: per-row { from, now, note, noteFrom }; o.bbFrom, o.ixFrom: when a box appears;
     o.noIx: no index box. */
  function stg(o) {
    return bbolt(ST.bb, o.bb || [], o.bbFrom) + (o.noIx ? '' : index(ST.ix, o.ix || [], o.ixFrom, 'violet'));
  }
  function stApi(lines, o) {
    const [x, y, w, h] = ST.api;
    return box(x, y, w, h, Object.assign({ c: 'blue', lines: [['API server', 't1']].concat(lines), lh: 38, top: 46 }, o || {}));
  }
  function stAns(title, lines, from) {
    const [x, y, w, h] = ST.ans;
    return box(x, y, w, h, { c: 'blue', from, lines: [[title, 't1']].concat(lines.map(l => [l, 'rm'])), lh: 38, top: 46 });
  }

  Deck.css(`
:is(#s-storage,#s-watch,#s-scan) svg.full{--dy:90px}
:is(#s-write,#s-storage,#s-watch,#s-scan) svg .rm{font-family:var(--fm);font-size:24px;font-weight:400}
:is(#s-write,#s-storage,#s-watch,#s-scan) svg .note{font-size:24px;font-weight:400;fill:var(--ink2)}
:is(#s-write,#s-storage,#s-watch,#s-scan) svg .hop{font-size:26px;font-weight:600}
:is(#s-write,#s-storage,#s-watch,#s-scan) svg .rbg{fill:transparent}
:is(#s-write,#s-storage,#s-watch,#s-scan) svg .rule{stroke:var(--c);stroke-opacity:.3;stroke-width:1.5px}
:is(#s-write,#s-storage,#s-watch,#s-scan) svg .srow.now .rbg{fill:var(--hi);stroke:var(--c);stroke-width:2.4px}
:is(#s-write,#s-storage,#s-watch,#s-scan) svg .bbh{font-size:24px;font-weight:400;fill:var(--ink2)}
:is(#s-write,#s-storage,#s-watch,#s-scan) svg .bbhr{stroke-opacity:.55;stroke-width:2.2px}
`);

  /* =====================================================================
     8. s-write: the write of slide 7, then what the leader does with it (4 steps)
     Steps 1 and 2 replay slide 7 (send to the leader, copied to both followers); the leader is
     opened to show the history box (slide 9's bbolt box, same x and width) below its log: apply
     lands rev 103 there, then the reply.
     ===================================================================== */
  const WB = Object.assign({}, ST.bb, { y: 340, row0: 340 + ST.bb.row0 - ST.bb.y });  // slide 9's history box, inside the leader
  const WL = { x: slotX(RN.l, 3) + SLOT.w / 2, h: WB.y + WB.h + BB_HEAD + 16 - RN.l[1] };  // the apply arrow x, the opened leader's height
  Deck.slide({
    id: 's-write', label: 'Writing to etcd', cls: 'big', steps: 4,
    html: `
<div class="sh"><h2>Writing to etcd</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${raftNode(RN.l, 'amber', 'etcd-1 · leader', true, WL.h)}
  ${raftNode(RN.e2, 'blue', 'etcd-2 · follower')}
  ${raftNode(RN.e3, 'blue', 'etcd-3 · follower')}

  ${raftApi(undefined, '0 3')}
  ${raftEntry(RN.l, 'amber', 0)}
  ${raftCopies(1)}
  ${raftEntry(RN.e2, 'blue', 1)}
  ${raftEntry(RN.e3, 'blue', 1)}

  ${arrow(`M${WL.x} ${slotY(RN.l) + SLOT.h + 4} V${WB.y - 4}`, 2)}
  <text class="sm" x="${WL.x + 14}" y="${WB.y - 16}" data-from="2">apply</text>
  ${bbolt(WB, [{}, {}, {}, { from: 2, now: 2 }])}

  <path class="arrow reply" d="M${RN.l[0] - 2} 700 H250 V${RAPI[1] + RAPI[3] + 4}" data-from="3"/>
  <text class="lbl" x="268" y="688" data-from="3">ok, rev 103</text>
</svg>`
  });

  /* 9. s-storage: the history alone (2 steps) */
  Deck.slide({
    id: 's-storage', label: 'Inside etcd: the history', cls: 'big', steps: 2,
    html: `
<div class="sh"><h2>Inside etcd: the history</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${stApi([['put pods/web v2', 'lbl']], { from: 1 })}
  ${arrow('M382 270 H408 V547 H436', 1)}
  ${stg({ bb: [{}, {}, {}, { from: 1, now: 1 }], noIx: true })}
</svg>`
  });

  /* 10. s-watch: catch up is one read of the history in revision order (2 steps) */
  Deck.css(`
#s-watch .bbbox .r2 text{fill:var(--ink2)}
`);
  Deck.slide({
    id: 's-watch', label: 'Watching is easy', cls: 'big', steps: 2,
    html: `
<div class="sh"><h2>Watching is easy</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${stApi([['watch pods/', 'lbl'], ['from rev 100', 'rm']])}
  ${arrow('M382 270 H436')}
  ${stg({ bb: [{ now: 0 }, { now: 0 }, { note: 'skipped' }, { now: 0 }], noIx: true })}
  <path class="arrow c-green" d="M960 346 V576" data-until="0"/>
  ${stAns('events', ['PUT db @100', 'PUT web @101', 'PUT web @103'])}
  <path class="arrow" d="M436 475 H384" data-until="0"/>
  ${box(120, 620, 400, 76, { c: 'blue', cls: 'hl', from: 1, valign: 'middle', lines: [['+ new writes, pushed live', 'lbl']] })}
</svg>`
  });

  /* 11. s-scan: list = the index first, then one lookup per key in the history (4 steps).
     The index sits between the API server and the history, which moves to the right slot at step 1. */
  Deck.css(`
#s-scan[data-step="3"] .bbbox .r1 text,#s-scan[data-step="3"] .bbbox .r2 text{fill:var(--ink2)}
#s-scan[data-step="2"] .last,#s-scan[data-step="3"] .last{text-decoration:underline;font-weight:600}
`);
  const SCAN_H = Object.assign({}, ST.bb, { x: ST.ix.x });  // the history in the right slot
  Deck.slide({
    id: 's-scan', label: 'Listing is less simple', cls: 'big', steps: 4,
    html: `
<div class="sh"><h2>Listing is less simple</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${stApi([['list pods/', 'lbl']])}
  ${bbolt(ST.bb, [{ now: 0 }, { now: 0 }, {}, { now: 0 }], undefined, 0)}
  ${bbolt(SCAN_H, [{ now: 3 }, { note: 'not read', noteFrom: 3 }, { note: 'not read', noteFrom: 3 }, { now: 3 }], 1)}
  ${index(ST.bb, [{}, { now: '2 3' }, { now: '2 3' }], 1, 'violet')}
  <text class="sm" x="${ST.bb.x + ST.bb.w / 2}" y="640" text-anchor="middle" data-until="0">ordered by revision, not by key</text>
  ${arrow('M250 198 V168 H680 V196', 2, 'violet')}
  <text class="hop" x="465" y="158" text-anchor="middle" data-from="2" style="fill:var(--violet)">hop 1</text>
  ${arrow('M908 391 H950 V373 H1008', 3, 'green')}
  ${arrow('M908 449 H970 V547 H1008', 3, 'green')}
  <text class="hop" x="960" y="292" text-anchor="middle" data-from="3" style="fill:var(--green)">hop 2</text>
  ${stAns('2 lookups', ['pods/db @100', 'pods/web @103'], 3)}
  ${arrow('M1240 604 V656 H250 V564', 3)}
</svg>`
  });
})();
