// Сценарий YOLO IN.
//
// Порядок здесь не декоративный, он измерен на живой странице. Meteora сама
// переписывает диапазон в односторонний, пока введена одна сумма, — поэтому
// сумма идёт ДО границ, а границы после неё встают и держатся:
//
//   Auto-Fill off -> сумма SOL -> Max % -> Min %
//
// Обратный порядок (границы, потом сумма) даёт -42% / 0% и 70 бинов вместо
// того, что просили. Проверено четырьмя прогонами, см. отчёт Фазы 1.
window.QPActions = (() => {
  const D = window.QPDom;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Ждём, пока приложение перестанет пересчитывать: снимок должен совпасть
  // сам с собой два раза подряд. Возврат по таймауту — не ошибка, а сигнал,
  // что дальше идём с тем, что есть.
  async function settle(root, { quiet = 450, timeout = 6000 } = {}) {
    const t0 = Date.now();
    let prev = JSON.stringify(D.snapshot(root));
    let stableSince = Date.now();
    while (Date.now() - t0 < timeout) {
      await sleep(150);
      const now = JSON.stringify(D.snapshot(root));
      if (now !== prev) { prev = now; stableSince = Date.now(); continue; }
      if (Date.now() - stableSince >= quiet) return true;
    }
    return false;
  }

  const num = (s) => {
    const m = String(s == null ? '' : s).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };

  async function writePct(root, which, value, report) {
    const el = D.pctInput(which, root);
    if (!el) throw new Error(`не нашёл поле ${which} %`);
    D.setReactValue(el, value);
    D.pressEnter(el);
    report(`${which} set, waiting…`);
    await settle(root);
    const after = D.pctInput(which, root);
    return num(after && after.value);
  }

  // QP создаёт НОВУЮ позицию. Если открыт drawer существующей — панель полей
  // принадлежит ей, и заполнять её нельзя: деньги уйдут не туда, куда просили.
  function resolvePanel() {
    // Fail-closed: пока на экране висит окно существующей позиции, мы не можем
    // доказать, какую из двух одинаковых панелей заполняем. Цена ошибки —
    // реальные деньги не туда, поэтому отказ, а не догадка.
    if (D.drawerOpen()) {
      throw new Error('открыто окно существующей позиции — закрой его крестиком, QP открывает НОВУЮ');
    }
    D.ensureCreateTab();
    const root = D.panelRoot();
    if (root) return root;
    throw new Error('панель Create Position не найдена');
  }

  async function run(cfg, report) {
    const quote = cfg.quoteSymbol || 'SOL';
    const root = resolvePanel();

    // 1. Auto-Fill выключаем: иначе Meteora подставит второй токен.
    const on = D.autoFillOn(root);
    if (on === true) {
      report('Auto-Fill off…');
      D.autoFillToggle(root).click();
      await settle(root, { quiet: 350, timeout: 4000 });
    } else if (on === null) {
      report('не читаю Auto-Fill — проверю результат в конце');
    }

    // 2. Стратегия. Пустая строка в настройках означает «не трогать».
    if (cfg.strategy) {
      const btn = D.strategyButton(cfg.strategy, root);
      if (!btn) throw new Error(`не нашёл стратегию ${cfg.strategy}`);
      btn.click();
      report(`${cfg.strategy}…`);
      await settle(root, { quiet: 350, timeout: 4000 });
    }

    // 3. Сумма — до границ. Это и есть весь фокус.
    const amount = D.amountInput(quote, root);
    if (!amount) throw new Error(`не нашёл поле суммы ${quote} в этой паре`);
    if (amount.disabled) throw new Error(`поле ${quote} заблокировано — диапазон не пускает эту сторону`);
    D.setReactValue(amount, cfg.sol);
    report(`${quote} ${cfg.sol} set, waiting…`);
    await settle(root);

    // 4. Границы: сначала Max, потом Min — как у оригинала.
    const gotMax = await writePct(root, 'Max', cfg.maxPct, report);
    const gotMin = await writePct(root, 'Min', cfg.minPct, report);

    // 5. Проверяем, что получилось на самом деле. Проценты защёлкиваются на
    // бины, поэтому введённое и фактическое почти никогда не совпадают.
    const base = D.amountInput(quote, root);
    const other = D.pairSymbols(root).find(s => s.toUpperCase() !== quote.toUpperCase());
    const otherEl = other ? D.amountInput(other, root) : null;
    const otherVal = otherEl ? num(otherEl.value) : null;

    const result = {
      min: gotMin, max: gotMax,
      bins: D.totalBins(root),
      amount: num(base && base.value),
      strategy: D.activeStrategy(root),
      otherSymbol: other,
      otherAmount: otherVal,
    };

    if (num(base && base.value) !== Number(cfg.sol)) {
      throw new Error(`сумма не встала: в поле ${base ? base.value : '—'}`);
    }
    if (otherVal) {
      // Односторонний вход не получился — второй токен всё-таки подставлен.
      report(`внимание: ${other} = ${otherEl.value}, вход не чисто ${quote}`);
    }

    // 6. Отправка. Подпись всегда остаётся в кошельке пользователя.
    const btn = D.submitButton(root);
    result.submitLabel = btn ? D.textOf(btn) : null;
    result.submitted = false;

    if (cfg.autoSubmit) {
      if (!btn) throw new Error('не нашёл кнопку отправки');
      if (btn.disabled) {
        report(`«${result.submitLabel}» недоступна — нажми сам`);
        return result;
      }
      report(`жму «${result.submitLabel}»…`);
      btn.click();
      result.submitted = true;
    }
    return result;
  }

  return { run, settle, sleep, resolvePanel };
})();
