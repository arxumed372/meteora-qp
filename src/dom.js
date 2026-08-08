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

  // На странице может быть открыта либо вкладка Create Position, либо drawer
  // существующей позиции с вкладкой Add. Разметка у них одна и та же, поэтому
  // берём последнюю видимую: drawer монтируется позже базовой панели.
  const lastVisible = (sel) => {
    const list = allVisible(sel);
    return list.length ? list[list.length - 1] : null;
  };

  // Корень панели — ближайший общий предок блока сумм и блока стратегии.
  // Всё остальное ищем внутри него, чтобы не поймать контрол из соседней панели.
  function panelRoot() {
    const amounts = lastVisible('[data-tour="amount-fields"]');
    const strategy = lastVisible('[data-tour="strategy"]');
    if (!amounts) return null;
    if (!strategy) return amounts.parentElement;
    let node = amounts;
    while (node && !node.contains(strategy)) node = node.parentElement;
    return node || amounts.parentElement;
  }

  // Сколько панелей на экране. Больше одной — повод сказать об этом вслух,
  // а не молча заполнить не ту.
  const panelCount = () => allVisible('[data-tour="amount-fields"]').length;

  // Поле суммы для конкретного токена. Ориентация X/Y меняется от пула к пулу
  // (в TOAD-SOL SOL это Y, в SOL-USDC — X), поэтому только по символу.
  function amountInput(symbol) {
    const root = panelRoot();
    if (!root) return null;
    for (const tour of ['amount-input-x', 'amount-input-y']) {
      const wrap = root.querySelector(`[data-tour="${tour}"]`);
      if (!wrap) continue;
      const card = wrap.closest('div.flex.items-center') || wrap.parentElement;
      const img = card && card.querySelector('img[alt]');
      const alt = img && img.getAttribute('alt');
      if (alt && alt.toUpperCase() === symbol.toUpperCase()) {
        return wrap.querySelector('input');
      }
    }
    return null;
  }

  // Какие токены вообще есть в этой паре — для подписи в виджете.
  function pairSymbols() {
    const root = panelRoot();
    if (!root) return [];
    return ['amount-input-x', 'amount-input-y'].map(t => {
      const wrap = root.querySelector(`[data-tour="${t}"]`);
      const card = wrap && (wrap.closest('div.flex.items-center') || wrap.parentElement);
      const img = card && card.querySelector('img[alt]');
      return img ? img.getAttribute('alt') : null;
    }).filter(Boolean);
  }

  // Поле процента у границы диапазона. which: 'Min' | 'Max'.
  function pctInput(which) {
    const root = panelRoot() || document;
    const label = which === 'Min' ? 'Min Price' : 'Max Price';
    const box = [...root.querySelectorAll('[data-sentry-component="BinPriceInput"]')]
      .find(c => c.innerText.trim().startsWith(label));
    if (box) return box.querySelector('input[inputmode="decimal"]');
    // Запасной путь, если Sentry-атрибуты пропадут из сборки.
    const price = root.querySelector(`[role="button"][aria-label="${label} price"]`);
    const wrap = price && price.closest('div');
    return wrap ? (wrap.parentElement || wrap).querySelector('input[inputmode="decimal"]') : null;
  }

  const strategyButton = (name) => {
    const root = panelRoot();
    const box = (root && root.querySelector('[data-tour="strategy"]')) ||
                lastVisible('[data-tour="strategy"]');
    if (!box) return null;
    return [...box.querySelectorAll('button')]
      .find(b => b.innerText.trim().toLowerCase() === name.toLowerCase()) || null;
  };

  // Активная стратегия видна только по tailwind-классу подписи, поэтому это
  // средство проверки, а не источник истины.
  function activeStrategy() {
    const root = panelRoot();
    const box = root && root.querySelector('[data-tour="strategy"]');
    if (!box) return null;
    for (const b of box.querySelectorAll('button')) {
      const lit = [...b.children].some(c =>
        /(^|\s)text-v2-text-primary(\s|$)/.test(c.className || ''));
      if (lit) return b.innerText.trim();
    }
    return null;
  }

  const autoFillToggle = () => {
    const root = panelRoot();
    const amounts = (root && root.querySelector('[data-tour="amount-fields"]')) ||
                    lastVisible('[data-tour="amount-fields"]');
    return amounts ? amounts.querySelector('[data-sentry-component="Toggle"]') : null;
  };

  // null означает «не смог прочитать» — это не то же самое, что «выключен».
  function autoFillOn() {
    const t = autoFillToggle();
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
  // пользователю до нажатия, чтобы он видел, что именно будет нажато.
  function submitButton() {
    const root = panelRoot();
    if (!root) return null;
    const skip = /connect wallet|learn about|view details/i;
    const cands = [...root.querySelectorAll('button[data-slot="button"]')]
      .filter(b => visible(b) && !skip.test(b.innerText.trim()));
    return cands.length ? cands[cands.length - 1] : null;
  }

  const totalBins = () => {
    const root = panelRoot() || document;
    const pr = root.querySelector('[data-tour="price-range"]');
    const m = pr && pr.innerText.replace(/\s+/g, ' ').match(/Total Bins:\s*(\d+)/);
    return m ? Number(m[1]) : null;
  };

  // React слушает событие, а не присваивание. Нативный сеттер прототипа —
  // единственный способ, который приложение действительно замечает.
  function setReactValue(el, value) {
    if (!el) return false;
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
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
  function snapshot() {
    const v = (el) => (el ? el.value : null);
    return {
      min: v(pctInput('Min')),
      max: v(pctInput('Max')),
      bins: totalBins(),
      strategy: activeStrategy(),
      autoFill: autoFillOn(),
    };
  }

  const isDlmmPage = () => /^\/dlmm\//.test(location.pathname) && !!panelRoot();

  return {
    visible, panelRoot, panelCount, amountInput, pairSymbols, pctInput,
    strategyButton, activeStrategy, autoFillToggle, autoFillOn, submitButton,
    totalBins, setReactValue, pressEnter, snapshot, isDlmmPage,
  };
})();
