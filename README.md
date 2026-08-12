# Meteora QP — Quick Position

Маленькое локальное расширение для Chrome. Открывает DLMM-позицию на
meteora.ag в один клик: сумма в SOL и диапазон в процентах.

Ничего не крутится на сервере. Ни бэкенда, ни базы, ни бота. Расширение не
ходит в сеть вообще и не имеет прав, кроме `storage`.

## Установка

1. Распаковать папку `meteora-qp` куда угодно (например в Документы).
2. Chrome → `chrome://extensions/`
3. Включить **Режим разработчика** (переключатель справа сверху).
4. **Загрузить распакованное расширение** → выбрать папку `meteora-qp`.
5. Открыть любой DLMM-пул: `https://www.meteora.ag/dlmm/<адрес пула>` (или app.meteora.ag — работает на обоих)

Виджет появится в правом нижнем углу.

## Как пользоваться

- **SOL** — сумма позиции в SOL, абсолютная.
- **Min % / Max %** — границы диапазона в процентах от текущей цены.
- **Верхний ряд кнопок** — ширина диапазона: один клик ставит обе границы
  симметрично, `15` → Min −15, Max +15.
- **Нижний ряд кнопок** — готовые суммы в SOL.
- **⚡ YOLO IN** — заполняет поля Meteora и нажимает её кнопку отправки.
  Подтверждение транзакции остаётся в твоём кошельке.
- **▾** — меню: пресеты и настройки, свернуть панель, вернуть в угол.
- **Перетаскивание** — потяни за заголовок, панель встанет куда нужно. Место
  запоминается и переживает перезагрузку страницы. За край экрана утащить
  нельзя, при изменении размера окна панель сама возвращается в границы.
  «Вернуть в угол» в меню ставит её обратно в правый нижний угол.

QP открывает **новую** позицию. Если на экране висит окно уже открытой позиции
(вкладки `Add / Rebalance / Withdraw`), виджет откажется работать и попросит
закрыть его крестиком: две панели выглядят одинаково, и заполнить не ту —
значит отправить деньги не туда, куда просили.

Enter в любом поле тоже запускает YOLO IN.

## Что происходит по нажатию

Порядок не случайный, он измерен на живой странице:

1. `Auto-Fill` выключается — иначе Meteora подставит второй токен;
2. выставляется стратегия (по умолчанию `Spot`);
3. вписывается сумма SOL;
4. вписывается `Max %`, затем `Min %`;
5. читаются фактические значения и показываются в статусе;
6. нажимается родная кнопка отправки.

Сумма идёт **до** границ. Если сделать наоборот, Meteora сама переписывает
диапазон в односторонний (`−42% / 0%`, 70 бинов) и получается не то, что просили.
Это главная деталь всей механики.

## Чего расширение не делает

- не хранит и не запрашивает приватный ключ и seed-фразу;
- не подписывает транзакции;
- не разговаривает с кошельком;
- не ходит в сеть и не собирает статистику.

Всё, что оно умеет, — заполнить поля на странице и нажать кнопку, которую ты
и так нажимаешь руками.

## Если что-то сломалось

Meteora регулярно переписывает интерфейс. Расширение цепляется за смысловые
атрибуты (`data-tour`, `data-sentry-component`, `aria-label`), а не за
вёрстку, но однажды это всё равно перестанет совпадать.

Тогда виджет не будет молчать — он покажет красным, какое поле не нашёл.
Правится один файл: `src/dom.js`, там весь слой якорей.

Весь слой якорей собран в одном месте намеренно: `src/dom.js` знает, как
устроена страница Meteora, а `src/actions.js` — в каком порядке её заполнять.
Остальные файлы про интерфейс самого виджета.

## Проверено

Расширение загружено в Chromium и прогнано на живом пуле TOAD-SOL:

```
статус: Spot… → SOL 2.5 set, waiting… → Max set, waiting… → Min set, waiting…
        ✅ Готово: -15.41% … +14.51% · 39 бинов · Spot

поля Meteora: min=-15.41%  max=14.51%  бинов=39
              TOAD=(пусто)  SOL=2.5  Auto-Fill=выкл  стратегия=Spot
```

Кошелька в тестовом браузере нет, поэтому кнопка отправки была заблокирована
(`Wallet Not Connected`) и расширение это честно сообщило. Всё до неё —
проверено по-настоящему, а не на словах.


---

# Meteora QP — Quick Position (English)

A tiny Chrome extension that opens a DLMM liquidity position on Meteora in one
click.

Opening a position by hand means: turn off Auto-Fill, pick a strategy, type the
amount, set Min and Max, hit submit. Five steps, usually while a coin is moving
and seconds matter. QP does all of it with one button.

## The panel

Docked bottom-right on a pool page:

- **SOL** — position size, absolute
- **Min % / Max %** — range bounds as a percentage of the current price
- **Top preset row** — range width: clicking `15` sets `-15` and `+15` at once
- **Bottom preset row** — ready-made SOL amounts
- **⚡ Yolo In** — fills Meteora's own fields and presses its submit button
- **Drag by the header** to move the panel anywhere; the spot is remembered and
  survives a reload, and it cannot be dragged off-screen

Both preset rows are editable. Strategy defaults to `Spot` and can be switched
to `Curve` or `Bid Ask`. Auto-submit can be turned off, leaving QP to fill the
fields only.

## The one detail that makes it work

**Order of filling.** While a single amount is entered and Auto-Fill is off,
Meteora rewrites the range into a one-sided shape by itself — Max drifts to
`0%`, Min to `-42%`, 70 bins. So the amount goes in **before** the bounds:

```
Auto-Fill off  ->  SOL amount  ->  Max %  ->  Min %
```

In that order a symmetric ±15% range sticks, and the entry stays pure SOL — the
other token is not required. In the reverse order you get something you did not
ask for, and you will not notice immediately.

This was measured against the live page across four orderings, not assumed.

Percentages snap to bins: type `-15` and you get `-15.41%`. The widget reports
what actually landed, never what you typed.

## Safety

- never stores or asks for a private key or seed phrase
- never signs transactions
- never talks to the wallet at all
- no network access, no telemetry, no server
- only permission is `storage`, only host is `meteora.ag`

All it does is fill fields on the page and press a button you would press
yourself. Transaction approval stays in your own wallet, as usual.

If a window of an existing position is open (`Add / Rebalance / Withdraw`),
QP refuses to run and asks you to close it. That panel has identical fields,
and filling the wrong one means sending money somewhere you did not intend.

## Install

1. Download and unpack the folder
2. `chrome://extensions/`
3. Enable **Developer mode**
4. **Load unpacked** → select the folder
5. Open any pool at `meteora.ag/dlmm/…`

## When it breaks

Meteora rewrites its UI regularly. The extension anchors on semantic attributes
(`data-tour`, `data-sentry-component`, `aria-label`) rather than on layout, but
one day that will stop matching. The widget will not fail silently — it shows
in red which control it could not find. One file to fix: `src/dom.js`.

## Credit

The idea is the `Meteora QP` panel by [@0xVanChu](https://x.com/0xVanChu), which
is a Tampermonkey userscript. This is the same thing as a plain extension, with
no Tampermonkey needed.

MIT licensed. Six files, no build step, no dependencies.
