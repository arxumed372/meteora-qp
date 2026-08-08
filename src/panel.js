// Виджет. Живёт в shadow DOM, чтобы стили Meteora на него не влияли и наши
// на неё тоже. Ничего не знает про DOM сайта — только зовёт QPActions.
window.QPPanel = (() => {
  const S = window.QPSettings;

  const CSS = `
  :host { all: initial; }
  .qp {
    position: fixed; right: 14px; bottom: 14px; z-index: 2147483000;
    width: 296px; box-sizing: border-box;
    font: 12px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #e6e8ef; background: #12141c; border: 1px solid #2a2f3d;
    border-radius: 10px; padding: 9px 10px 10px;
    box-shadow: 0 8px 28px rgba(0,0,0,.55);
    user-select: none;
  }
  .qp.collapsed { width: auto; padding: 6px 9px; }
  .qp.collapsed .body { display: none; }
  .hdr { display: flex; align-items: center; gap: 6px; }
  .ttl { font-weight: 600; font-size: 12px; letter-spacing: .2px; flex: 1;
         white-space: nowrap; }
  .ico { cursor: pointer; width: 20px; height: 18px; border-radius: 5px;
         border: 1px solid #2a2f3d; background: #1a1d28; color: #aab0c0;
         font-size: 11px; line-height: 16px; text-align: center; padding: 0; }
  .ico:hover { background: #222634; color: #fff; }
  .body { margin-top: 8px; }
  .row { display: flex; gap: 6px; }
  .fld { flex: 1; min-width: 0; }
  .lbl { font-size: 9.5px; color: #7f8699; margin: 0 0 2px 2px; letter-spacing: .3px; }
  input.v {
    width: 100%; box-sizing: border-box; height: 27px; padding: 0 7px;
    background: #1a1d28; border: 1px solid #2a2f3d; border-radius: 6px;
    color: #e6e8ef; font: 600 12.5px ui-monospace, monospace; outline: none;
  }
  input.v:focus { border-color: #4b5675; }
  .presets { display: flex; gap: 4px; margin-top: 6px; }
  .presets button {
    flex: 1; height: 22px; padding: 0; cursor: pointer;
    background: #1a1d28; border: 1px solid #2a2f3d; border-radius: 5px;
    color: #aab0c0; font: 600 11px ui-monospace, monospace;
  }
  .presets button:hover { background: #222634; color: #fff; }
  .presets button.on { background: #2563eb; border-color: #2563eb; color: #fff; }
  .go {
    width: 100%; margin-top: 9px; height: 32px; cursor: pointer;
    background: #f0761a; border: 0; border-radius: 7px;
    color: #fff; font: 700 13px ui-sans-serif, system-ui, sans-serif;
    letter-spacing: .3px;
  }
  .go:hover { background: #ff8524; }
  .go:disabled { opacity: .55; cursor: default; }
  .st { margin-top: 6px; min-height: 14px; font-size: 10.5px; color: #8b93a7;
        white-space: pre-wrap; }
  .st.ok { color: #46c66d; }
  .st.err { color: #ff6b6b; }
  .cfg { display: none; margin-top: 8px; border-top: 1px solid #242835; padding-top: 7px; }
  .cfg.open { display: block; }
  .cfg .lbl { margin-top: 5px; }
  .cfg input.v, .cfg select.v {
    font: 500 11px ui-monospace, monospace; height: 24px;
    width: 100%; box-sizing: border-box; padding: 0 6px;
    background: #1a1d28; border: 1px solid #2a2f3d; border-radius: 6px;
    color: #e6e8ef; outline: none;
  }
  .chk { display: flex; align-items: center; gap: 6px; margin-top: 7px;
         font-size: 10.5px; color: #aab0c0; cursor: pointer; }
  `;

  const HTML = `
  <div class="qp">
    <div class="hdr">
      <span class="ttl">⚡ Meteora QP</span>
      <button class="ico" id="cfgBtn" title="Настройки">⚙</button>
      <button class="ico" id="colBtn" title="Свернуть">▾</button>
    </div>
    <div class="body">
      <div class="row">
        <div class="fld"><div class="lbl">SOL</div><input class="v" id="sol" inputmode="decimal"></div>
        <div class="fld"><div class="lbl">Min %</div><input class="v" id="min" inputmode="decimal"></div>
        <div class="fld"><div class="lbl">Max %</div><input class="v" id="max" inputmode="decimal"></div>
      </div>
      <div class="presets" id="rangeRow"></div>
      <div class="presets" id="solRow"></div>
      <button class="go" id="go">⚡ YOLO IN</button>
      <div class="st" id="st"></div>
      <div class="cfg" id="cfg">
        <div class="lbl">Пресеты диапазона, %</div>
        <input class="v" id="cfgRange">
        <div class="lbl">Пресеты суммы, SOL</div>
        <input class="v" id="cfgSol">
        <div class="lbl">Стратегия</div>
        <select class="v" id="cfgStrategy">
          <option value="Spot">Spot</option>
          <option value="Curve">Curve</option>
          <option value="Bid Ask">Bid Ask</option>
          <option value="">не трогать</option>
        </select>
        <label class="chk"><input type="checkbox" id="cfgSubmit"> нажимать кнопку отправки</label>
      </div>
    </div>
  </div>`;

  let host = null, root = null, busy = false;

  const $ = (id) => root.getElementById(id);

  function status(text, kind) {
    const el = $('st');
    el.textContent = text || '';
    el.className = 'st' + (kind ? ' ' + kind : '');
  }

  function paintPresets() {
    const c = S.get();
    const mk = (row, values, active, onPick) => {
      row.textContent = '';
      for (const v of values) {
        const b = document.createElement('button');
        b.textContent = String(v);
        if (Number(active) === Number(v)) b.className = 'on';
        b.addEventListener('click', () => onPick(v));
        row.appendChild(b);
      }
    };
    // Верхний ряд — ширина диапазона: один клик ставит обе границы симметрично.
    mk($('rangeRow'), c.rangePresets, Math.abs(Number($('max').value)), (v) => {
      $('min').value = String(-v);
      $('max').value = String(v);
      S.save({ minPct: -v, maxPct: v });
      paintPresets();
    });
    mk($('solRow'), c.solPresets, $('sol').value, (v) => {
      $('sol').value = String(v);
      S.save({ sol: v });
      paintPresets();
    });
  }

  function readFields() {
    const f = (id) => parseFloat(String($(id).value).replace(',', '.'));
    return { sol: f('sol'), minPct: f('min'), maxPct: f('max') };
  }

  function validate(v) {
    if (!Number.isFinite(v.sol) || v.sol <= 0) return 'сумма SOL должна быть больше нуля';
    if (!Number.isFinite(v.minPct) || !Number.isFinite(v.maxPct)) return 'проценты не заполнены';
    if (v.minPct >= v.maxPct) return 'Min % должен быть меньше Max %';
    return null;
  }

  async function go() {
    if (busy) return;
    const v = readFields();
    const bad = validate(v);
    if (bad) return status(bad, 'err');

    busy = true;
    $('go').disabled = true;
    status('…');
    await S.save({ sol: v.sol, minPct: v.minPct, maxPct: v.maxPct });

    try {
      const cfg = { ...v, strategy: S.get().strategy, autoSubmit: S.get().autoSubmit, quoteSymbol: 'SOL' };
      const r = await window.QPActions.run(cfg, (m) => status(m));
      const pct = (x) => (x == null ? '?' : (x > 0 ? '+' : '') + x + '%');
      const tail = r.submitted
        ? 'отправлено — подтверди в кошельке'
        : (r.submitLabel ? `кнопка «${r.submitLabel}» не нажата` : 'поля заполнены');
      const other = r.otherAmount ? ` · ${r.otherSymbol} ${r.otherAmount}` : '';
      status(`✅ Готово: ${pct(r.min)} … ${pct(r.max)} · ${r.bins ?? '?'} бинов · ${r.strategy || '—'}${other}\n${tail}`, 'ok');
    } catch (e) {
      status('✗ ' + (e && e.message ? e.message : String(e)), 'err');
    } finally {
      busy = false;
      $('go').disabled = false;
    }
  }

  function wire() {
    const c = S.get();
    $('sol').value = c.sol;
    $('min').value = c.minPct;
    $('max').value = c.maxPct;
    $('cfgRange').value = c.rangePresets.join(', ');
    $('cfgSol').value = c.solPresets.join(', ');
    $('cfgStrategy').value = c.strategy;
    $('cfgSubmit').checked = !!c.autoSubmit;
    if (c.collapsed) root.querySelector('.qp').classList.add('collapsed');

    $('go').addEventListener('click', go);
    for (const id of ['sol', 'min', 'max']) {
      $(id).addEventListener('input', paintPresets);
      $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }

    $('colBtn').addEventListener('click', () => {
      const q = root.querySelector('.qp');
      q.classList.toggle('collapsed');
      const collapsed = q.classList.contains('collapsed');
      $('colBtn').textContent = collapsed ? '▴' : '▾';
      S.save({ collapsed });
    });
    $('cfgBtn').addEventListener('click', () => $('cfg').classList.toggle('open'));

    $('cfgRange').addEventListener('change', (e) => {
      const list = S.parseList(e.target.value);
      if (list.length) { S.save({ rangePresets: list }); paintPresets(); }
      e.target.value = S.get().rangePresets.join(', ');
    });
    $('cfgSol').addEventListener('change', (e) => {
      const list = S.parseList(e.target.value);
      if (list.length) { S.save({ solPresets: list }); paintPresets(); }
      e.target.value = S.get().solPresets.join(', ');
    });
    $('cfgStrategy').addEventListener('change', (e) => S.save({ strategy: e.target.value }));
    $('cfgSubmit').addEventListener('change', (e) => S.save({ autoSubmit: e.target.checked }));

    paintPresets();
  }

  function mount() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'meteora-qp-host';
    root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    root.appendChild(wrap.firstElementChild);
    document.documentElement.appendChild(host);
    wire();
  }

  function unmount() {
    if (host) host.remove();
    host = null; root = null;
  }

  const isMounted = () => !!(host && host.isConnected);

  return { mount, unmount, isMounted };
})();
