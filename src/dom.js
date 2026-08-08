// Слой якорей. Единственное место, которое знает, как устроен DOM Meteora.
// Если сайт поменяется — правится только этот файл.
//
// Правило: цепляемся за смысловые атрибуты (data-tour, data-sentry-component,
// aria-label, role) и за текст. Ни одного nth-child и ни одного tailwind-класса
// как источника истины — они меняются от сборки к сборке.
window.QPDom = (() => {

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const allVisible = (sel, root = document) =>
    [...root.querySelectorAll(sel)].filter(visible);

  const textOf = (el) => (el.innerText || el.textContent || '').trim();

  // ── Какая панель перед нами ─────────────────────────────────────────────
  //
  // На странице бывают ДВЕ разные панели с одинаковыми полями:
  //   1) вкладка «Create Position» — создать новую позицию;
  //   2) drawer открытой позиции с вкладками «Add / Rebalance / Withdraw» —
  //      долить в существующую.
  // QP делает первое. Раньше я брал «последнюю видимую» и на открытой позиции
  // попадал во вторую — то есть заполнял не ту панель. Теперь панель Create
  // Position опознаётся положительно, а не по порядку в DOM.

  // Открыт ли drawer существующей позиции.
  function drawerOpen() {
    const names = new Set(['rebalance', 'withdraw']);
    const hits = new Set();
    for (const el of allVisible('[role="tab"], button')) {
      const t = textOf(el).toLowerCase();
      if (names.has(t)) hits.add(t);
    }
    return hits.size === names.size;
  }

  // Вкладка «Create Position» внутри панели создания позиции.
  function createTab() {
    return allVisible('[role="tab"]')
      .find(t => /^create position$/i.test(textOf(t))) || null;
  }

  // Корень панели создания позиции: ближайший предок вкладки, который
  // содержит поля сумм.
  function panelRoot() {
    const tab = createTab();
    if (tab) {
      // Radix связывает вкладку с её содержимым через aria-controls — это
      // точная ссылка, а не догадка по дереву.
      const id = tab.getAttribute('aria-controls');
      const byId = id && document.getElementById(id);
      if (byId && byId.querySelector('[data-tour="amount-fields"]')) return byId;
      // Запасной путь: первый предок с полями сумм, и только если он один.
      let node = tab;
      while (node && !node.querySelector('[data-tour="amount-fields"]')) node = node.parentElement;
      if (node && node.querySelectorAll('[data-tour="amount-fields"]').length === 1) return node;
    }
    // Вкладок нет вовсе — значит другой макет. Берём единственную панель с
    // полями сумм, но только если drawer точно не открыт.
    if (drawerOpen()) return null;
    const amounts = allVisible('[data-tour="amount-fields"]');
    if (amounts.length !== 1) return null;
    let node = amounts[0];
    const strategy = allVisible('[data-tour="strategy"]')[0];
    while (node && strategy && !node.contains(strategy)) node = node.parentElement;
    return node || amounts[0].parentElement;
  }

  // Вкладка Create Position может быть не активна (открыт Swap или Limit Order).
  function ensureCreateTab() {
    const tab = createTab();
    if (!tab) return false;
    if (tab.getAttribute('aria-selected') === 'true') return true;
    tab.click();
    return true;
  }

  // ── Контролы внутри панели ──────────────────────────────────────────────

  // Карточка токена: поднимаемся от поля вверх, пока не найдём логотип токена.
  // Раньше здесь был closest('div.flex.items-center') — tailwind-класс, то есть
  // ровно то, чего мы договорились не делать.
  function tokenOfInput(wrap) {
    let node = wrap;
    for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
      const img = node.querySelector('img[alt]');
      if (img && img.getAttribute('alt')) return img.getAttribute('alt');
    }
    return null;
  }

  // Поле суммы для конкретного токена. Ориентация X/Y меняется от пула к пулу
  // (в TOAD-SOL SOL это Y, в SOL-USDC — X), поэтому только по символу.
  function amountInput(symbol, root = panelRoot()) {
    if (!root) return null;
    for (const tour of ['amount-input-x', 'amount-input-y']) {
      const wrap = root.querySelector(`[data-tour="${tour}"]`);
      if (!wrap) continue;
      const alt = tokenOfInput(wrap);
      if (alt && alt.toUpperCase() === symbol.toUpperCase()) return wrap.querySelector('input');
    }
    return null;
  }

  function pairSymbols(root = panelRoot()) {
    if (!root) return [];
    return ['amount-input-x', 'amount-input-y']
      .map(t => {
        const wrap = root.querySelector(`[data-tour="${t}"]`);
        return wrap ? tokenOfInput(wrap) : null;
      })
      .filter(Boolean);
  }

  // Поле процента у границы диапазона. which: 'Min' | 'Max'.
  function pctInput(which, root = panelRoot()) {
    const scope = root || document;
    const label = which === 'Min' ? 'Min Price' : 'Max Price';
    const box = [...scope.querySelectorAll('[data-sentry-component="BinPriceInput"]')]
      .find(c => textOf(c).startsWith(label));
    if (box) return box.querySelector('input[inputmode="decimal"]');
    // Запасной путь, если Sentry-атрибуты пропадут из сборки.
    const price = scope.querySelector(`[role="button"][aria-label="${label} price"]`);
    let node = price;
    for (let i = 0; i < 4 && node; i++, node = node.parentElement) {
      const inp = node.querySelector('input[inputmode="decimal"]');
      if (inp) return inp;
    }
    return null;
  }

  function strategyButton(name, root = panelRoot()) {
    const box = root && root.querySelector('[data-tour="strategy"]');
    if (!box) return null;
    return [...box.querySelectorAll('button')]
      .find(b => textOf(b).toLowerCase() === name.toLowerCase()) || null;
  }

  // Активная стратегия видна только по tailwind-классу подписи, поэтому это
  // средство проверки, а не источник истины.
  function activeStrategy(root = panelRoot()) {
    const box = root && root.querySelector('[data-tour="strategy"]');
    if (!box) return null;
    for (const b of box.querySelectorAll('button')) {
      const lit = [...b.children].some(c =>
        /(^|\s)text-v2-text-primary(\s|$)/.test(c.className || ''));
      if (lit) return textOf(b);
    }
    return null;
  }

  function autoFillToggle(root = panelRoot()) {
    const amounts = root && root.querySelector('[data-tour="amount-fields"]');
    return amounts ? amounts.querySelector('[data-sentry-component="Toggle"]') : null;
  }

  // null означает «не смог прочитать» — это не то же самое, что «выключен».
  function autoFillOn(root = panelRoot()) {
    const t = autoFillToggle(root);
    if (!t) return null;
    const cls = t.className || '';
    if (/(^|\s)bg-primary(\s|$)/.test(cls)) return true;
    if (/bg-v2|bg-neutral|bg-gray|bg-transparent/.test(cls)) return false;
    const knob = t.querySelector('div');
    if (knob && /translate-x-\[/.test(knob.className || '')) return true;
    if (knob && /left-\[2px\]/.test(knob.className || '')) return false;
    return null;
  }

  // Кнопка отправки — последняя видимая кнопка панели. Её подпись показываем
  // пользователю, чтобы он видел, что именно будет нажато.
  function submitButton(root = panelRoot()) {
    if (!root) return null;
    const skip = /connect wallet|learn about|view details/i;
    const cands = [...root.querySelectorAll('button[data-slot="button"]')]
      .filter(b => visible(b) && !skip.test(textOf(b)));
    return cands.length ? cands[cands.length - 1] : null;
  }

  function totalBins(root = panelRoot()) {
    const scope = root || document;
    const pr = scope.querySelector('[data-tour="price-range"]');
    const m = pr && pr.innerText.replace(/\s+/g, ' ').match(/Total Bins:\s*(\d+)/);
    return m ? Number(m[1]) : null;
  }

  // React слушает событие, а не присваивание. Нативный сеттер прототипа —
  // единственный способ, который приложение действительно замечает.
  function setReactValue(el, value) {
    if (!el) return false;
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    el.focus();
    if (desc && desc.set) desc.set.call(el, String(value));
    else el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  const pressEnter = (el) => {
    for (const type of ['keydown', 'keypress', 'keyup']) {
      el.dispatchEvent(new KeyboardEvent(type, {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
      }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  };

  // Снимок состояния — по нему ждём, пока приложение пересчитает бины.
  function snapshot(root = panelRoot()) {
    const v = (el) => (el ? el.value : null);
    return {
      min: v(pctInput('Min', root)),
      max: v(pctInput('Max', root)),
      bins: totalBins(root),
      strategy: activeStrategy(root),
      autoFill: autoFillOn(root),
    };
  }

  // Виджет показываем на любой странице пула — даже если открыт drawer,
  // потому что сообщение об этом должно быть видно пользователю.
  const isDlmmPage = () =>
    /^\/dlmm\//.test(location.pathname) &&
    allVisible('[data-tour="amount-fields"]').length > 0;

  return {
    visible, allVisible, textOf, drawerOpen, createTab, ensureCreateTab,
    panelRoot, amountInput, pairSymbols, pctInput, strategyButton,
    activeStrategy, autoFillToggle, autoFillOn, submitButton, totalBins,
    setReactValue, pressEnter, snapshot, isDlmmPage,
  };
})();
