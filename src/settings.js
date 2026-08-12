// Настройки. chrome.storage.local, ничего больше — ни сети, ни синхронизации.
window.QPSettings = (() => {
  const KEY = 'meteora-qp';

  // Значения по умолчанию взяты с панели 0xVanChu: верхний ряд — ширина
  // диапазона в процентах, нижний — размер позиции в SOL. Нижний ряд под его
  // кошелёк, поэтому оба ряда редактируются.
  const DEFAULTS = {
    sol: 1,
    minPct: -15,
    maxPct: 15,
    rangePresets: [5, 10, 15, 20, 25],
    solPresets: [10, 15, 20, 25, 30],
    strategy: 'Spot',      // Spot | Curve | Bid Ask | '' — пусто значит не трогать
    autoSubmit: true,      // дожимать родную кнопку отправки
    collapsed: false,
    pos: null,             // {left, top} в px, если панель перетащили; null — угол
  };

  let cache = { ...DEFAULTS };

  async function load() {
    try {
      const got = await chrome.storage.local.get(KEY);
      cache = { ...DEFAULTS, ...(got && got[KEY]) };
    } catch (e) {
      cache = { ...DEFAULTS };      // расширение перезагружено — работаем на дефолтах
    }
    return cache;
  }

  async function save(patch) {
    cache = { ...cache, ...patch };
    try {
      await chrome.storage.local.set({ [KEY]: cache });
    } catch (e) { /* storage недоступен — настройки живут до перезагрузки */ }
    return cache;
  }

  const get = () => cache;

  // "5, 10,15 ; 20" -> [5, 10, 15, 20]. Пустой или мусорный ввод не должен
  // затирать рабочие пресеты, поэтому пустой результат отбрасывается вызывающим.
  const parseList = (s) => String(s)
    .split(/[^0-9.]+/)
    .map(x => parseFloat(x))
    .filter(x => Number.isFinite(x) && x > 0)
    .slice(0, 8);

  return { load, save, get, parseList, DEFAULTS };
})();
