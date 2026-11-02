/* Part 3 slides: Materia etcd (17 to 24) and close (25 to 27).
   Each slide is a Deck.slide({ id, label, steps, html }) call, styled with Deck.css scoped under #<slide-id>. */
(function () {
  'use strict';

  const { box, frame, arrow } = Deck;

  // Used by the autoplay slide s-oracle: a pause that reports whether the
  // run is still alive, and chips flying along polylines (canvas units), eased; a stopped run
  // removes them.
  const pause = (ms, alive) => Deck.wait(ms).then(() => alive());
  function pathLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
  function pointAt(p, d) {
    for (let i = 1; i < p.length; i++) {
      const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (d <= l || i === p.length - 1) { const f = l ? Math.min(1, d / l) : 1; return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f]; }
      d -= l;
    }
    return p[p.length - 1];
  }
  function fly(g, p, ms, alive) {
    const L = pathLen(p);
    return new Promise(resolve => {
      const t0 = performance.now();
      function frame(now) {
        if (!alive()) { g.remove(); resolve(false); return; }
        const f = Math.min(1, (now - t0) / ms), e = f < .5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
        const q = pointAt(p, e * L);
        g.setAttribute('transform', `translate(${q[0].toFixed(1)} ${q[1].toFixed(1)})`);
        if (f < 1) requestAnimationFrame(frame); else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  }

  /* =====================================================================
     17. s-cke: the question alone, then the CKE card
     ===================================================================== */
  Deck.css(`
#s-cke .ask{position:absolute;left:0;right:0;top:340px;text-align:center;font-size:104px;font-weight:600;letter-spacing:-.03em;line-height:1.1}
#s-cke .card{position:absolute;top:190px;height:600px}
#s-cke .logo{left:80px;width:620px;display:flex;align-items:center;justify-content:center}
#s-cke .logo img{height:500px}
#s-cke .what{left:740px;width:780px;padding:60px 50px}
#s-cke .what h3{margin:0 0 30px;font-size:60px;font-weight:600;letter-spacing:-.02em;line-height:1.1}
#s-cke .what p{margin:0;font-size:34px;line-height:1.35}
`);
  Deck.slide({
    id: 's-cke', label: 'What about Clever Cloud?', steps: 2,
    html: `
<div class="ask" data-until="0">What about Clever Cloud?</div>
<div class="sh" data-from="1"><h2>What about Clever Cloud?</h2></div>
<div class="card box c-ink logo" data-from="1"><img src="assets/img/cke-cube.png" alt="CKE"></div>
<div class="card box c-cc what" data-from="1"><h3>Clever Kubernetes Engine</h3><p>Kubernetes as a Service powered by our home-made serverless etcd</p></div>`
  });

  /* =====================================================================
     19. s-cke-etcd: a CKE cluster has no etcd, its API server talks mTLS to one shared Materia
     etcd, where the cluster is a key prefix inside one FoundationDB keyspace (rows, not servers).
     The tenant is the client certificate's CN (materia-etcd-lib/src/server/mutual_tls.rs:45).
     ===================================================================== */
  const CK = { x: 1020, y: 269, w: 450, rh: 62, gap: 10 };
  const ckRow = (i, t, on) => {
    const y = CK.y + i * (CK.rh + CK.gap);
    return box(CK.x, y, CK.w, CK.rh, { c: on ? 'blue' : 'grey', cls: on ? 'hl' : '', valign: 'middle', lines: [[t, 'm']] });
  };
  const lock = (x, y) => `<g class="lock" transform="translate(${x} ${y})"><rect x="0" y="11" width="22" height="15" rx="3"/><path d="M4 11 V8 a7 7 0 0 1 14 0 V11"/></g>`;
  Deck.css(`
#s-cke-etcd svg .lock rect{fill:var(--blue)}
#s-cke-etcd svg .lock path{fill:none;stroke:var(--blue);stroke-width:3px}
#s-cke-etcd svg .tls{font-family:var(--fm);font-size:24px;fill:var(--blue)}
`);
  Deck.slide({
    id: 's-cke-etcd', label: 'A CKE cluster has no etcd',
    html: `
<div class="sh"><h2>A CKE cluster has no etcd</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  <g transform="translate(0 65)">
  ${frame(120, 180, 440, 210, 'ink', 'Hypervisor 1')}
  ${box(150, 240, 380, 120, { c: 'blue', valign: 'middle', lines: [['API server', 't1'], ['cluster A', 'sm']], lh: 34 })}
  ${frame(120, 440, 440, 210, 'ink', 'Hypervisor 2')}
  ${box(150, 500, 380, 120, { c: 'blue', valign: 'middle', lines: [['API server', 't1'], ['cluster B', 'sm']], lh: 34 })}

  ${frame(1000, 180, 500, 470, 'blue', 'Materia etcd', { tint: true })}
  <text class="sm" x="1024" y="252">stateless, shared by every cluster</text>
  ${ckRow(0, 'kubernetes_01jc8r2k4m/ …', true)}
  ${ckRow(1, 'kubernetes_01jcb5n8wd/ …', true)}
  ${ckRow(2, 'kubernetes_01jcd7q3xt/ …', false)}
  ${ckRow(3, '…', false)}
  <text class="sm" x="1024" y="594">one FoundationDB keyspace,</text>
  <text class="sm" x="1024" y="624">a cluster = a key prefix</text>

  ${arrow('M532 300 H1016', null, 'blue')}
  ${lock(548, 258)}<text class="tls" x="580" y="284">CN = kubernetes_01jc8r2k4m</text>
  ${arrow('M532 560 H975 V372 H1016', null, 'blue')}
  ${lock(548, 518)}<text class="tls" x="580" y="544">CN = kubernetes_01jcb5n8wd</text>
  </g>
</svg>`
  });

  // Canvas layout: load balancer, instances row, stateless/stateful line, FoundationDB frame, machines.
  const AS = { x0: 80, x1: 1520, lb: 70, sy: 205, sw: 190, sh: 100, line: 345, fy: 385, fh: 345, my: 452, mw: 248, mh: 250, dw: 103, dh: 52 };

  /* The traffic picture, shared by s-bench-limits and s-v2 so they cannot drift: markup strings in
     canvas units. A group placed with o.x/o.y gets a transform attribute. o.from = data-from,
     o.cls extra classes, o.attrs raw extra attributes. */
  const asAt = o => (o.x != null ? ` transform="translate(${o.x} ${o.y})"` : '') +
    (o.from != null ? ` data-from="${o.from}"` : '') + (o.attrs || '');
  // the load balancer bar across the canvas, top at y
  const asLb = y => `<g class="as-lb c-ink"><rect class="bx" x="${AS.x0}" y="${y}" width="${AS.x1 - AS.x0}" height="60" rx="10"/>` +
    `<text x="800" y="${y + 39}" text-anchor="middle">load balancer</text></g>`;
  // a Materia etcd instance, o.w x o.h (default AS.sw x AS.sh); o.inner = extra markup in its own coordinates
  const asInst = (o = {}) => {
    const w = o.w || AS.sw, h = o.h || AS.sh;
    return `<g class="as-inst c-blue${o.cls ? ' ' + o.cls : ''}"${asAt(o)}><rect class="bx" width="${w}" height="${h}" rx="10"/>` +
      `<text class="nm" x="${w / 2}" y="44" text-anchor="middle">Materia etcd</text>` +
      `<text class="sm" x="${w / 2}" y="78" text-anchor="middle">stateless</text>${o.inner || ''}</g>`;
  };
  // the dashed stateless / stateful line at y
  const asSplit = y => `<line class="as-split" x1="${AS.x0}" y1="${y}" x2="${AS.x1}" y2="${y}"/>` +
    `<text class="sm" x="${AS.x1}" y="${y - 12}" text-anchor="end">stateless</text>` +
    `<text class="lbl" x="${AS.x1}" y="${y + 30}" text-anchor="end">stateful</text>`;
  // the FoundationDB frame, top at y, height h, with an optional subtitle
  const asFdb = (y, h, sub) => `<g class="as-fdb"><rect class="bx" x="${AS.x0}" y="${y}" width="${AS.x1 - AS.x0}" height="${h}" rx="14"/></g>` +
    `<text class="t1" x="${AS.x0 + 24}" y="${y + 42}">FoundationDB</text>` +
    (sub ? `<text class="sm" x="${AS.x0 + 240}" y="${y + 42}">${sub}</text>` : '');
  // a FoundationDB machine, AS.mw wide, o.h tall (default AS.mh), o.label (default "machine")
  const asMachine = (o = {}) => `<g class="as-m c-ink${o.cls ? ' ' + o.cls : ''}"${asAt(o)}>` +
    `<rect class="bx" width="${AS.mw}" height="${o.h || AS.mh}" rx="10"/><text class="sm" x="16" y="34">${o.label || 'machine'}</text></g>`;
  // one cluster's data, a small blue block
  const asBlock = (o = {}) => `<g class="as-db c-blue${o.cls ? ' ' + o.cls : ''}"${asAt(o)}><rect class="bx" width="${AS.dw}" height="${AS.dh}" rx="7"/>` +
    [0, 1, 2].map(j => `<line x1="14" y1="${14 + j * 12}" x2="${76 - j * 14}" y2="${14 + j * 12}"/>`).join('') + `</g>`;
  // where slot s (2 per row) of a machine at (mx, my) puts its block
  const asSlot = (mx, my, s) => [mx + 14 + (s % 2) * (AS.dw + 14), my + 52 + Math.floor(s / 2) * (AS.dh + 12)];
  Deck.css(`
:is(#s-bench-limits,#s-v2) svg .as-lb .bx{fill:var(--tint);stroke:var(--c);stroke-width:var(--bw)}
:is(#s-bench-limits,#s-v2) svg .as-lb text{font-size:26px;font-weight:600}
:is(#s-bench-limits,#s-v2) svg .as-inst .bx{fill:var(--tint);stroke:var(--c);stroke-width:var(--bw)}
:is(#s-bench-limits,#s-v2) svg .as-inst .nm{font-size:26px;font-weight:600;fill:var(--c)}
:is(#s-bench-limits,#s-v2) svg .as-split{stroke:var(--ink2);stroke-width:var(--sw);stroke-dasharray:12 9}
:is(#s-bench-limits,#s-v2) svg .as-fdb .bx{fill:none;stroke:var(--ink);stroke-opacity:.45;stroke-width:var(--bw);stroke-dasharray:8 7}
:is(#s-bench-limits,#s-v2) svg .as-m .bx{fill:var(--tint);stroke:var(--c);stroke-width:var(--bw)}
:is(#s-bench-limits,#s-v2) svg .as-db .bx{fill:var(--tint);stroke:var(--c);stroke-width:2.5px}
:is(#s-bench-limits,#s-v2) svg .as-db line{stroke:var(--c);stroke-opacity:.5;stroke-width:3px;stroke-linecap:round}
`);
  /* =====================================================================
     19. s-materia: the etcd layer among its siblings, on one FoundationDB cluster (static)
     ===================================================================== */
  const layers = [['KV', 'Redis, GraphQL'], ['etcd', 'etcd v3 gRPC'], ['KMS', 'keys and secrets'], ['Workflows', 'durable jobs'], ['Election', 'leaders, locks']];
  Deck.slide({
    id: 's-materia', label: 'Materia, layers on FoundationDB',
    html: `
<div class="sh"><h2>Materia, layers on FoundationDB</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  <g transform="translate(0 24)">
  ${layers.map((l, i) => box(120 + i * 279, 190, 244, 100, { c: 'cc', cls: i === 1 ? 'hl' : '', valign: 'middle', lines: [[l[0], 't1'], [l[1], 'sm']], lh: 34 })).join('')}
  ${box(120, 340, 1360, 60, { c: 'ink', valign: 'middle', lines: [['stateless layers, tested by deterministic simulation', 'lbl']] })}
  ${arrow('M800 402 V450')}
  ${frame(120, 452, 1360, 270, 'ink', 'FoundationDB')}
  <text class="sm" x="144" y="528">storage servers hold key ranges, split and moved automatically</text>
  ${[1, 2, 3, 4].map(n => 'storage ' + n).concat(['storage ...']).map((t, i) =>
    box(150 + i * 270, 565, 240, 110, { c: 'ink', valign: 'middle', lines: [[t, 't1'], ['key ranges', 'sm']], lh: 34 })).join('')}
  </g>
</svg>`
  });

  /* =====================================================================
     21. s-materia-etcd: slide 10 redrawn on FoundationDB, slides 9 to 12 replayed on it (3 steps)
     Same layout as s-storage, s-watch, s-scan: the API server top left, its reply below it, the
     history (green, by revision) and the index (violet, by key) with the same rows. The etcd layer
     sits between the API server and the two keyspaces. Every box keeps its name across the
     steps; the action of the step is the label of the arrows (the request on the API server to
     layer arrow, what is written or read on the layer to keyspace arrows).
     ===================================================================== */
  const ME = {
    api: [120, 150, 220, 140],  // the API server
    ans: [120, 330, 220, 170],  // its reply
    layer: [640, 150, 840, 72],
    // the two keyspaces, 108px under the layer so the arrow labels sit clear of every line;
    // rows every 50px, row i starts at row0 + i * 50
    log: { x: 440, w: 430, y: 330, h: 296, row0: 426, rowh: 50 },
    kv: { x: 906, w: 574, y: 330, h: 296, row0: 426, rowh: 50 },
    down: [760, 1193]  // x of the layer to keyspace arrows (history, index)
  };
  // [cells, { now, skip }]: now = steps where the row is tinted, skip = the step where it is greyed and "skipped"
  const meLog = [[['rev 100', 'pods/db'], {}], [['rev 101', 'pods/web v1'], { now: '1' }],
    [['rev 102', 'events/ev1'], { skip: 1 }], [['rev 103', 'pods/web v2'], { now: '0 1' }]];
  const meKv = [[['events/ev1', '@102'], {}], [['pods/db', '@100'], { now: '2' }],
    [['pods/web', '@103', 'v2'], { now: '0 2' }], [['pods/web', '@101', 'v1'], { skip: 2 }]];
  Deck.css(`
#s-materia-etcd svg .rm{font-family:var(--fm);font-size:24px;font-weight:400}
#s-materia-etcd svg .note{font-size:24px;font-weight:400;fill:var(--ink2)}
#s-materia-etcd svg .hop{font-size:26px;font-weight:600}
#s-materia-etcd svg .rbg{fill:transparent}
#s-materia-etcd svg .rule{stroke:var(--c);stroke-opacity:.3;stroke-width:1.5px}
#s-materia-etcd svg .srow.now .rbg{fill:var(--hi);stroke:var(--c);stroke-width:2.4px}
#s-materia-etcd[data-step="1"] svg .sk1 text,#s-materia-etcd[data-step="2"] svg .sk2 text{fill:var(--ink2)}
#s-materia-etcd svg .dash rect{stroke-dasharray:14 8;stroke:var(--amber)}
`);
  const meRow = (g, i, c, cells, cols, o) => {
    const y = g.row0 + i * g.rowh, base = y + g.rowh / 2 + 8;
    return `<g class="srow c-${c}${o.skip ? ' sk' + o.skip : ''}"${o.now ? ` data-now="${o.now}"` : ''}>` +
      `<rect class="rbg" x="${g.x + 12}" y="${y + 3}" width="${g.w - 24}" height="${g.rowh - 6}" rx="6"/>` +
      (i ? `<line class="rule" x1="${g.x + 18}" x2="${g.x + g.w - 18}" y1="${y}" y2="${y}"/>` : '') +
      cells.map((t, k) => `<text class="rm" x="${g.x + cols[k]}" y="${base}">${t}</text>`).join('') +
      (o.skip ? `<text class="note" x="${g.x + g.w - 28}" y="${base - 2}" text-anchor="end" data-from="${o.skip}" data-until="${o.skip}">skipped</text>` : '') +
      `</g>`;
  };
  const meBox = (g, c, title) => box(g.x, g.y, g.w, g.h, { c, lines: [[title, 't1'], ['FoundationDB keyspace', 'sm']], lh: 32, top: 44 });
  // a range read: one arrow along rows a to b, just right of box g
  const meRange = (g, a, b, c, at) =>
    `<path class="arrow c-${c}" d="M${g.x + g.w + 18} ${g.row0 + a * g.rowh + 6} V${g.row0 + (b + 1) * g.rowh - 6}" data-from="${at}" data-until="${at}"/>`;
  // the reply box keeps its name; its rows are the step's answer
  const meAns = (lines, at) => {
    const [x, y, w, h] = ME.ans;
    return `<g data-from="${at}" data-until="${at}">` +
      box(x, y, w, h, { c: 'blue', lines: [['reply', 't1']].concat(lines.map(l => [l, 'rm'])), lh: 38, top: 46 }) + `</g>`;
  };
  // the request of step `at`, as the label of the API server to layer arrow
  const meReq = (t, at) => `<text class="lbl" x="${(ME.api[0] + ME.api[2] + ME.layer[0]) / 2}" y="172" text-anchor="middle" data-from="${at}" data-until="${at}">${t}</text>`;
  // what the layer writes or reads in keyspace k (0 history, 1 index) at step `at`: an arrow down with its label
  const meDown = (k, c, t, at) => {
    const x = ME.down[k];
    const y0 = ME.layer[1] + ME.layer[3] + 2, y1 = ME.log.y - 4;
    return arrow(`M${x} ${y0} V${y1}`, at, c) +
      `<text class="lbl" x="${x + 16}" y="${(y0 + y1) / 2 + 9}" data-from="${at}" data-until="${at}" style="fill:var(--${c})">${t}</text>`;
  };
  Deck.slide({
    id: 's-materia-etcd', label: 'Materia etcd data model', cls: 'big', steps: 3,
    html: `
<div class="sh"><h2>Materia etcd data model</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${box(...ME.api, { c: 'blue', lines: [['API server', 't1']], top: 46 })}
  ${arrow(`M${ME.api[0] + ME.api[2] + 2} 185 H${ME.layer[0] - 4}`)}
  ${meReq('put pods/web v2', 0)}
  ${meReq('watch pods/ from 101', 1)}
  ${meReq('list pods/', 2)}

  ${box(...ME.layer, { c: 'blue', valign: 'middle', lines: [['etcd layer', 't1'], ['stateless, keeps nothing', 'sm']], lh: 32 })}
  ${meDown(0, 'green', 'write rev 103', 0)}
  ${meDown(1, 'violet', 'write pods/web @103', 0)}
  ${meDown(0, 'green', 'read from rev 101', 1)}
  ${meDown(1, 'violet', 'read pods/', 2)}

  ${meBox(ME.log, 'green', 'history, by revision')}
  ${meLog.map(([cells, o], i) => meRow(ME.log, i, 'green', cells, [26, 150], o)).join('')}
  ${meBox(ME.kv, 'violet', 'where is key X?')}
  ${meKv.map(([cells, o], i) => meRow(ME.kv, i, 'violet', cells, [26, 210, 290], o)).join('')}

  <g data-until="0">
    <g class="dash frame"><rect x="424" y="${ME.log.y - 12}" width="1072" height="${ME.log.h + 24}" rx="14"/></g>
    <text class="t1" x="440" y="${ME.log.y + ME.log.h + 50}" style="fill:var(--amber)">one transaction, both or neither</text>
  </g>

  <path class="arrow reply" d="M${ME.layer[0] + 14} ${ME.layer[1] + ME.layer[3] + 2} V246 H410 V415 H${ME.ans[0] + ME.ans[2] + 4}" data-until="2"/>
  ${meAns(['ok, rev 103'], 0)}
  ${meRange(ME.log, 1, 3, 'green', 1)}
  ${meAns(['PUT web @101', 'PUT web @103'], 1)}
  ${meRange(ME.kv, 1, 3, 'violet', 2)}
  <text class="hop" x="${ME.kv.x + ME.kv.w - 26}" y="${ME.kv.y + 44}" text-anchor="end" data-from="2" data-until="2" style="fill:var(--violet)">one hop</text>
  ${meAns(['pods/db @100', 'pods/web @103'], 2)}
</svg>`
  });

  /* =====================================================================
     21. s-oracle-intro: testing against etcd itself, the static explanation before s-oracle (3 steps)
     The same Txn goes to Materia etcd, then to the reference model; the responses are compared
     after every Txn, then every row of both keyspaces at the end. Inner boxes use slide 9's colors
     and sit right of the titles, so the step 2 links cross no text.
     ===================================================================== */
  const OR = { ma: [760, 160, 720, 210], mo: [760, 510, 720, 210], ix: [1110, 1290], iw: 160 };
  // two inner boxes (history green, index violet) in target t
  const orInner = (t, names) => ['green', 'violet'].map((c, i) =>
    box(OR.ix[i], t[1] + 20, OR.iw, t[3] - 40, { c, valign: 'middle', lines: names[i], lh: 34 })).join('');
  // a compare mark across the gap between the two targets, at x: "=" between two strokes
  const orEq = (x, c, at, cls) =>
    `<g data-from="${at}"><path class="${cls} c-${c}" d="M${x} 374 V420"/><path class="${cls} c-${c}" d="M${x} 506 V462"/>` +
    `<text class="eq" x="${x}" y="452" text-anchor="middle" style="fill:var(--${c})">=</text></g>`;
  Deck.css(`
#s-oracle-intro svg .tag rect{fill:#fff;stroke:var(--red);stroke-width:var(--bw)}
#s-oracle-intro svg .tag text{fill:var(--red)}
#s-oracle-intro svg .eq{font-size:34px;font-weight:600}
`);
  Deck.slide({
    id: 's-oracle-intro', label: 'Testing against etcd itself', steps: 3,
    html: `
<div class="sh"><h2>Testing against etcd itself</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${box(120, 340, 500, 150, { c: 'ink', valign: 'middle', lh: 44, lines: [['seeded workload', 't1'], ['Txn: if pods/web @101, put v2', 'm']] })}

  ${arrow('M220 338 V230 H756')}
  <text class="lbl" x="242" y="214">1. Materia</text>
  ${arrow('M220 492 V580 H756')}
  <text class="lbl" x="242" y="566">2. then the model, once committed</text>

  ${box(...OR.ma, { c: 'blue', lines: [['Materia etcd', 't1'], ['on simulated FoundationDB', 'sm']], lh: 32, top: 44 })}
  <g class="tag"><rect x="782" y="300" width="196" height="44" rx="8"/><text class="lbl" x="798" y="330">faults injected</text></g>
  ${orInner(OR.ma, [[['history', 't1'], ['keyspace', 'sm']], [['KV', 't1'], ['keyspace', 'sm']]])}

  ${box(...OR.mo, { c: 'blue', lines: [['reference model', 't1'], ['etcd v3.6.6, ported,', 'sm'], ['in memory', 'sm']], lh: 32, top: 44 })}
  ${orInner(OR.mo, [[['history', 't1'], ['by revision', 'sm']], [['index', 't1'], ['by key', 'sm']]])}

  ${orEq(800, 'amber', 1, 'arrow reply')}
  <text class="lbl" x="830" y="430" data-from="1">responses compared</text>
  <text class="lbl" x="830" y="464" data-from="1">after every Txn</text>

  ${orEq(OR.ix[0] + OR.iw / 2, 'green', 2, 'line')}
  ${orEq(OR.ix[1] + OR.iw / 2, 'violet', 2, 'line')}
  <g data-from="2">
    <text class="lbl" x="760" y="772">at the end: every row compared</text>
    <text class="lbl" x="760" y="810" style="fill:var(--red);font-weight:600">one divergence = run fails</text>
  </g>
</svg>`
  });


  /* =====================================================================
     22. s-oracle: etcd, in memory, as the oracle (autoplay)
     Ported from the Materia deck's s-sim, light theme. One seed drives random operations into
     Materia etcd and random outages into a simulated FoundationDB; errors come back up, caught
     and retried; every committed Txn is replayed on the oracle, and the checks run after every
     run. One run fails, a fix lands, the same seed and every later run go green, production stays
     quiet. Plays when the slide is entered, stops when it is left, restarts from zero on re-entry;
     reduced motion shows the end state.
     ===================================================================== */
  const SIM_OPS = ['put', 'delete', 'txn: if @rev, put', 'compact', 'a lease expires'];
  const SIM_CHECKS = ["every response = the model's", 'revisions match the model', "every row = the model's", 'no row lost on a purge'];
  const ROW_CHECK = 2;  // the check the red run fails
  // 4 simulated machines (2 x 2) and the links between them
  const SIM_M = [0, 1, 2, 3].map(i => ({ x: 530 + (i % 2) * 160, y: 330 + Math.floor(i / 2) * 74 }));
  const SIM_LINKS = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3]];
  const SEEDS = 24, RED = 16, SEED_RED = 916297693;
  const seedX = i => 80 + i * 60;  // the strip spans the canvas: seeds 44 wide, 16 apart
  const OP_Y = k => 310 + k * 46;  // top of the operation row k
  Deck.css(`
#s-oracle svg text{fill:var(--ink)}
#s-oracle svg .tt{font-size:26px;font-weight:600}
#s-oracle svg .tx{font-size:24px;font-weight:400}
#s-oracle svg .mo{font-family:var(--fm);font-size:24px}
#s-oracle svg .mu{fill:var(--ink2)}
#s-oracle svg .blk{fill:#fff;stroke:var(--edge);stroke-width:2.6}
#s-oracle .die .dr{transform-box:fill-box;transform-origin:center}
#s-oracle .die.roll .dr{animation:orroll .3s ease-out}
@keyframes orroll{from{transform:rotate(-90deg)}}
#s-oracle .die rect{fill:#fff;stroke:var(--ink);stroke-width:2.9}
#s-oracle .die circle{fill:var(--ink)}
#s-oracle svg .sd-n{transition:fill .3s}
#s-oracle svg .sd-n.bad{fill:var(--red)}
#s-oracle .op rect{fill:#fff;stroke:var(--edge);stroke-width:2.6;transition:stroke .2s}
#s-oracle svg .op text{fill:var(--ink2);transition:fill .2s}
#s-oracle .op.pick rect{stroke:var(--ink)}
#s-oracle svg .op.pick text{fill:var(--ink)}
#s-oracle .fly rect{fill:#fff;stroke-width:3}
#s-oracle svg .fly text{font-size:24px}
#s-oracle .code>rect{fill:color-mix(in srgb,var(--blue) 12%,#fff);stroke:var(--blue);stroke-width:3;transition:stroke .2s}
#s-oracle .code.hit>rect{stroke:var(--amber)}
#s-oracle .orc>rect{fill:color-mix(in srgb,var(--blue) 12%,#fff);stroke:var(--blue);stroke-width:3}
#s-oracle .retry path{fill:none;stroke:var(--ink2);stroke-width:2.9;stroke-linecap:round;stroke-linejoin:round;transition:stroke .2s}
#s-oracle .retry .rg{transform-box:fill-box;transform-origin:center}
#s-oracle .retry.spin path{stroke:var(--green)}
#s-oracle .retry.spin .rg{animation:orspin .7s ease-in-out}
@keyframes orspin{to{transform:rotate(360deg)}}
#s-oracle .fdb-box{fill:none;stroke:var(--ink);stroke-opacity:.35;stroke-width:2.4;stroke-dasharray:6 6}
#s-oracle .m rect{fill:#fff;stroke:var(--ink);stroke-opacity:.6;stroke-width:2.6;transition:fill .3s,stroke .3s}
#s-oracle .m text{transition:opacity .3s}
#s-oracle .m.down rect{fill:color-mix(in srgb,var(--red) 12%,#fff);stroke:var(--red);stroke-opacity:1}
#s-oracle .m.down text{opacity:.35}
#s-oracle .m.hit rect{stroke:var(--green);stroke-opacity:1;fill:color-mix(in srgb,var(--green) 14%,#fff)}
#s-oracle .lk{stroke:var(--ink);stroke-opacity:.3;stroke-width:2.6;transition:stroke .3s,stroke-opacity .3s}
#s-oracle .lk.cut{stroke:var(--red);stroke-opacity:1;stroke-dasharray:4 7;stroke-width:2.6}
#s-oracle .clk circle{fill:#fff;stroke:var(--ink2);stroke-width:2.9;transition:stroke .3s}
#s-oracle .clk .hand{stroke:var(--ink2);stroke-width:2.6;stroke-linecap:round;transform-box:fill-box;transform-origin:50% 100%;transition:transform .9s cubic-bezier(.2,.7,.2,1),stroke .3s}
#s-oracle .clk.skew circle,#s-oracle .clk.skew .hand{stroke:var(--amber)}
#s-oracle .clk.skew .hand{transform:rotate(150deg)}
#s-oracle .disk path{fill:#fff;stroke:var(--ink2);stroke-width:2.9;transition:stroke .3s}
#s-oracle .disk.slow path{stroke:var(--amber)}
#s-oracle .fault,#s-oracle .fx{opacity:0;transition:opacity .35s}
#s-oracle .on{opacity:1!important}
#s-oracle .pr rect{fill:#fff;stroke:var(--edge);stroke-width:2.6;transition:fill .25s,stroke .25s}
#s-oracle .pr .ck,#s-oracle .pr .xx{fill:none;stroke-width:3.6;stroke-linecap:round;stroke-linejoin:round;opacity:0;transition:opacity .2s}
#s-oracle .pr .ck{stroke:var(--green)}
#s-oracle .pr .xx{stroke:var(--red)}
#s-oracle svg .pr text{transition:fill .3s}
#s-oracle .pr.ok rect{stroke:var(--green);fill:color-mix(in srgb,var(--green) 14%,#fff)}
#s-oracle .pr.ok .ck{opacity:1}
#s-oracle .pr.bad rect{stroke:var(--red);fill:color-mix(in srgb,var(--red) 14%,#fff)}
#s-oracle .pr.bad .xx{opacity:1}
#s-oracle svg .pr.bad text{fill:var(--red)}
#s-oracle .pr.pulse rect{animation:ortick .4s ease-out}
@keyframes ortick{40%{fill:color-mix(in srgb,var(--green) 40%,#fff)}}
#s-oracle .chip-g{opacity:0;transition:transform .9s cubic-bezier(.2,.7,.2,1),opacity .5s}
#s-oracle .chip-g rect{fill:#fff;stroke-width:3}
#s-oracle .seed{fill:var(--pn);stroke:var(--edge);stroke-width:2.6;transition:fill .25s,stroke .25s}
#s-oracle .seed.ok{fill:color-mix(in srgb,var(--green) 40%,#fff);stroke:var(--green)}
#s-oracle .seed.bad{fill:var(--red);stroke:var(--red)}
#s-oracle .seed.pulse{animation:orpulse 1s ease-in-out 2}
@keyframes orpulse{50%{stroke-width:6;stroke-opacity:.5}}
#s-oracle svg .seed-lab .sn{fill:var(--red);transition:fill .4s}
#s-oracle svg .seed-lab.fixed .sn{fill:var(--green)}
#s-oracle .seed-lab .sl{stroke:var(--red);transition:stroke .4s}
#s-oracle .seed-lab.fixed .sl{stroke:var(--green)}
#s-oracle .lane{fill:var(--pn);stroke:var(--edge);stroke-width:2.6}
#s-oracle .ship{opacity:0;transform:translateX(-120px);transition:transform 1s cubic-bezier(.2,.7,.2,1),opacity .5s}
#s-oracle .ship.on{transform:none}
`);
  let oraclePlay = null;
  Deck.slide({
    id: 's-oracle', label: 'etcd, in memory, as the oracle',
    html: `
<div class="sh"><h2>etcd, in memory, as the oracle</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  <rect class="blk" x="80" y="140" width="390" height="405" rx="16"/>
  <text class="tt" x="100" y="180">random operations</text>
  <g class="die"><g class="dr"><rect x="100" y="200" width="48" height="48" rx="10"/><circle cx="112" cy="212" r="4.2"/><circle cx="124" cy="224" r="4.2"/><circle cx="136" cy="236" r="4.2"/></g></g>
  <text class="mo mu" x="166" y="220">seed</text>
  <text class="sd-n mo" x="166" y="247">${SEED_RED}</text>
  <text class="tx mu" x="100" y="290">drives operations and outages</text>
  ${SIM_OPS.map((o, k) => `<g class="op"><rect x="100" y="${OP_Y(k)}" width="350" height="38" rx="9"/><text class="tx" x="275" y="${OP_Y(k) + 27}" text-anchor="middle">${o}</text></g>`).join('')}

  <rect class="blk" x="490" y="140" width="560" height="405" rx="16"/>
  <text class="tt" x="510" y="180">simulation</text>
  <g class="code"><rect x="510" y="195" width="520" height="60" rx="10"/><text class="tt" x="530" y="234" style="fill:var(--blue)">Materia etcd</text></g>
  <g class="chip-g c-fix" style="transform:translate(0,-34px)"><rect x="700" y="208" width="120" height="34" rx="8" style="stroke:var(--green)"/><text class="tx" x="760" y="233" text-anchor="middle" style="fill:var(--green)">the fix</text></g>
  <text class="fault caught mo" x="970" y="234" text-anchor="end" style="fill:var(--green)">caught, retried</text>
  <g class="retry" transform="translate(1002 225) scale(1.2)"><g class="rg"><path d="M8.4 7.1 A11 11 0 1 1 10.3 -3.8"/><path d="M11.9 -9.6 L10.3 -3.8 L5.4 -7.2"/></g></g>
  <rect class="fdb-box" x="510" y="275" width="520" height="255" rx="12"/>
  <text class="mo" x="528" y="310">FoundationDB, simulated</text>
  ${SIM_LINKS.map(([a, b]) => `<line class="lk" x1="${SIM_M[a].x + 65}" y1="${SIM_M[a].y + 23}" x2="${SIM_M[b].x + 65}" y2="${SIM_M[b].y + 23}"/>`).join('')}
  ${SIM_M.map(m => `<g class="m"><rect x="${m.x}" y="${m.y}" width="130" height="46" rx="9"/><text class="tx" x="${m.x + 65}" y="${m.y + 31}" text-anchor="middle">machine</text></g>`).join('')}
  <g class="clk" transform="translate(890 356)"><circle r="20"/><line class="hand" x1="0" y1="0" x2="0" y2="-13"/><line x1="0" y1="0" x2="9" y2="0" style="stroke:var(--ink2)" stroke-width="2.4" stroke-linecap="round"/></g>
  <text class="mo mu" x="920" y="364">clock</text>
  <g class="disk"><path d="M872 418 v24 a18 6 0 0 0 36 0 v-24"/><path d="M872 418 a18 6 0 1 0 36 0 a18 6 0 1 0 -36 0"/></g>
  <text class="mo mu" x="920" y="440">disk</text>
  <text class="fault f-lab mo" x="770" y="514" text-anchor="middle"></text>

  <rect class="blk" x="1070" y="140" width="450" height="405" rx="16"/>
  <text class="tt" x="1090" y="180">the oracle</text>
  <g class="orc"><rect x="1090" y="195" width="410" height="60" rx="10"/><text class="tx" x="1106" y="234" style="fill:var(--blue);font-weight:500">etcd v3.6.6, ported, in memory</text></g>
  <text class="tx mu" x="1090" y="300">checked after every run</text>
  ${SIM_CHECKS.map((p, k) => { const cy = 345 + k * 52; return `<g class="pr"><rect x="1090" y="${cy - 14}" width="28" height="28" rx="7"/>
    <path class="ck" d="M1097 ${cy} l6 6 l10 -12"/><path class="xx" d="M1097 ${cy - 8} l14 14 M1111 ${cy - 8} l-14 14"/>
    <text class="tx" x="1132" y="${cy + 8}">${p}</text></g>`; }).join('')}

  <text class="tx mu" x="80" y="592">runs, one seed each</text>
  ${Array.from({ length: SEEDS }, (_, i) => `<rect class="seed" x="${seedX(i)}" y="606" width="44" height="46" rx="7"/>`).join('')}
  <g class="fx seed-lab"><line class="sl" x1="${seedX(RED) + 22}" y1="658" x2="${seedX(RED) + 22}" y2="670" stroke-width="2.2"/>
    <text class="sn mo" x="${seedX(RED) + 22}" y="696" text-anchor="middle">seed ${SEED_RED}</text>
    <text class="tx mu" x="${seedX(RED) + 22}" y="728" text-anchor="middle">a row differs from the model</text></g>

  <rect class="lane" x="80" y="752" width="1440" height="56" rx="12"/>
  <text class="tt" x="100" y="789">production</text>
  <line x1="260" y1="780" x2="1180" y2="780" style="stroke:var(--green)" stroke-opacity=".45" stroke-width="2.4"/>
  <g class="ship"><rect x="280" y="761" width="340" height="38" rx="9" style="fill:#fff;stroke:var(--blue)" stroke-width="2.1"/><text class="tx" x="450" y="788" text-anchor="middle" style="fill:var(--blue)">Materia etcd, with the fix</text></g>
  <g class="fx quiet"><circle cx="1210" cy="780" r="7" style="fill:var(--green)"/><text class="tx mu" x="1228" y="788">quiet, no alert</text></g>
</svg>`,
    init(sec) {
      const sv = sec.querySelector('svg.full'), q = s => sv.querySelector(s), qa = s => [...sv.querySelectorAll(s)];
      const ms = qa('.m'), links = qa('.lk'), seeds = qa('.seed'), ops = qa('.op'), props = qa('.pr');
      const clk = q('.clk'), disk = q('.disk'), die = q('.die'), seedN = q('.sd-n'), code = q('.code'), retry = q('.retry');
      const fLab = q('.f-lab'), caught = q('.caught'), fix = q('.c-fix'), lab = q('.seed-lab');
      const ship = q('.ship'), quiet = q('.quiet');
      const CUT = [1, 3];
      // Outages hit the cluster; each sends an error back up into Materia etcd, except the clock skew.
      const OUT = {
        boot: { text: 'a machine reboots', color: 'var(--red)', err: 'commit result unknown', at: [755, 353], set: on => ms[1].classList.toggle('down', on) },
        cut: { text: 'the network cuts', color: 'var(--red)', err: 'timeout', at: [755, 427], set: on => CUT.forEach(i => links[i].classList.toggle('cut', on)) },
        disk: { text: 'a disk slows', color: 'var(--amber)', err: 'too old', at: [890, 430], set: on => disk.classList.toggle('slow', on) },
        skew: { text: 'a clock skews', color: 'var(--amber)', set: on => clk.classList.toggle('skew', on) }
      };
      // The seed numbers of the runs, the same on every play.
      const draws = () => { const r = Deck.prng(29102026); return () => 1e8 + Math.floor(r() * 8.99e8); };
      function again(node, cls) { node.classList.remove(cls); void node.getBoundingClientRect(); node.classList.add(cls); }
      function roll(n, bad) { seedN.textContent = n; seedN.classList.toggle('bad', !!bad); again(die, 'roll'); }
      function fault(o, on) {
        o.set(on);
        if (on) { fLab.textContent = o.text; fLab.style.fill = o.color; }
        fLab.classList.toggle('on', on);
      }
      // A chip that flies once and is then removed; a stopped run drops the ones still in flight.
      function chip(text, color, x, y, mono) {
        const w = Math.round(text.length * (mono ? 14.4 : 12.5) + 28);
        sv.insertAdjacentHTML('beforeend', `<g class="fly" transform="translate(${x} ${y})"><rect x="${-w / 2}" y="-18" width="${w}" height="36" rx="8" style="stroke:${color}"/><text y="7" text-anchor="middle"${mono ? ' class="mo"' : ''} style="fill:${color}">${text}</text></g>`);
        return sv.lastElementChild;
      }
      // Every flight and hold below is scaled by `k`: 1 reads comfortably, smaller is faster.
      // An operation drawn from the seed flies into Materia etcd; once committed, the same Txn
      // flies on to the oracle.
      async function op(n, alive, k = 1) {
        const y = OP_Y(n) + 19, g = chip(SIM_OPS[n], 'var(--ink)', 275, y);
        ops[n].classList.add('pick');
        const ok = await fly(g, [[275, y], [470, y], [520, 225], [600, 225]], 650 * k, alive);
        ops[n].classList.remove('pick'); g.remove();
        if (!ok) return false;
        const t = chip('same Txn', 'var(--blue)', 900, 225);
        const ok2 = await fly(t, [[900, 225], [1080, 225], [1220, 225]], 550 * k, alive);
        t.remove();
        return ok2;
      }
      // An error bounces back up into Materia etcd, which catches it and retries.
      let caughtRun = 0;
      async function bounce(err, [x, y], alive, k = 1) {
        const g = chip(err, 'var(--amber)', x, y, true);
        if (!await fly(g, [[x, y], [x, 262]], 600 * k, alive)) return false;
        const my = ++caughtRun;
        code.classList.add('hit'); again(retry, 'spin'); caught.classList.add('on');
        setTimeout(() => { if (my === caughtRun) { caught.classList.remove('on'); retry.classList.remove('spin'); } }, Math.max(700, 1100 * k));
        const ok = await pause(350 * k, alive);
        g.remove(); code.classList.remove('hit');
        return ok;
      }
      async function outage(o, alive, k = 1) {
        fault(o, true);
        if (!await pause(450 * k, alive)) return false;
        if (o.err && !await bounce(o.err, o.at, alive, k)) return false;
        if (!await pause(400 * k, alive)) return false;
        fault(o, false);
        return true;
      }
      // Two guarded Txns at once: FoundationDB answers one of them with a conflict.
      async function conflict(alive, k = 1) {
        return await op(2, alive, k) && bounce('conflict', [595, 427], alive, k);
      }
      // The end of a run: every check one by one, `failAt` the one that breaks.
      async function check(alive, step, failAt) {
        props.forEach(p => p.classList.remove('ok', 'bad'));
        for (let k = 0; k < props.length; k++) {
          if (!await pause(step, alive)) return false;
          props[k].classList.add(k === failAt ? 'bad' : 'ok');
        }
        return true;
      }
      const tick = () => props.forEach(p => again(p, 'pulse'));
      function reset() {
        qa('.fly').forEach(g => g.remove());
        ms.forEach(m => m.classList.remove('down', 'hit'));
        Object.values(OUT).forEach(o => o.set(false));
        [fLab, caught, fix, lab, ship, quiet].forEach(x => x.classList.remove('on'));
        seeds.forEach(s => s.classList.remove('ok', 'bad', 'pulse'));
        props.forEach(p => p.classList.remove('ok', 'bad', 'pulse'));
        ops.forEach(o => o.classList.remove('pick'));
        code.classList.remove('hit'); retry.classList.remove('spin'); die.classList.remove('roll');
        seedN.textContent = draws()(); seedN.classList.remove('bad');
        lab.classList.remove('fixed');
        fix.style.transform = 'translate(0,-34px)';
        caughtRun++;
      }
      // Reduced motion: the picture as it stands at the end of the play.
      function end() {
        seeds.forEach(s => s.classList.add('ok'));
        props.forEach(p => p.classList.add('ok'));
        [lab, ship, quiet, fix].forEach(x => x.classList.add('on'));
        lab.classList.add('fixed'); fix.style.transform = 'none';
        seedN.textContent = SEED_RED;
      }
      // The cluster keeps working while the runs go by: a live machine lights up now and then.
      async function busy(alive, live, pace) {
        const rnd = Deck.prng(SEED_RED);
        while (alive() && live()) {
          const up = ms.filter(m => !m.classList.contains('down'));
          const m = up[Math.floor(rnd() * up.length)];
          m.classList.add('hit'); setTimeout(() => m.classList.remove('hit'), 240);
          await Deck.wait(Math.max(90, 280 * pace()));
        }
      }
      async function run(alive) {
        reset();
        if (matchMedia('(prefers-reduced-motion:reduce)').matches) { end(); return; }
        const draw = draws(), pick = Deck.prng(7);
        // `k` shrinks exponentially run after run: the flying chips go faster and come more often.
        let running = true, k = 1;
        busy(alive, () => running, () => k);
        if (!await pause(300, alive)) return;
        // Run 1, slowly enough to read every chip: the seed draws operations and an outage, the
        // error that comes back is caught and retried, every committed Txn goes to the oracle,
        // then every check runs.
        roll(draw());
        if (!await pause(600, alive)) return;
        if (!await op(0, alive, 1.6)) return;
        if (!await op(2, alive, 1.6)) return;
        if (!await outage(OUT.boot, alive, 1.6)) return;
        if (!await op(1, alive, 1.6)) return;
        if (!await pause(300, alive)) return;
        if (!await check(alive, 300)) return;
        seeds[0].classList.add('ok');
        if (!await pause(500, alive)) return;
        // Then every run is faster than the one before: a denser stream of operations, outages
        // and errors flashing by, the strip filling up quickly.
        let streaming = true;
        async function stream() {
          while (alive() && streaming) {
            op(Math.floor(pick() * SIM_OPS.length), alive, Math.max(0.3, 1.2 * k));
            await Deck.wait(Math.max(55, 900 * k));
          }
        }
        const SIDE = [OUT.cut, OUT.disk, 'conflict', OUT.boot];
        let side = null, s = 0;
        for (let i = 1; i < RED; i++) {
          k = Math.pow(0.72, i);
          if (i === 1) stream();
          roll(draw());
          if (!side && i % 2) {
            const o = SIDE[s++ % SIDE.length], kk = Math.max(0.3, 1.3 * k);
            side = (o === 'conflict' ? conflict(alive, kk) : outage(o, alive, kk)).then(() => { side = null; });
          }
          if (!await pause(Math.max(110, 2600 * k), alive)) return;
          if (i <= 3) { if (!await check(alive, 160 * k / 0.72)) return; } else tick();
          seeds[i].classList.add('ok');
        }
        streaming = false;
        if (side) await side;
        if (!await pause(400, alive)) return;
        // The red seed, back at a readable pace: a clock skews, no error comes back, and a row
        // ends up different from the model's. Only the checks catch it.
        k = 1;
        roll(SEED_RED, true);
        if (!await op(0, alive, 1.4)) return;
        fault(OUT.skew, true);
        if (!await op(2, alive, 1.4)) return;
        if (!await pause(500, alive)) return;
        running = false;
        if (!await check(alive, 280, ROW_CHECK)) return;
        seeds[RED].classList.add('bad', 'pulse');
        lab.classList.add('on');
        if (!await pause(2200, alive)) return;
        // A fix lands in Materia etcd; the same seed now runs to the end and every check holds.
        fix.classList.add('on'); fix.style.transform = 'none';
        fault(OUT.skew, false);
        if (!await pause(1300, alive)) return;
        props[ROW_CHECK].classList.remove('bad'); props[ROW_CHECK].classList.add('ok'); tick();
        seeds[RED].classList.remove('bad', 'pulse'); seeds[RED].classList.add('ok');
        seedN.classList.remove('bad');
        lab.classList.add('fixed');
        if (!await pause(500, alive)) return;
        // Every run goes green, then the change ships and production stays quiet.
        for (let i = RED + 1; i < SEEDS; i++) {
          if (!await pause(90, alive)) return;
          roll(draw()); tick(); seeds[i].classList.add('ok');
        }
        if (!await pause(600, alive)) return;
        ship.classList.add('on');
        if (!await pause(1200, alive)) return;
        quiet.classList.add('on');
      }
      // Each entry starts a new run; leaving the slide (or entering again) stops the previous one.
      let token = 0;
      oraclePlay = () => {
        const my = ++token;
        run(() => my === token && sec.classList.contains('cur')).catch(e => console.error('s-oracle', e));
      };
      reset();
    },
    onStep() { if (oraclePlay) oraclePlay(); }
  });

  /* =====================================================================
     24. s-sim-talk: more on simulation, the talk to watch (static). The QR code is generated
     from the reading list's URL (assets/img/qr-sim-talk.png).
     ===================================================================== */
  Deck.css(`
#s-sim-talk .qr{position:absolute;left:120px;top:200px;width:460px;height:460px;border:var(--bw) solid var(--edge);border-radius:16px;display:flex;align-items:center;justify-content:center;background:#fff}
#s-sim-talk .qr img{width:420px;height:420px;image-rendering:pixelated}
#s-sim-talk .info{position:absolute;left:640px;top:220px;width:860px}
#s-sim-talk .info h3{font-size:48px;font-weight:600;letter-spacing:-.02em;line-height:1.12;margin:0 0 28px}
#s-sim-talk .info p{font-size:30px;line-height:1.4;margin:0 0 20px}
#s-sim-talk .info .url{font-family:var(--fm);font-size:28px;color:var(--blue)}
`);
  Deck.slide({
    id: 's-sim-talk', label: 'More on simulation',
    html: `
<div class="sh"><h2>More on simulation</h2></div>
<div class="qr"><img src="assets/img/qr-sim-talk.png" alt="QR code: youtube.com/watch?v=tTxY8IbT88A"></div>
<div class="info">
  <h3>Borrowing FoundationDB's simulator for layer development</h3>
  <p>How Materia's layers are tested: one seed, random operations, random outages, replayable runs.</p>
  <p class="url">youtube.com/watch?v=tTxY8IbT88A</p>
</div>`
  });

  /* =====================================================================
     25. s-bench: a cluster writes little, 45 txn/s is per cluster (3 steps)
     One scale for the bars and the ceiling marker: 0 txn/s at BX, 45 txn/s at BX + 780.
     ===================================================================== */
  const BX = 420, BPX = 780 / 45;
  const benchBar = (y, label, v, val) =>
    `<text class="lbl" x="120" y="${y + 29}">${label}</text>` +
    `<rect class="track" x="${BX}" y="${y}" width="${45 * BPX}" height="40" rx="6"/>` +
    `<rect class="fill" x="${BX}" y="${y}" width="${v * BPX}" height="40" rx="6"/>` +
    `<text class="m" x="${BX + v * BPX + 16}" y="${y + 29}">${val}</text>`;
  // 8 cluster chips in one row, wired to the layer instance that serves them
  const benchChips = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const cx = 214 + i * 148;
    return box(cx, 490, 136, 60, { c: 'blue', valign: 'middle', lines: [['k8s', 'lbl']] }) +
      `<path class="line" d="M${cx + 68} 552 V600"/>`;
  }).join('');
  Deck.css(`
#s-bench svg .q{font-size:30px;font-weight:600}
#s-bench svg .track{fill:#fff;stroke:var(--edge);stroke-width:var(--bw)}
#s-bench svg .fill{fill:color-mix(in srgb,var(--blue) 32%,#fff);stroke:var(--blue);stroke-width:var(--bw)}
#s-bench svg .ceil{stroke:var(--amber);stroke-width:4.8px}
`);
  Deck.slide({
    id: 's-bench', label: 'Benchmark', steps: 3,
    html: `
<div class="sh"><h2>Benchmark</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  <text class="q" x="120" y="196">How much does a Kubernetes cluster write?</text>
  ${benchBar(240, 'idle cluster', 5, '≈ 5 txn/s')}
  ${benchBar(310, '65-node cluster', 15, '≈ 15 txn/s')}

  <g data-from="1">
    <line class="ceil" x1="${BX + 45 * BPX}" x2="${BX + 45 * BPX}" y1="222" y2="368"/>
    <text class="t1" x="${BX + 45 * BPX + 20}" y="304" style="fill:var(--amber)">45 txn/s per cluster</text>
  </g>

  <g data-from="2">
    <text class="t1" x="214" y="466">1 instance, 8 clusters</text>
    ${benchChips}
    ${box(214, 600, 1172, 80, { c: 'blue', valign: 'middle', lines: [['1 layer instance · 4 vCPU · 200 MB', 't1']] })}
  </g>
</svg>`
  });

  /* =====================================================================
     24. s-bench-limits: scaling = adding instances (5 steps)
     The traffic picture, stepped (shared helpers asLb, asInst, asSplit, asFdb, asMachine,
     asBlock): cluster chips (the load) feed the load balancer, Materia etcd instances below it,
     the stateless/stateful line, FoundationDB machines holding one blue block per cluster. One
     gauge per instance (its busiest resource); the 60 to 70% operating target is spoken. Load per
     instance = clusters / instances: 4/2, then 6/2 (near saturation), 6/3 and 8/4 (back to
     normal). Step 4 adds a dashed machine, step 5 the stateless workers. Red at step 1 is the
     only accent.
     ===================================================================== */
  const GW = 206;  // gauge track width
  const SL = {
    chips: [0, 0, 0, 0, 1, 1, 3, 3],  // step where each cluster chip (and its block) appears
    inst: [0, 0, 2, 3],               // step where each instance appears
    cx: i => 120 + i * 172,           // chip x, chips are 152 wide
    ix: i => AS.x0 + i * 275,         // instance x, instances are 250 wide, 4 fit left of the workers
    wx: 1190, ww: 330, wh: 70, wgap: 10,  // the stateless workers, stacked at the right of the row
    mx: i => Math.round(AS.x0 + 20 + 350 * (i + .5) - AS.mw / 2),  // machine x, 4 places
    chipY: 60, lbY: 150, instY: 260, iw: 250, ih: 150, line: 470, fdbY: 510, mY: 570, mh: 182
  };
  // a gauge at (x, y): track, one fill per step window [value, from, until, cls]
  const gauge = (x, y, fills) =>
    `<rect class="track" x="${x}" y="${y}" width="${GW}" height="32" rx="6"/>` +
    fills.map(([v, from, until, cls]) => `<rect class="fill${cls ? ' ' + cls : ''}" x="${x}" y="${y}" width="${v * GW}" height="32" rx="6"` +
      ` data-from="${from}"${until != null ? ` data-until="${until}"` : ''}/>`).join('');
  // instance i: at the normal level from the step it appears, except instances 1 and 2 at step 1 (6 clusters on 2)
  const inst = i => {
    const x = SL.ix(i), at = SL.inst[i];
    return asInst({ x, y: SL.instY, w: SL.iw, h: SL.ih, from: at,
      inner: gauge(22, 98, at === 0 ? [[0.65, 0, 0], [0.97, 1, 1, 'hot'], [0.65, 2]] : [[0.65, at]]) }) +
      (at ? `<text class="t1" x="${x + SL.iw / 2}" y="${SL.instY - 16}" text-anchor="middle" data-from="${at}" data-until="${at}">+ instance</text>` : '');
  };
  // a stateless worker (background jobs, no requests): the stronger tint of the instances' blue, at the last step
  const worker = i => `<g class="as-wk c-blue" data-from="5"><rect class="bx" x="${SL.wx}" y="${SL.instY + i * (SL.wh + SL.wgap)}" width="${SL.ww}" height="${SL.wh}" rx="10"/>` +
    `<text class="nm" x="${SL.wx + SL.ww / 2}" y="${SL.instY + i * (SL.wh + SL.wgap) + 30}" text-anchor="middle">worker</text>` +
    `<text class="sm" x="${SL.wx + SL.ww / 2}" y="${SL.instY + i * (SL.wh + SL.wgap) + 58}" text-anchor="middle">compaction, leases</text></g>`;
  const chip = (i, at) => box(SL.cx(i), SL.chipY, 152, 56, { c: 'blue', from: at, valign: 'middle', lines: [['k8s', 'lbl']] }) +
    `<path class="line" d="M${SL.cx(i) + 76} ${SL.chipY + 58} V${SL.lbY - 2}" data-from="${at}"/>`;
  // cluster i's data: machine i % 3, slot i / 3, from the step its chip appears
  const slBlock = (i, at) => { const [x, y] = asSlot(SL.mx(i % 3), SL.mY, Math.floor(i / 3)); return asBlock({ x, y, from: at }); };
  Deck.css(`
#s-bench-limits svg.full{--dy:30px}
#s-bench-limits svg .track{fill:#fff;stroke:var(--edge);stroke-width:var(--bw)}
#s-bench-limits svg .fill{fill:color-mix(in srgb,var(--ink) 22%,#fff);stroke:var(--ink2);stroke-width:var(--bw)}
#s-bench-limits svg .fill.hot{fill:color-mix(in srgb,var(--red) 40%,#fff);stroke:var(--red)}
#s-bench-limits svg .as-wk .bx{fill:var(--hi);stroke:var(--c);stroke-width:var(--bw)}
#s-bench-limits svg .as-wk .nm{font-size:26px;font-weight:600;fill:var(--c)}
#s-bench-limits svg .as-m.dash .bx{fill:#fff;stroke-dasharray:8 6}
`);
  Deck.slide({
    id: 's-bench-limits', label: 'Scaling = adding instances', steps: 6,
    html: `
<div class="sh"><h2>Scaling = adding instances</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${SL.chips.map((at, i) => chip(i, at)).join('')}
  ${asLb(SL.lbY)}
  ${[0, 1, 2, 3].map(inst).join('')}
  ${[0, 1].map(worker).join('')}
  <text class="sm" x="${SL.ix(0) + 22}" y="${SL.instY + SL.ih + 34}">tokio or FDB client</text>
  ${asSplit(SL.line)}
  ${asFdb(SL.fdbY, 262)}
  ${[0, 1, 2].map(i => asMachine({ x: SL.mx(i), y: SL.mY, h: SL.mh })).join('')}
  ${SL.chips.map((at, i) => slBlock(i, at)).join('')}
  ${asMachine({ x: SL.mx(3), y: SL.mY, h: SL.mh, cls: 'dash', label: '+ machine', from: 4 })}
  <text class="lbl" x="${AS.x0}" y="820" data-from="4">add FoundationDB machines if needed: key ranges move automatically</text>
</svg>`
  });

  /* =====================================================================
     25a. s-conflict: why one cluster's writes serialize (4 steps), a sequence diagram, time
     going down. Two writes to the same cluster, one per side, each on its Materia etcd instance;
     FoundationDB in the middle. Both (0) read the latest revision (a serializable read, so it is
     in the read-conflict set), (1) do the work, building rev 104; (2) the left commits first;
     (3) the right commits later and conflicts, and will have to redo it all (spoken).
     Every conflict redoes the read, the work and the commit: write amplification.
     Verified: materia-etcd ADR 0001 (docs/adr/0001-data-model.md:115-116); materia-etcd-lib
     src/data/key_value_store/mod.rs:93 (serializable read of the max revision) and :196 (+ 1).
     ===================================================================== */
  const CF = { hy: 140, hh: 90, x: { l: 210, i1: 530, f: 800, i2: 1070, r: 1390 }, w: { l: 260, i1: 230, f: 270, i2: 230, r: 260 } };
  // a message from lifeline x1 to x2 at height y, its label above, centered; o.reply dashed, o.c accent
  const cfMsg = (x1, x2, y, label, from, o = {}) => {
    const d = x2 > x1 ? 4 : -4;
    return `<path class="arrow${o.reply ? ' reply' : ''}${o.c ? ' c-' + o.c : ''}" d="M${x1 + d / 2} ${y} H${x2 - d}" data-from="${from}"/>` +
      (label ? `<text class="call${o.cls ? ' ' + o.cls : ''}" x="${(x1 + x2) / 2}" y="${y - 10}" text-anchor="middle" data-from="${from}">${label}</text>` : '');
  };
  // the work an instance does, a small box on its lifeline
  const cfWork = (x, y, t, from) => `<g data-from="${from}">` + box(x - 105, y, 210, 42, { c: 'amber', valign: 'middle', lines: [[t, 'lbl']] }) + `</g>`;
  const cfLife = (x, c, y1) => `<path class="life c-${c}" d="M${x} ${CF.hy + CF.hh + 2} V${y1}"/>`;
  const cfHead = (k, c, lines) => box(CF.x[k] - CF.w[k] / 2, CF.hy, CF.w[k], CF.hh, { c, valign: 'middle', lines, lh: 32 });
  const { l: XL, i1: X1, f: XF, i2: X2, r: XR } = CF.x;
  Deck.css(`
#s-conflict svg.full{--dy:60px}
#s-conflict svg .call{font-family:var(--fm);font-size:24px}
#s-conflict svg .call.ok{fill:var(--green);font-weight:600}
#s-conflict svg .call.ko{fill:var(--red);font-weight:600}
#s-conflict svg .life{fill:none;stroke:var(--c);stroke-opacity:.35;stroke-width:3.6px}
#s-conflict svg .time{fill:none;stroke:var(--ink2);stroke-width:var(--sw);marker-end:url(#deck-arrow)}
`);
  Deck.slide({
    id: 's-conflict', label: 'One cluster, one write at a time', steps: 4,
    html: `
<div class="sh"><h2>One cluster, one write at a time</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  <text class="sm" x="40" y="${CF.hy + 40}" text-anchor="middle">time</text>
  <path class="time" d="M40 ${CF.hy + 60} V700"/>
  ${cfLife(XL, 'blue', 680)}${cfLife(X1, 'blue', 680)}${cfLife(XF, 'ink', 680)}${cfLife(X2, 'blue', 680)}${cfLife(XR, 'blue', 680)}
  ${cfHead('l', 'blue', [['put pods/web v3', 'm']])}
  ${cfHead('i1', 'blue', [['Materia etcd', 't1'], ['instance 1', 'sm']])}
  ${cfHead('f', 'ink', [['FoundationDB', 't1']])}
  ${cfHead('i2', 'blue', [['Materia etcd', 't1'], ['instance 2', 'sm']])}
  ${cfHead('r', 'blue', [['put pods/db v2', 'm']])}

  ${cfMsg(XL, X1, 280, '', 0)}${cfMsg(XR, X2, 280, '', 0)}
  ${cfMsg(X1, XF, 330, 'latest rev?', 0)}${cfMsg(X2, XF, 330, 'latest rev?', 0)}
  ${cfMsg(XF, X1, 375, '103', 0, { reply: true })}${cfMsg(XF, X2, 375, '103', 0, { reply: true })}
  ${cfWork(X1, 400, 'build rev 104', 1)}${cfWork(X2, 400, 'build rev 104', 1)}

  ${cfMsg(X1, XF, 500, 'commit rev 104', 2)}
  ${cfMsg(XF, X1, 545, 'ok', 2, { reply: true, c: 'green', cls: 'ok' })}
  ${cfMsg(X1, XL, 600, 'ok, rev 104', 2, { reply: true })}

  ${cfMsg(X2, XF, 580, 'commit rev 104', 3)}
  ${cfMsg(XF, X2, 625, 'conflict', 3, { reply: true, c: 'red', cls: 'ko' })}
</svg>`
  });

  /* =====================================================================
     24b. s-v2: next, v2 (2 steps)
     A light hint, same picture as s-bench-limits (shared helpers asSplit, asFdb, asInst): two
     cluster chips on top, three Materia etcd instances, the stateless / stateful line,
     FoundationDB. Step 0, writes: each cluster goes to its one elected leader (amber crown),
     and only the leaders write to FoundationDB. Step 1, reads and watches: dashed arrows from
     each cluster to every instance, every instance reads FoundationDB.
     Source: materia docs/crates/projects/materia-etcd/architecture/v2-write-path.md:15-22 and
     v2-read-path.md:6,19-24.
     ===================================================================== */
  const V2 = {
    chipY: 60, chipW: 340, chipH: 60, instY: 230, iw: 420, ih: 150, line: 450, fdbY: 490, fdbH: 90,
    chips: [['kubernetes_01jc8r2k4m', 400], ['kubernetes_01jcb5n8wd', 1200]],  // [name, center x]
    inst: [300, 800, 1300],                                                    // instance center x
    lead: ['kubernetes_01jc8r…', null, 'kubernetes_01jcb5…']                   // instance i leads this cluster
  };
  // an arrow as markup: o.from/o.until step window, o.reply dashed, o.c accent
  const v2Arrow = (d, o = {}) => `<path class="arrow${o.reply ? ' reply' : ''}${o.c ? ' c-' + o.c : ''}" d="${d}"` +
    `${o.from != null ? ` data-from="${o.from}"` : ''}${o.until != null ? ` data-until="${o.until}"` : ''}/>`;
  const v2Inst = i => asInst({ x: V2.inst[i] - V2.iw / 2, y: V2.instY, w: V2.iw, h: V2.ih,
    inner: V2.lead[i] ? Deck.crown(18, 100) + `<text class="lbl" x="64" y="122">leader of ${V2.lead[i]}</text>` : '' });
  // cluster c to instance i: starts spread along the chip, ends spread along the instance, so no two heads meet
  const v2Link = (c, i, o) => {
    const x0 = V2.chips[c][1] + (i - 1) * 110, x1 = V2.inst[i] + (c ? 70 : -70);
    return v2Arrow(`M${x0} ${V2.chipY + V2.chipH + 2} L${x1} ${V2.instY - 4}`, { ...o, c: 'blue' });
  };
  const v2Down = (i, o) => v2Arrow(`M${V2.inst[i]} ${V2.instY + V2.ih + 2} V${V2.fdbY - 4}`, o);
  // writes (step 0): each cluster to its leader (instance 0 or 2), then the leaders down to FoundationDB
  const v2Writes = v2Link(0, 0, { until: 0 }) + v2Link(1, 2, { until: 0 }) + v2Down(0, { until: 0 }) + v2Down(2, { until: 0 });
  // reads (step 1): every cluster to every instance, every instance down to FoundationDB, dashed
  const v2Reads = [0, 1].map(c => [0, 1, 2].map(i => v2Link(c, i, { from: 1, reply: true })).join('')).join('') +
    [0, 1, 2].map(i => v2Down(i, { from: 1, reply: true })).join('');
  Deck.css(`
#s-v2 svg.full{--dy:30px}
`);
  Deck.slide({
    id: 's-v2', label: 'Next: v2', steps: 2,
    html: `
<div class="sh"><h2>Next: v2</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${V2.chips.map(([n, cx]) => box(cx - V2.chipW / 2, V2.chipY, V2.chipW, V2.chipH, { c: 'blue', valign: 'middle', lines: [[n, 'm']] })).join('')}
  ${[0, 1, 2].map(v2Inst).join('')}
  ${v2Writes}
  ${v2Reads}
  ${asSplit(V2.line)}
  ${asFdb(V2.fdbY, V2.fdbH)}
  <text class="t1" x="800" y="680" text-anchor="middle" style="fill:var(--ink)" data-until="0">writes: one leader per cluster</text>
  <text class="t1" x="800" y="680" text-anchor="middle" style="fill:var(--ink)" data-from="1">reads, watches: any instance</text>
</svg>`
  });

  /* =====================================================================
     25. s-takeaways
     ===================================================================== */
  const take = [
    'Kubernetes needs three etcd calls: Range, Txn, Watch.',
    'etcd keeps a history by revision and an index by key.',
    'Both live on every member: capacity is one machine.',
    'The API is the contract: ours is stateless, on FoundationDB.',
    'Measured: add instances, add capacity.',
  ];
  Deck.css(`
#s-takeaways .t{position:absolute;left:120px;right:120px;display:flex;align-items:center;gap:36px;height:110px;border-top:1.5px solid var(--rule)}
#s-takeaways .n{flex:0 0 70px;font-family:var(--fm);font-size:44px;color:var(--cc)}
#s-takeaways .x{font-size:38px;line-height:1.2}
`);
  Deck.slide({
    id: 's-takeaways', label: 'What to take home',
    html: `
<div class="sh"><h2>What to take home</h2></div>
${take.map((t, i) => `<div class="t" style="top:${180 + i * 120}px"><span class="n">${i + 1}</span><span class="x">${t}</span></div>`).join('')}`
  });

  /* =====================================================================
     26. s-end
     ===================================================================== */
  Deck.css(`
#s-end h1{position:absolute;left:80px;top:150px;margin:0;font-size:120px;font-weight:600;letter-spacing:-.035em;line-height:1.04}
#s-end .info{position:absolute;left:80px;top:490px;width:860px;font-size:34px;line-height:1.4}
#s-end .info p{margin:0 0 26px}
#s-end .info b{font-weight:600}
#s-end .info a{color:var(--blue);text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:4px}
#s-end .qr{position:absolute;left:1040px;top:170px;width:480px;height:480px;border:var(--bw) solid var(--edge);border-radius:16px;display:flex;align-items:center;justify-content:center;background:#fff}
#s-end .qr img{width:440px;height:440px}
#s-end .qrl{position:absolute;left:1040px;top:670px;width:480px;text-align:center;font-size:24px;color:var(--ink2)}
`);
  Deck.slide({
    id: 's-end', label: 'The end',
    html: `
<h1>Any<br>questions?</h1>
<div class="info">
  <p>We are hiring SREs (infra, network, distributed systems).</p>
  <p>Slides at <a href="https://houston-cloud-nord.cleverapps.io/" target="_blank" rel="noopener"><b>houston-cloud-nord.cleverapps.io</b></a></p>
</div>
<div class="qr"><img src="assets/img/qr-openfeedback.png" alt="OpenFeedback QR code"></div><div class="qrl">Feedback on OpenFeedback</div>`
  });

  /* =====================================================================
     27. s-reading: two columns, long URLs wrap
     ===================================================================== */
  Deck.css(`
#s-reading .cols{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin:10px 40px 0}
#s-reading h3{font-family:var(--fm);font-size:16px;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:var(--ink2);margin:0 0 12px}
#s-reading ul{list-style:none;margin:0 0 26px;padding:0}
#s-reading li{font-family:var(--fm);font-size:24px;line-height:1.3;font-weight:400;margin:0 0 12px;}
#s-reading li .ti{display:block;font-family:var(--fs);font-size:24px;color:var(--ink);word-break:normal;margin-bottom:2px}
#s-reading a{color:var(--blue);text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:4px}
`);
  const lnk = u => `<a href="https://${u}" target="_blank" rel="noopener">${u.replace(/\//g, '/<wbr>')}</a>`;
  const li = (u, ti) => `<li>${ti ? `<span class="ti">${ti}</span>` : ''}${lnk(u)}</li>`;
  Deck.slide({
    id: 's-reading', label: 'Reading list',
    html: `
<div class="sh"><h2>Reading list</h2></div>
<div class="cols">
<div>
  <h3>Kubernetes and etcd at scale</h3>
  <ul>
    ${li('aws.amazon.com/blogs/containers/under-the-hood-amazon-eks-ultra-scale-clusters/')}
    ${li('cloud.google.com/blog/products/containers-kubernetes/gke-65k-nodes-and-counting')}
    ${li('developers.redhat.com/articles/2026/10/13/sharding-etcd-on-hosted-control-planes-and-what-the-numbers-actually-say')}
    ${li('github.com/kubernetes/kubernetes/issues/1957')}
    ${li('github.com/instaclustr/cassandra-operator/issues/402')}
    ${li('github.com/kubernetes/enhancements/pull/1404')}
    ${li('github.com/kubernetes/kubernetes/issues/59848')}
    ${li('github.com/etcd-io/etcd/issues/9988')}
    ${li('github.com/etcd-io/etcd/issues/22645')}
    ${li('github.com/etcd-io/etcd/issues/22646')}
  </ul>
</div>
<div>
  <h3>Raft and etcd</h3>
  <ul>
    ${li('thesecretlivesofdata.com/raft')}
    ${li('raft.github.io')}
    ${li('pierrezemb.fr/tags/etcd/')}
  </ul>
  <h3>Talks</h3>
  <ul>
    ${li('youtube.com/watch?v=IrJyrGQ_R9c', 'Lessons Learned from Operating ETCD (OVHcloud)')}
    ${li('youtube.com/watch?v=tTxY8IbT88A', 'Borrowing FoundationDB\'s simulator for layer development')}
    ${li('youtube.com/watch?v=Q_8CRjf3M24', 'Sunny Tech 2024: bases de données distribuées et multi-tenant avec FoundationDB et Rust')}
    ${li('youtube.com/watch?v=cChMz4m8w5A', 'Sunny Tech 2023: FoundationDB, le secret le mieux gardé')}
  </ul>
</div>
</div>`
  });
})();
