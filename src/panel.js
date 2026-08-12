// Виджет. Живёт в shadow DOM, чтобы стили Meteora на него не влияли и наши
// на неё тоже. Ничего не знает про DOM сайта — только зовёт QPActions.
//
// Раскладка повторяет панель 0xVanChu: слева три поля и оранжевая кнопка,
// справа два ряда пресетов, в шапке один ▾. Статус — под кнопкой справа.
window.QPPanel = (() => {
  const S = window.QPSettings;

  const CSS = `
  :host { all: initial; }
  .qp {
    position: fixed; right: 12px; bottom: 12px; z-index: 2147483000;
    width: 462px; box-sizing: border-box;
    font: 12px/1.3 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #e8eaf2; background: #171b2b; border: 1px solid #2b3145;
    border-radius: 9px; padding: 8px 10px 9px;
    box-shadow: 0 10px 30px rgba(0,0,0,.5);
    user-select: none;
  }
  .qp.collapsed { width: auto; padding: 6px 10px; }
  .qp.collapsed .main { display: none; }

  /* Заголовок — ручка для перетаскивания. */
  .hdr { display: flex; align-items: center; gap: 8px; position: relative;
         cursor: grab; touch-action: none; }
  .qp.dragging { box-shadow: 0 14px 40px rgba(0,0,0,.65); }
  .qp.dragging .hdr { cursor: grabbing; }
  .ttl { font-weight: 600; font-size: 12px; letter-spacing: .2px; flex: 1;
         white-space: nowrap; color: #f2f4fa; }
  /* Страховка от тупика: по заголовку панель всегда разворачивается обратно,
     даже если до меню почему-то не добраться. */
  .qp.collapsed .ttl { cursor: pointer; }
  .qp.collapsed .ttl:hover { color: #fff; }
  .ttl .b { color: #f5a524; margin-right: 3px; }
  .menuBtn {
    cursor: pointer; width: 22px; height: 20px; padding: 0;
    border: 1px solid #2f3549; background: #1e2436; color: #9aa2b8;
    border-radius: 5px; font-size: 10px; line-height: 18px; text-align: center;
  }
  .menuBtn:hover { background: #262d42; color: #fff; }
  /* По умолчанию меню раскрывается ВВЕРХ: панель стоит у нижнего края, и вниз
     оно уезжало за границу окна — свернуть можно, развернуть нечем. Но панель
     теперь таскается, поэтому направление выбирается при каждом открытии по
     фактическому свободному месту, класс .down переворачивает его вниз. */
  .menu {
    display: none; position: absolute; right: 0; bottom: calc(100% + 6px); z-index: 5;
    background: #1e2436; border: 1px solid #2f3549; border-radius: 6px;
    padding: 4px; min-width: 150px; box-shadow: 0 6px 18px rgba(0,0,0,.5);
  }
  .menu.down { bottom: auto; top: calc(100% + 6px); }
  .menu.open { display: block; }
  .menu div {
    padding: 5px 8px; border-radius: 4px; cursor: pointer;
    font-size: 11px; color: #c9cee0;
  }
  .menu div:hover { background: #2a3149; color: #fff; }

  .main { display: flex; gap: 10px; margin-top: 8px; }
  .left { flex: 1; min-width: 0; }
  .right { width: 182px; flex: none; display: flex; flex-direction: column;
           justify-content: flex-start; gap: 5px; }

  .row { display: flex; gap: 7px; }
  .fld { flex: 1; min-width: 0; }
  .lbl { font-size: 9px; color: #767e94; margin: 0 0 3px 1px; letter-spacing: .4px; }
  input.v {
    width: 100%; box-sizing: border-box; height: 29px; padding: 0 8px;
    background: #10141f; border: 1px solid #2f3549; border-radius: 6px;
    color: #e8eaf2; font: 600 13px ui-monospace, SFMono-Regular, monospace;
    outline: none;
  }
  input.v:focus { border-color: #3f79c8; }

  .presets { display: flex; gap: 5px; }
  .presets button {
    flex: 1; height: 26px; padding: 0; cursor: pointer;
    background: #10141f; border: 1px solid #2f3549; border-radius: 5px;
    color: #a7aec2; font: 600 11px ui-monospace, monospace;
  }
  .presets button:hover { background: #1c2333; color: #fff; }
  .presets button.on { background: #2f9ef4; border-color: #2f9ef4; color: #fff; }

  .go {
    width: 100%; margin-top: 9px; height: 32px; cursor: pointer;
    background: #f4881f; border: 0; border-radius: 6px;
    color: #fff; font: 700 13px ui-sans-serif, system-ui, sans-serif;
    letter-spacing: .2px;
  }
  .go:hover { background: #ff9730; }
  .go:disabled { opacity: .6; cursor: default; }

  .st { margin-top: 5px; min-height: 13px; font-size: 10.5px; color: #8b93a7;
        text-align: right; white-space: pre-wrap; }
  .st.ok { color: #4ade80; }
  .st.err { color: #ff6b6b; }

  .cfg { display: none; margin-top: 8px; border-top: 1px solid #262c3d; padding-top: 7px; }
  .cfg.open { display: block; }
  .cfg .two { display: flex; gap: 8px; }
  .cfg .two > div { flex: 1; }
  .cfg input.v, .cfg select.v {
    font: 500 11px ui-monospace, monospace; height: 25px;
    width: 100%; box-sizing: border-box; padding: 0 6px;
    background: #10141f; border: 1px solid #2f3549; border-radius: 5px;
    color: #e8eaf2; outline: none;
  }
  .chk { display: flex; align-items: center; gap: 6px; margin-top: 8px;
         font-size: 10.5px; color: #a7aec2; cursor: pointer; }
  `;

  const HTML = `
  <div class="qp">
    <div class="hdr">
      <span class="ttl"><span class="b">⚡</span>Meteora QP</span>
      <button class="menuBtn" id="menuBtn" title="Меню">▾</button>
      <div class="menu" id="menu">
        <div id="mCfg">Пресеты и настройки</div>
        <div id="mCol">Свернуть панель</div>
        <div id="mPos">Вернуть в угол</div>
      </div>
    </div>
    <div class="main">
      <div class="left">
        <div class="row">
          <div class="fld"><div class="lbl">SOL</div><input class="v" id="sol" inputmode="decimal"></div>
          <div class="fld"><div class="lbl">Min %</div><input class="v" id="min" inputmode="decimal"></div>
          <div class="fld"><div class="lbl">Max %</div><input class="v" id="max" inputmode="decimal"></div>
        </div>
        <button class="go" id="go">⚡ Yolo In</button>
        <div class="st" id="st"></div>
        <div class="cfg" id="cfg">
          <div class="two">
            <div>
              <div class="lbl">Пресеты диапазона, %</div>
              <input class="v" id="cfgRange">
            </div>
            <div>
              <div class="lbl">Пресеты суммы, SOL</div>
              <input class="v" id="cfgSol">
            </div>
          </div>
          <div class="two" style="margin-top:6px">
            <div>
              <div class="lbl">Стратегия</div>
              <select class="v" id="cfgStrategy">
                <option value="Spot">Spot</option>
                <option value="Curve">Curve</option>
                <option value="Bid Ask">Bid Ask</option>
                <option value="">не трогать</option>
              </select>
            </div>
            <div>
              <label class="chk"><input type="checkbox" id="cfgSubmit"> нажимать кнопку отправки</label>
            </div>
          </div>
        </div>
      </div>
      <div class="right">
        <div class="presets" id="rangeRow"></div>
        <div class="presets" id="solRow"></div>
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
      const other = r.otherAmount ? ` · ${r.otherSymbol} ${r.otherAmount}` : '';
      const head = r.submitted ? '✅ Done!' : '✅ Заполнено';
      const tail = r.submitted
        ? 'подтверди в кошельке'
        : (r.submitLabel ? `«${r.submitLabel}» не нажата` : '');
      status(`${head}  ${pct(r.min)} … ${pct(r.max)} · ${r.bins ?? '?'} бинов${other}\n${tail}`, 'ok');
    } catch (e) {
      status('✗ ' + (e && e.message ? e.message : String(e)), 'err');
    } finally {
      busy = false;
      $('go').disabled = false;
    }
  }

  const isCollapsed = () => root.querySelector('.qp').classList.contains('collapsed');

  // ── Перетаскивание ──────────────────────────────────────────────────────
  //
  // Панель по умолчанию приклеена к правому нижнему углу (right/bottom). Как
  // только её потащили, переходим на left/top — иначе координаты мыши и
  // координаты панели считаются от разных углов и она едет в другую сторону.
  //
  // Главное правило: панель нельзя утащить за край экрана. Прошлый баг был
  // ровно про это — свёрнутое окно оказалось недостижимым. Поэтому любое
  // положение проходит через clamp, и он же вызывается при ресайзе окна.
  const MARGIN = 4;

  function clamp(left, top) {
    const qp = root.querySelector('.qp');
    const w = qp.offsetWidth, h = qp.offsetHeight;
    const maxLeft = Math.max(MARGIN, innerWidth - w - MARGIN);
    const maxTop = Math.max(MARGIN, innerHeight - h - MARGIN);
    return {
      left: Math.min(Math.max(MARGIN, left), maxLeft),
      top: Math.min(Math.max(MARGIN, top), maxTop),
    };
  }

  function applyPos(pos) {
    const qp = root.querySelector('.qp');
    if (!pos) {                       // вернуться в угол
      qp.style.left = qp.style.top = '';
      qp.style.right = '12px';
      qp.style.bottom = '12px';
      return;
    }
    const p = clamp(pos.left, pos.top);
    qp.style.right = qp.style.bottom = 'auto';
    qp.style.left = p.left + 'px';
    qp.style.top = p.top + 'px';
    return p;
  }

  // Свёрнутая панель меняет размер, поэтому положение переприжимаем и после
  // сворачивания, и после ресайза окна.
  function reclamp() {
    const saved = S.get().pos;
    if (!saved) return;
    const p = applyPos(saved);
    if (p && (p.left !== saved.left || p.top !== saved.top)) S.save({ pos: p });
  }

  let justDragged = false;

  function initDrag() {
    const qp = root.querySelector('.qp');
    const hdr = root.querySelector('.hdr');
    let start = null;

    // Перетаскивание держится на setPointerCapture, и это не вкусовщина.
    // Замерял три варианта на живой странице:
    //   1) слушать на самой шапке — она высотой ~20px, курсор уходит с неё на
    //      первом же движении, панель не едет вообще;
    //   2) слушать на окне — едет, но ровно до середины экрана: там график
    //      TradingView, он в IFRAME, и события уходят внутрь него. Верхний
    //      документ замолкает целиком, теряется и pointerup, поэтому положение
    //      даже не сохранялось;
    //   3) захват указателя — события приходят при любом положении курсора,
    //      включая iframe. Расплата: последующий click перенацеливается на
    //      элемент-захватчик, поэтому разворачивание по клику висит на шапке,
    //      а не на заголовке, и гасится флагом после реального перетаскивания.
    const onMove = (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      // Порог: без него любой клик по заголовку считался бы перетаскиванием.
      if (!start.moved && Math.hypot(dx, dy) < 4) return;
      if (!start.moved) { start.moved = true; qp.classList.add('dragging'); }
      applyPos({ left: start.left + dx, top: start.top + dy });
      e.preventDefault();
    };

    const onUp = () => {
      if (!start) return;
      const moved = start.moved;
      start = null;
      qp.classList.remove('dragging');
      if (!moved) return;             // это был клик, положение не трогаем
      justDragged = true;             // гасим click, который придёт следом
      const r = qp.getBoundingClientRect();
      const p = clamp(r.left, r.top);
      applyPos(p);
      S.save({ pos: p });
    };

    hdr.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.menuBtn, .menu')) return;   // это клики, не таскание
      const r = qp.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false };
      try { hdr.setPointerCapture(e.pointerId); } catch (err) { /* редкий браузер */ }
    });
    hdr.addEventListener('pointermove', onMove);
    hdr.addEventListener('pointerup', onUp);
    hdr.addEventListener('pointercancel', onUp);

    // Разворачивание по клику висит здесь, а не на заголовке: захват указателя
    // перенацеливает click на шапку, и обработчик на .ttl просто не сработает.
    hdr.addEventListener('click', (e) => {
      if (justDragged) { justDragged = false; return; }
      if (e.target.closest('.menuBtn, .menu')) return;
      if (isCollapsed()) setCollapsed(false);
    });

    addEventListener('resize', reclamp);
  }

  function setCollapsed(collapsed) {
    const qp = root.querySelector('.qp');
    qp.classList.toggle('collapsed', collapsed);
    $('mCol').textContent = collapsed ? 'Развернуть панель' : 'Свернуть панель';
    qp.querySelector('.ttl').title = collapsed ? 'Развернуть' : '';
    S.save({ collapsed });
    reclamp();      // размер изменился — вернуть в границы экрана
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
    if (c.collapsed) setCollapsed(true);
    if (c.pos) applyPos(c.pos);
    initDrag();

    $('go').addEventListener('click', go);
    for (const id of ['sol', 'min', 'max']) {
      $(id).addEventListener('input', paintPresets);
      $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }

    const menu = $('menu');
    $('menuBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = !menu.classList.contains('open');
      if (opening) {
        // Панель можно утащить наверх, поэтому направление выбираем по месту:
        // меню всегда должно помещаться на экране целиком.
        menu.classList.add('open');
        menu.classList.remove('down');
        const r = menu.getBoundingClientRect();
        if (r.top < 0) menu.classList.add('down');
      } else {
        menu.classList.remove('open');
      }
    });
    // Клик мимо меню закрывает его — и внутри shadow DOM, и на самой странице.
    root.addEventListener('click', () => menu.classList.remove('open'));
    document.addEventListener('click', () => menu.classList.remove('open'));

    $('mCfg').addEventListener('click', () => {
      if (isCollapsed()) setCollapsed(false);   // настройки в свёрнутой панели не видны
      $('cfg').classList.add('open');
    });
    $('mCol').addEventListener('click', () => setCollapsed(!isCollapsed()));
    $('mPos').addEventListener('click', () => { applyPos(null); S.save({ pos: null }); });
    // Клик по заголовку разворачивает панель — второй путь наружу, без меню.
    // Живёт в initDrag на самой шапке: захват указателя перенацеливает click,
    // и обработчик на .ttl не сработал бы. Здесь только страховка на случай,
    // если setPointerCapture недоступен и перенацеливания не будет.
    root.querySelector('.ttl').addEventListener('click', () => {
      if (justDragged) return;
      if (isCollapsed()) setCollapsed(false);
    });

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
