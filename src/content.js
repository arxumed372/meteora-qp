// Точка входа. Meteora — SPA: переход по внутренней ссылке уничтожает панель
// создания позиции, возврат назад её пересоздаёт. Проверено на живой странице,
// поэтому одного запуска при загрузке недостаточно — нужен наблюдатель.
(async () => {
  await window.QPSettings.load();

  const sync = () => {
    const ready = window.QPDom.isDlmmPage();
    if (ready && !window.QPPanel.isMounted()) window.QPPanel.mount();
    else if (!ready && window.QPPanel.isMounted()) window.QPPanel.unmount();
  };

  // DOM-мутации: панель Meteora появляется и исчезает без смены URL.
  let pending = null;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => { pending = null; sync(); }, 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Смена маршрута: pushState/replaceState событий не порождают, поэтому
  // сравниваем путь сами, а popstate ловим отдельно.
  let path = location.pathname;
  setInterval(() => {
    if (location.pathname !== path) { path = location.pathname; sync(); }
  }, 600);
  window.addEventListener('popstate', sync);

  sync();
})();
