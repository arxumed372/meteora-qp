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
  async function settle({ quiet = 450, timeout = 6000 } = {}) {
    const t0 = Date.now();
    let prev = JSON.stringify(D.snapshot());
    let stableSince = Date.now();
    while (Date.now() - t0 < timeout) {
      await sleep(150);
      const now = JSON.stringify(D.snapshot());
      if (now !== prev) { prev = now; stableSince = Date.now(); continue; }
      if (Date.now() - stableSince >= quiet) return true;
    }
    return false;
  }

  const num = (s) => {
    const m = String(s == null ? '' : s).replace(',', '.').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  };

  // Один шаг: записать значение и дождаться пересчёта.
  async function writePct(which, value, report) {
    const el = D.pctInput(which);
    if (!el) throw new Error(`не нашёл поле ${which} %`);
    D.setReactValue(el, value);
    D.pressEnter(el);
    report(`${which} set, waiting…`);
    await settle();
    return num(D.pctInput(which) && D.pctInput(which).value);
  }

  async function run(cfg, report) {
    const quote = cfg.quoteSymbol || 'SOL';

    if (!D.panelRoot()) throw new Error('панель Meteora не найдена на странице');
    if (D.panelCount() > 1) report('на экране больше одной панели — работаю с верхней');

    // 1. Auto-Fill выключаем: иначе Meteora подставит второй токен.
    const on = D.autoFillOn();
    if (on === true) {
      report('Auto-Fill off…');
      D.autoFillToggle().click();
      await settle({ quiet: 350, timeout: 4000 });
    } else if (on === null) {
      report('не читаю Auto-Fill — проверю результат в конце');
    }

    // 2. Стратегия. Пустая строка в настройках означает «не трогать».
    if (cfg.strategy) {
      const btn = D.strategyButton(cfg.strategy);
      if (!btn) throw new Error(`не нашёл стратегию ${cfg.strategy}`);
      btn.click();
      report(`${cfg.strategy}…`);
      await settle({ quiet: 350, timeout: 4000 });
    }

    // 3. Сумма — до границ. Это и есть весь фокус.
    const amount = D.amountInput(quote);
    if (!amount) throw new Error(`не нашёл поле суммы ${quote} в этой паре`);
    if (amount.disabled) throw new Error(`поле ${quote} заблокировано — диапазон не пускает эту сторону`);
    D.setReactValue(amount, cfg.sol);
    report(`${quote} ${cfg.sol} set, waiting…`);
    await settle();

    // 4. Границы: сначала Max, потом Min — как у оригинала.
    const gotMax = await writePct('Max', cfg.maxPct, report);
    const gotMin = await writePct('Min', cfg.minPct, report);

    // 5. Проверяем, что получилось на самом деле. Проценты защёлкиваются на
    // бины, поэтому введённое и фактическое почти никогда не совпадают.
    const base = D.amountInput(quote);
    const other = D.pairSymbols().find(s => s.toUpperCase() !== quote.toUpperCase());
    const otherEl = other ? D.amountInput(other) : null;
    const otherVal = otherEl ? num(otherEl.value) : null;

    const result = {
      min: gotMin, max: gotMax,
      bins: D.totalBins(),
      amount: num(base && base.value),
      strategy: D.activeStrategy(),
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
    if (cfg.autoSubmit) {
      const btn = D.submitButton();
      if (!btn) throw new Error('не нашёл кнопку отправки');
      const label = btn.innerText.trim();
      if (btn.disabled) {
        report(`«${label}» недоступна — поля заполнены, жму сам`);
        result.submitted = false;
        result.submitLabel = label;
        return result;
      }
      report(`жму «${label}»…`);
      btn.click();
      result.submitted = true;
      result.submitLabel = label;
    } else {
      result.submitted = false;
      const btn = D.submitButton();
      result.submitLabel = btn ? btn.innerText.trim() : null;
    }
    return result;
  }

  return { run, settle, sleep };
})();
