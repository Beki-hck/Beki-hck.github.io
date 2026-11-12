(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  requestAnimationFrame(() => document.body.classList.add('loaded'));


  /* ---------- glowing ink field (canvas) ---------- */
  const cv = $('#ink'), ctx = cv.getContext('2d');
  let W, H, DPR, parts = [], mouse = { x: -1e4, y: -1e4 }, t = 0, scrollY0 = 0;
  const N = () => Math.min(900, Math.floor((W * H) / 2200));
  function size() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    parts = Array.from({ length: N() }, spawn);
    ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, H);
  }
  function spawn() {
    return { x: Math.random() * W, y: Math.random() * H, life: Math.random() * 200, hue: Math.random() < .82 ? 0 : 1 };
  }
  // cheap smooth noise field
  const field = (x, y, z) =>
    Math.sin(x * .0021 + z) * 1.6 + Math.cos(y * .0026 - z * .7) * 1.4 +
    Math.sin((x + y) * .0012 + z * .4) * 1.1;
  function step() {
    t += .0016;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5,7,10,0.05)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const fade = Math.max(.25, 1 - scrollY0 / (H * 1.4));
    for (const p of parts) {
      const a = field(p.x, p.y, t);
      let vx = Math.cos(a) * .9, vy = Math.sin(a) * .9;
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 30000) { const f = (30000 - d2) / 30000; vx += (dx / 60) * f + (-dy / 90) * f; vy += (dy / 60) * f + (dx / 90) * f; }
      const nx = p.x + vx, ny = p.y + vy;
      ctx.strokeStyle = p.hue ? `rgba(108,182,255,${.3 * fade})` : `rgba(124,242,201,${.26 * fade})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny; p.life--;
      if (p.life < 0 || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) Object.assign(p, spawn(), { life: 120 + Math.random() * 200 });
    }
    if (!document.hidden) raf = requestAnimationFrame(step);
  }
  let raf;
  size();
  addEventListener('resize', () => { clearTimeout(size.t); size.t = setTimeout(size, 150); });
  if (!reduce) { raf = requestAnimationFrame(step); document.addEventListener('visibilitychange', () => { if (!document.hidden) { cancelAnimationFrame(raf); raf = requestAnimationFrame(step); } }); }
  else { for (let i = 0; i < 260; i++) step(); }

  /* ---------- cursor glow ---------- */
  const glow = $('.cursor-glow');
  addEventListener('pointermove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (fine) glow.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
  }, { passive: true });

  /* ---------- nav hide on scroll + active link ---------- */
  const nav = $('#nav'); let lastY = 0;
  const links = $$('.nav-links a');
  const phones = $$('.phone'), prog = $('#prog'), tl = $('.timeline');
  addEventListener('scroll', () => {
    const y = scrollY; scrollY0 = y;
    nav.classList.toggle('hide', y > lastY && y > 300);
    prog.style.transform = `scaleX(${y / Math.max(1, document.documentElement.scrollHeight - innerHeight)})`;
    if (tl) { const r = tl.getBoundingClientRect(); tl.style.setProperty('--draw', Math.max(0, Math.min(1, (innerHeight * .7 - r.top) / r.height))); }
    lastY = y;
    if (!reduce) phones.forEach(ph => {
      const r = ph.parentElement.getBoundingClientRect();
      ph.style.setProperty('--py', `${Math.max(-28, Math.min(28, (r.top + r.height / 2 - innerHeight / 2) * -.06))}px`);
    });
  }, { passive: true });
  const secIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('section[id]').forEach(s => secIO.observe(s));

  /* ---------- charts ---------- */
  $$('[data-chart="bars"]').forEach(el => {
    const rows = JSON.parse(el.dataset.rows), max = +el.dataset.max, unit = el.dataset.unit || '';
    const hot = el.dataset.hot != null ? +el.dataset.hot : -1;
    el.innerHTML = rows.map(([label, v], i) =>
      `<div class="bar${i === hot ? ' hot' : i % 2 ? ' alt' : ''}"><div class="bar-top"><span>${label}</span><b data-v="${v}">0${unit}</b></div>
       <div class="bar-track"><div class="bar-fill" data-w="${(v / max) * 100}"></div></div></div>`).join('');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', rows.map(([l, v]) => `${l}: ${v}${unit}`).join('; '));
  });
  const runChart = el => {
    $$('.bar-fill', el).forEach(f => f.style.width = f.dataset.w + '%');
    $$('b[data-v]', el).forEach(b => countUp(b, +b.dataset.v, (b.textContent.match(/\D+$/) || [''])[0], 1400));
  };

  /* ---------- count up ---------- */
  function countUp(el, to, suffix = '', dur = 1600) {
    const dec = to % 1 ? 1 : 0;
    if (reduce) { el.textContent = to.toFixed(dec) + suffix; return; }
    if (!dec && to <= 12) { // small numbers tick one by one so every step is seen
      let n = 0; el.textContent = '0' + suffix;
      const iv = setInterval(() => { el.textContent = ++n + suffix; if (n >= to) clearInterval(iv); }, Math.max(90, 900 / to));
      return;
    }
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = (to * e).toFixed(dec) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    el.classList.add('in');
    $$('[data-chart]', el).forEach(runChart);
    $$('.count', el).forEach(c => countUp(c, +c.dataset.to));
    io.unobserve(el);
  }), { threshold: .14, rootMargin: '0px 0px -6% 0px' });
  // split section headings into words for a staggered rise
  $$('.section-head h2').forEach(h => {
    let i = 0;
    const wrap = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const f = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(p => {
          if (!p.trim()) { f.append(p); return; }
          const w = document.createElement('span'); w.className = 'w';
          const s = document.createElement('span'); s.style.setProperty('--i', i++); s.textContent = p;
          w.append(s); f.append(w);
        });
        n.replaceWith(f);
      } else wrap(n);
    });
    wrap(h);
  });
  $$('.ticks li, .stats div').forEach(li => li.style.setProperty('--i', [...li.parentNode.children].indexOf(li)));
  $$('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (el.closest('.evals') ? (i % 3) * 90 : 0) + 'ms';
    io.observe(el);
  });

  /* ---------- screenshot tabs (auto-advance until touched) ---------- */
  $$('.case-media').forEach(m => {
    const shots = $$('.shot', m), tabs = $$('.shot-tabs button', m);
    let i = 0, auto;
    const show = n => {
      i = n;
      shots.forEach((s, k) => s.classList.toggle('is-on', k === n));
      tabs.forEach((b, k) => b.setAttribute('aria-selected', k === n));
    };
    tabs.forEach((b, k) => b.addEventListener('click', () => { clearInterval(auto); show(k); }));
    if (!reduce) {
      const vis = new IntersectionObserver(([e]) => {
        clearInterval(auto);
        if (e.isIntersecting && !m.dataset.touched) auto = setInterval(() => show((i + 1) % shots.length), 4200);
      });
      vis.observe(m);
      m.addEventListener('pointerdown', () => { m.dataset.touched = 1; clearInterval(auto); });
    }
  });

  /* ---------- tilt + spotlight on cards ---------- */
  if (fine && !reduce) {
    $$('[data-tilt]').forEach(c => {
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        c.style.setProperty('--x', px * 100 + '%'); c.style.setProperty('--y', py * 100 + '%');
        c.style.setProperty('--ry', (px - .5) * 5 + 'deg'); c.style.setProperty('--rx', (.5 - py) * 5 + 'deg');
      });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
    $$('.shots').forEach(c => {
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--try', ((e.clientX - r.left) / r.width - .5) * 6 + 'deg');
        c.style.setProperty('--trx', (.5 - (e.clientY - r.top) / r.height) * 5 + 'deg');
      });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--trx', '0deg'); c.style.setProperty('--try', '0deg'); });
    });
    $$('.magnetic').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--mx', (e.clientX - r.left - r.width / 2) * .25 + 'px');
        b.style.setProperty('--my', (e.clientY - r.top - r.height / 2) * .35 + 'px');
      });
      b.addEventListener('pointerleave', () => { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
    });
  }

  /* ---------- Ask about my work (keyword search, fully local) ---------- */
  const KB = window.ASK_KB || [];
  const STOP = new Set('a an the is are was were be do does did you your i me my of to in on for and or with what how why which who about tell can could would there that this it its at by from as have has did'.split(' '));
  const norm = s => s.toLowerCase().replace(/[^a-z0-9ሀ-፿%+.\s-]/g, ' ');
  const stem = w => w.replace(/(ing|ers|er|es|s|ed)$/, '') || w;
  const toks = s => norm(s).split(/\s+/).filter(w => w && !STOP.has(w)).map(stem);
  // IDF over every entry's keywords + question text
  const docs = KB.map(k => new Set(toks(k.q.join(' ') + ' ' + k.keys)));
  const df = {}; docs.forEach(d => d.forEach(w => df[w] = (df[w] || 0) + 1));
  const idf = w => Math.log(1 + KB.length / (df[w] || KB.length * 4));
  function answer(q) {
    const qt = [...new Set(toks(q))];
    const padded = ' ' + norm(q).replace(/\s+/g, ' ').trim() + ' ';
    let best = null, bestS = 0, second = 0;
    KB.forEach((k, i) => {
      let s = 0, hit = [];
      qt.forEach(w => { if (docs[i].has(w)) { s += idf(w); hit.push(w); } });
      // phrase bonus
      k.q.forEach(p => { if (padded.includes(' ' + norm(p) + ' ')) s += 3; });
      if (s > bestS) { second = bestS; bestS = s; best = { k, hit }; } else if (s > second) second = s;
    });
    if (!best || bestS < 0.9) return null;
    const conf = Math.max(.2, Math.min(.98, (bestS / (bestS + second + 1)) * (qt.length ? Math.min(qt.length, best.hit.length + 1) / qt.length : 1) * 1.5));
    return { ...best, conf };
  }
  window.__ask = answer;
  const log = $('#askLog'), form = $('#askForm'), input = $('#askQ'), chips = $('#askChips');
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function add(cls, html) {
    const d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; log.appendChild(d);
    log.scrollTop = log.scrollHeight; return d;
  }
  async function type(el, text) {
    if (reduce) { el.textContent = text; return; }
    el.classList.add('caret');
    const words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
      el.textContent = words.slice(0, i + 1).join(' ');
      log.scrollTop = log.scrollHeight;
      await new Promise(r => setTimeout(r, 18 + Math.random() * 22));
    }
    el.classList.remove('caret');
  }
  let busy = false;
  async function ask(q) {
    q = q.trim(); if (!q || busy) return;
    busy = true;
    add('user', `<p>${esc(q)}</p>`);
    const r = answer(q);
    const d = add('bot', '<p></p>');
    if (!r) {
      await type(d.firstChild, "I don't have a confident match for that in my notes, so I won't guess. Try asking about Baltina, Edge Ledger, LLM judges, Amharic, RAG, label errors, skills or experience, or email me.");
      d.insertAdjacentHTML('beforeend', `<div class="meta"><span class="conf">match <i style="--c:5%"></i> none</span><span>abstained</span></div>`);
    } else {
      await type(d.firstChild, r.k.a);
      const link = r.k.link ? `<a href="${r.k.link}" ${r.k.link.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${r.k.linkText || 'Open'} ↗</a>` : '';
      d.insertAdjacentHTML('beforeend', `<div class="meta"><span class="conf">match <i style="--c:${Math.round(r.conf * 100)}%"></i> ${Math.round(r.conf * 100)}%</span><span>keywords: ${esc(r.hit.join(', ') || 'phrase')}</span>${link}</div>`);
    }
    busy = false;
  }
  ['What did you find about AI judges?', 'Tell me about Baltina', 'How did small models do in Amharic?', 'What is your tech stack?', 'Why hire you for AI evaluation?', 'Is this widget an AI?']
    .forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = () => ask(q); chips.appendChild(b); });
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); input.value = ''; });
})();
