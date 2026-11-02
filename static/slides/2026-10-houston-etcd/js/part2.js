/* Part 2 slides: why it breaks at scale. 13. s-problems, 14. s-limits, 15. s-others, 16. s-landscape. */
(function () {
  'use strict';

  const { box, arrow } = Deck;

  /* SVG text helper (canvas coordinates) */
  const txt = (x, y, s, cls, extra) =>
    `<text class="${cls || 'lbl'}" x="${x}" y="${y}"${extra || ''}>${s}</text>`;

  /* =====================================================================
     13. s-problems: a list of problems with etcd, one line and one link each (static). The
     speakers tell the stories; the slide only names them (user decision, 27 October 2026).
     ===================================================================== */
  const problems = [
    ['Cloudflare · 2 November 2020',
      'A half-broken switch: no leader etcd-1 can reach, the cluster goes read-only, the API is degraded for 6 h 33 min',
      'blog.cloudflare.com/a-byzantine-failure-in-the-real-world'],
    ['etcd-io/etcd#22645 · 22 October 2026',
      'One ordinary Txn panics every member, and again on every restart',
      'github.com/etcd-io/etcd/issues/22645'],
    ['etcd-io/etcd#22646 · 22 October 2026',
      'The documented recovery (<span class="mono">--force-new-cluster</span>) bricks the member: data intact, never boots',
      'github.com/etcd-io/etcd/issues/22646']
  ];
  Deck.css(`
#s-problems .list{position:absolute;left:120px;right:120px;top:176px}
#s-problems .pb{margin:0 0 24px;padding:22px 34px 24px}
#s-problems .src{font-family:var(--fm);font-size:24px;color:var(--ink2);margin:0 0 8px}
#s-problems .tl{font-size:34px;font-weight:600;line-height:1.25;margin:0 0 10px}
#s-problems .tl .mono{font-weight:500}
#s-problems .pb a{font-family:var(--fm);font-size:26px;color:var(--blue);text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:4px}
`);
  Deck.slide({
    id: 's-problems', label: 'Problems with etcd',
    html: `
<div class="sh"><h2>Problems with etcd</h2></div>
<div class="list">
${problems.map(([src, tl, url]) => `<div class="pb box c-red"><p class="src">${src}</p><p class="tl">${tl}</p><a href="https://${url}" target="_blank" rel="noopener">${url}</a></div>`).join('\n')}
</div>`
  });

  /* =====================================================================
     14. s-limits: 3 steps (band 1 always laid out, band 2 appears at step 2)
     ===================================================================== */
  const mx = i => 120 + i * 277;
  const KS = { rh: 36, gap: 6 };
  const members = [0, 1, 2, 3, 4].map(i => {
    const c = i === 0 ? 'amber' : 'blue', f = i < 3 ? 0 : 1;
    return box(mx(i), 186, 252, 270, { c, from: f, lines: [[`etcd-${i + 1}` + (i === 0 ? ' · leader' : ''), 't1']], top: 38 }) +
      Deck.keyspace(mx(i) + 16, 242, 220, '11111', { ...KS, c, from: f });
  }).join('');
  const slots = [3, 4].map(i =>
    `<g data-from="0" data-until="0"><rect x="${mx(i)}" y="186" width="252" height="270" rx="10" fill="none" stroke="var(--edge)" stroke-width="3" stroke-dasharray="8 7"/>` +
    txt(mx(i) + 126, 330, '+ member', 'sm', ' text-anchor="middle"') + '</g>').join('');
  const ranges = ['11100', '01110', '00111', '10011', '11001'];
  const storage = ranges.map((r, i) =>
    box(mx(i), 536, 252, 270, { c: 'ink', lines: [[`storage ${i + 1}`, 't1']], top: 38 }) +
    Deck.keyspace(mx(i) + 16, 592, 220, r, { ...KS, c: 'ink' })
  ).join('');
  Deck.slide({
    id: 's-limits', label: "etcd's limitations", steps: 3,
    html: `
<div class="sh"><h2>etcd's limitations</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${txt(120, 166, 'etcd: every member holds every key', 'm')}
  ${txt(1480, 166, 'capacity: 1 machine', 'lbl', ' data-from="0" data-until="0" text-anchor="end" style="font-weight:600;fill:var(--ink)"')}
  ${txt(1480, 166, 'still 1 machine', 'lbl', ' data-from="1" text-anchor="end" style="font-weight:600;fill:var(--ink)"')}
  ${members}
  ${slots}
  <g data-from="2">
    ${txt(120, 516, 'Partitioned: each key range on 3 machines', 'm')}
    ${txt(1480, 516, 'add a machine, add capacity', 'lbl', ' text-anchor="end" style="font-weight:600;fill:var(--ink)"')}
    ${storage}
  </g>
</svg>`
  });

  /* =====================================================================
     16. s-others: 5 steps (cost of one cluster, then the four options one by one)
     ===================================================================== */
  /* tiny diagram parts of a card at (x, y): chip = cluster, a column of 3 rows from y + 56 */
  const chip = (x, y, t) => box(x, y, 120, 38, { c: 'grey', valign: 'middle', lines: [[t, 'lbl']] });
  const chips = (x, y) => ['k8s 1', 'k8s 2', 'k8s N'].map((t, i) => chip(x, y + 56 + i * 42, t)).join('');
  const dia = (x, y, c, t, w, h) => box(x, y, w, h, { c, cls: c === 'blue' ? 'hl' : '', valign: 'middle', lines: [[t, 'lbl']] });
  const cardDia = {
    A: (x, y) => chips(x + 22, y) + [[75, 104], [117, 117], [159, 130]].map(([a, b]) => arrow(`M${x + 146} ${y + a} L${x + 250} ${y + b}`)).join('') + dia(x + 254, y + 87, 'blue', '1 etcd', 160, 60),
    B: (x, y) => [0, 1, 2].map(i => arrow(`M${x + 146} ${y + 75 + i * 42} H${x + 200}`) +
      dia(x + 204, y + 56 + i * 42, 'blue', '3 etcd', 140, 38)).join('') + chips(x + 22, y),
    C: (x, y) => dia(x + 22, y + 72, 'blue', 'Kubernetes', 200, 90) + arrow(`M${x + 226} ${y + 117} H${x + 350}`, null, 'red') +
      txt(x + 288, y + 107, '×', 't1', ' text-anchor="middle" style="fill:var(--red);font-size:44px"') +
      dia(x + 354, y + 72, 'grey', 'something else', 250, 90),
    D: (x, y) => chips(x + 22, y) + arrow(`M${x + 146} ${y + 117} H${x + 200}`) + dia(x + 204, y + 87, 'blue', 'etcd API', 170, 60) +
      arrow(`M${x + 378} ${y + 117} H${x + 420}`) + dia(x + 424, y + 87, 'ink', 'other storage', 220, 60)
  };
  const opts = [
    ['A', 'Shared etcd', 'noisy neighbours, one outage hits all', 'ink'],
    ['B', 'One etcd per cluster', '3 × N machines, N quorums to run', 'ink'],
    ['C', 'Change Kubernetes', 'declined upstream (kubernetes#1957)', 'ink'],
    ['D', 'Mimic the API', 'same API, another store underneath', 'cc']
  ];
  const cards = opts.map((o, i) => {
    const x = 120 + (i % 2) * 690, y = 310 + Math.floor(i / 2) * 265;
    return `<g data-from="${i + 1}">` + box(x, y, 670, 245, { c: o[3], lines: [[`${o[0]} · ${o[1]}`, 't1']] }) +
      cardDia[o[0]](x, y) + txt(x + 22, y + 222, o[2], 'lbl') + '</g>';
  }).join('');
  Deck.slide({
    id: 's-others', label: 'How others are handling this', steps: 5,
    html: `
<div class="sh"><h2>How others are handling this</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${box(120, 150, 400, 130, { c: 'amber', lines: [['1 cluster', 't1'], ['all its objects: 2 to 3 MB', 'lbl'], ['about 5 puts/s idle', 'lbl']], lh: 36, top: 40 })}
  ${arrow('M524 215 H596')}
  ${[0, 1, 2].map(i => box(600 + i * 230, 150, 210, 130, { c: 'blue', lines: [[`etcd-${i + 1}`, 't1'], ['dedicated', 'lbl'], ['machine', 'lbl']], lh: 36, top: 40 })).join('')}
  ${cards}
</svg>`
  });

  /* =====================================================================
     17. s-landscape: one column per provider, 2 steps: stock etcd underneath (blue) first, then
     the four replacements (ink).
     ===================================================================== */
  const cols = [
    [['Upstream', 'etcd'], 'blue', ['Raft + bbolt']],
    [['Red Hat', 'HyperShift'], 'blue', ['stock etcd,', '2 shards,', 'events apart'], 'tech preview'],
    [['AWS', 'EKS'], 'ink', ['own journal,', 'sharded']],
    [['Google', 'GKE'], 'ink', ['Spanner']],
    [['KubeBrain'], 'ink', ['TiKV']],
    [['Kine'], 'ink', ['SQL, watch', 'by polling']]
  ];
  const cw = 210, cg = 20;
  const provCols = cols.map(([name, c, lines, sub], i) => {
    const x = 120 + i * (cw + cg);
    return `<g data-from="${i < 2 ? 0 : 1}"><path class="line" d="M${x + cw / 2} 312 V350"/>` +
      box(x, 350, cw, 330, { c, lines: [] }) +
      `<g class="c-${c}">` + name.map((n, j) => txt(x + 16, 392 + j * 34, n, 't1')).join('') + '</g>' +
      box(x + 14, 454, cw - 28, 166, { c, cls: 'hl', lines: lines.map(l => [l, 'lbl']), lh: 34, top: 40 }) +
      (sub ? txt(x + 16, 656, sub, 'sm') : '') + '</g>';
  }).join('');
  Deck.slide({
    id: 's-landscape', label: 'The etcd v3 API is the only contract', steps: 2,
    html: `
<div class="sh"><h2>The etcd v3 API is the only contract</h2></div>
<svg class="full" viewBox="0 0 1600 900" aria-hidden="true">
  ${box(120, 150, 320, 56, { c: 'blue', lines: [['API server', 't1']], top: 37 })}
  ${arrow('M280 208 V278')}
  <g transform="translate(0 50)">
  ${box(120, 230, 1360, 82, { c: 'blue', lines: [['etcd v3 API', 't1'], ['Range · Put · Txn · Watch', 'm']], lh: 34, top: 34 })}
  ${provCols}
  </g>
</svg>`
  });
})();
