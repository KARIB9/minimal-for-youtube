// Умолчания продублированы там, где настройка читается: enabled и showShorts
// в early.js, enabled и theme в content.js — окно могли ни разу не открыть.
//
// theme: null — "ещё не спрашивали", и в этом состоянии тему не навязываем:
// content.js при первой загрузке YouTube запишет сюда ту, что стоит у него.
const DEFAULTS = { enabled: true, theme: null, showShorts: false };

// Подписи через chrome.i18n, а не в разметке: ключи лежат в _locales,
// для непокрытых языков браузер сам откатится на default_locale.
const TEXT = {
  title: "extName",
  "enabled-label": "popupEnabled",
  note: "popupNote",
  "theme-label": "popupTheme",
  "theme-device-label": "popupThemeDevice",
  "theme-light-label": "popupThemeLight",
  "theme-dark-label": "popupThemeDark",
  "shorts-label": "popupShorts",
  "support-label": "popupSupport",
  "timer-title": "popupTimerTitle",
  "timer-reset": "timerReset",
  "length-label": "timerLength",
};

// Направление письма берём у самого браузера: @@bidi_dir — предопределённое
// сообщение chrome.i18n, оно равно "rtl" для арабской локали и "ltr" для
// остальных. Ставим на <html>, вместе с языком: от dir зависят и логические
// свойства в popup.css, и порядок строк.
document.documentElement.dir = chrome.i18n.getMessage("@@bidi_dir");
document.documentElement.lang = chrome.i18n.getUILanguage();

Object.entries(TEXT).forEach(([id, key]) => {
  const node = document.getElementById(id);

  if (node) {
    node.textContent = chrome.i18n.getMessage(key);
  }
});

// Отдельно от TEXT: у этих кнопок нет подписи, только иконка, поэтому имя
// для скринридера идёт в aria-label, а не в textContent — тот стёр бы SVG.
const ARIA_TEXT = {
  "length-minus": "timerLengthMinus",
  "length-plus": "timerLengthPlus",
};

Object.entries(ARIA_TEXT).forEach(([id, key]) => {
  const node = document.getElementById(id);

  if (node) {
    node.setAttribute("aria-label", chrome.i18n.getMessage(key));
  }
});

// Ссылки на донат открываем через chrome.tabs, а не через target="_blank":
// так вкладку создаём сами и сразу закрываем окно, иначе оно висит поверх
// открытой страницы. Закрываем в колбэке — закрытие уничтожает контекст окна,
// и неподтверждённая команда могла бы не дойти.
//
// Разрешений не требует: "tabs" гейтит чтение url и заголовка, а не создание
// вкладки. Если API недоступен, сработает обычный переход по href — ради
// этого target и rel оставлены в разметке.
document.querySelectorAll(".support-links a").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (!chrome.tabs?.create) {
      return;
    }

    event.preventDefault();
    chrome.tabs.create({ url: link.href }, () => window.close());
  });
});

const enabledInput = document.getElementById("enabled");

// Список, а не пара переменных: выбранную кнопку ищем и отмечаем одинаково,
// сколько бы их ни стало (например, если добавится "как на устройстве").
const themeInputs = [...document.querySelectorAll(".seg-input")];
const shortsInput = document.getElementById("shorts");

// Пока content.js не записал тему (расширение ни разу не отработало на
// странице YouTube), выбранной показываем ту, что у самого окна: оно следует
// за системной, и кнопка совпадёт с тем, что человек видит перед собой.
// Ничего при этом не пишем — запись случится только от нажатия.
function preferredTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Окно красится в ту же тему, что и YouTube, — см. popup.css. Атрибут ставим
// на <html>, а не на body: до этой строки действует медиазапрос с системной
// темой, и переключение одним атрибутом меняет весь набор переменных разом.
//
// Для "как на устройстве" атрибут СНИМАЕМ, а не выставляем в вычисленную тему:
// без него окно ведёт тот самый медиазапрос, и оно последует за системой само,
// в том числе если её переключить, пока окно открыто.
function applyWindowTheme(theme) {
  if (theme === "device") {
    delete document.documentElement.dataset.theme;
    return;
  }

  document.documentElement.dataset.theme = theme;
}

function showTheme(theme) {
  themeInputs.forEach((input) => {
    input.checked = input.value === theme;
  });

  applyWindowTheme(theme);
}

chrome.storage.local.get(DEFAULTS, (settings) => {
  enabledInput.checked = settings.enabled;
  shortsInput.checked = settings.showShorts;
  showTheme(settings.theme || preferredTheme());
});

// Небольшая задержка перед закрытием: у тумблера переход 0.15 с, и без паузы
// окно исчезало бы раньше, чем видно, что переключатель сдвинулся, — нажатие
// казалось бы непринятым.
const CLOSE_DELAY_MS = 180;

// Активную вкладку перезагружаем отсюда, а не из контент-скрипта: в уже
// открытые вкладки браузер внедряет его лишь при следующей загрузке, и сразу
// после установки расширения слушать событие там некому.
//
// Разрешений не требует: "tabs" гейтит чтение url и заголовка, а не сами
// методы. Без аргументов перезагружается активная вкладка текущего окна.
function reloadActiveTab() {
  try {
    chrome.tabs?.reload();
  } catch (error) {
    // API недоступен — вкладку перезагрузит контент-скрипт там, где он есть.
  }
}

enabledInput.addEventListener("change", () => {
  // Закрываем в колбэке, а не сразу после вызова: закрытие уничтожает контекст
  // окна, и запись, отправленная но не подтверждённая, могла бы не дойти.
  chrome.storage.local.set({ enabled: enabledInput.checked }, () => {
    reloadActiveTab();
    setTimeout(() => window.close(), CLOSE_DELAY_MS);
  });
});

// Ни перезагрузки вкладки, ни закрытия окна: смену темы подхватывает
// content.js и просит переключиться сам YouTube. Окно оставляем открытым —
// тему обычно щёлкают туда-обратно, сравнивая.
// Слушаем change на каждой кнопке, а не клик по контейнеру: у радиокнопок
// выбор меняется и стрелками с клавиатуры.
themeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) {
      return;
    }

    // Красим окно сразу, не дожидаясь подтверждения записи: storage.onChanged
    // придёт и сам, но с задержкой, и нажатие выглядело бы залипшим.
    applyWindowTheme(input.value);

    chrome.storage.local.set({ theme: input.value });
  });
});

// Ни перезагрузки, ни закрытия окна, в отличие от первого тумблера: правила
// скрытия чисто стилевые, early.js переставляет класс на живой странице,
// и лента перерисовывается сразу.
shortsInput.addEventListener("change", () => {
  chrome.storage.local.set({ showShorts: shortsInput.checked });
});

// ─────────────────────────── ТАЙМЕР ───────────────────────────

// Состояние таймера живёт в chrome.storage, а не в окне: окно уничтожается
// при закрытии, и привязанный к нему отсчёт обнулялся бы вместе с ним.
// Здесь только отрисовка и кнопки.
//
// В хранилище лежит МОМЕНТ окончания (endsAt), а не остаток: остаток пришлось
// бы уменьшать по таймеру, который в закрытом окне не идёт, а от момента он
// считается вычитанием в любую секунду — и после сна компьютера тоже.
// Досчитывает интервал фоновый timer.js, там же продублирован этот объект.
const TIMER_DEFAULTS = {
  minutes: 10,
  endsAt: null,
  leftMs: null,
  // Ставит timer.js в момент срабатывания, гасит окно на странице YouTube
  // после закрытия. Здесь только сбрасывается — само окно рисует content.js.
  finishedAt: null,
};

const MINUTE_MS = 60000;

// Границы те же, что в атрибутах min/max у поля. Дублируются намеренно:
// разметка защищает от стрелочек и подсказывает браузеру, а проверка здесь —
// от ввода руками и от значения, попавшего в хранилище другой версией.
const LENGTH_LIMITS = { min: 1, max: 180 };

const clockNode = document.getElementById("timer-clock");
const toggleButton = document.getElementById("timer-toggle");
const resetButton = document.getElementById("timer-reset");
const lengthInput = document.getElementById("length-min");
const lengthMinus = document.getElementById("length-minus");
const lengthPlus = document.getElementById("length-plus");

let timer = TIMER_DEFAULTS;

function clampLength(value) {
  const number = Math.round(Number(value));

  if (!Number.isFinite(number)) {
    return TIMER_DEFAULTS.minutes;
  }

  return Math.min(LENGTH_LIMITS.max, Math.max(LENGTH_LIMITS.min, number));
}

// get с объектом-умолчанием отдаёт сохранённое значение ЦЕЛИКОМ, без слияния
// по полям. Поэтому запись, сделанную прошлой версией, дополняем сами — иначе
// недостающее поле пришло бы как undefined и посчиталось в NaN.
function normalizeTimer(stored) {
  const merged = Object.assign({}, TIMER_DEFAULTS, stored);

  merged.minutes = clampLength(merged.minutes);

  return merged;
}

function isRunning() {
  return Boolean(timer.endsAt);
}

function remainingMs() {
  if (timer.endsAt) {
    return Math.max(0, timer.endsAt - Date.now());
  }

  if (timer.leftMs !== null) {
    return timer.leftMs;
  }

  return timer.minutes * MINUTE_MS;
}

// Округление вверх, а не вниз: иначе первая же секунда показывалась бы как
// 24:59 при выставленных 25 минутах, а последняя — как 00:00 целую секунду.
function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");

  return minutes + ":" + seconds;
}

function render() {
  clockNode.textContent = formatClock(remainingMs());

  toggleButton.textContent = chrome.i18n.getMessage(
    isRunning() ? "timerPause" : "timerStart",
  );

  // Поле, в котором сейчас печатают, не трогаем: перерисовка вернула бы туда
  // сохранённое значение прямо под пальцами.
  if (document.activeElement !== lengthInput) {
    lengthInput.value = timer.minutes;
  }

  // Кнопка гаснет у границы диапазона, а не остаётся нажимаемой вхолостую.
  lengthMinus.disabled = timer.minutes <= LENGTH_LIMITS.min;
  lengthPlus.disabled = timer.minutes >= LENGTH_LIMITS.max;
}

function save(changes) {
  timer = Object.assign({}, timer, changes);

  // Рисуем сразу, не дожидаясь подтверждения записи: storage.onChanged придёт
  // и сам, но с задержкой, и нажатие выглядело бы залипшим.
  render();

  chrome.storage.local.set({ timer });
}

// finishedAt снимаем при каждом запуске и сбросе: иначе прошлое срабатывание
// таскалось бы в состоянии дальше. Само окно на странице оно бы уже не
// открыло — там сравнивается СМЕНА значения, а не его наличие, — но держать
// в хранилище отработавший сигнал незачем.
toggleButton.addEventListener("click", () => {
  if (isRunning()) {
    save({ endsAt: null, leftMs: remainingMs() });
    return;
  }

  save({ endsAt: Date.now() + remainingMs(), leftMs: null, finishedAt: null });
});

// Сброс не только останавливает, но и снимает остаток от паузы: иначе кнопка
// повторяла бы "Паузу" и вернуться к полной длительности было бы нечем.
resetButton.addEventListener("click", () => {
  save({ endsAt: null, leftMs: null, finishedAt: null });
});

// change, а не input: на input значение правилось бы на каждой набранной
// цифре, и "30" по пути превращалось бы в "3".
lengthInput.addEventListener("change", () => {
  // Пустую строку возвращаем как есть, не пропуская через clampLength:
  // <input type="number"> отдаёт "" и когда поле очистили, и когда ввели
  // нечисловое, а Number("") это 0 — обе ситуации сползали бы к минимуму.
  // Присваиваем полю напрямую: change приходит и по Enter, когда фокус ещё
  // внутри, а render() поля под фокусом не трогает.
  if (lengthInput.value.trim() === "") {
    lengthInput.value = timer.minutes;
    return;
  }

  // Идущий отсчёт не пересчитываем: endsAt уже назначен, и сдвиг конца под
  // пальцами выглядел бы как сбой. Новое значение вступит в силу после
  // сброса или следующего запуска.
  save({ minutes: clampLength(lengthInput.value) });
});

// Тот же путь, что и у поля: кнопка коммитит значение сразу, минуя набор
// цифр, поэтому идёт через save(), а не трогает lengthInput.value напрямую.
function adjustLength(delta) {
  save({ minutes: clampLength(timer.minutes + delta) });
}

lengthMinus.addEventListener("click", () => adjustLength(-1));
lengthPlus.addEventListener("click", () => adjustLength(1));

// Отсчёт идёт по часам, но показания надо обновлять. Шаг мельче секунды:
// при ровно 1000 мс отрисовка и смена секунды расходятся, и цифра иногда
// стоит две доли секунды, а иногда перескакивает через одну.
const TICK_MS = 250;

setInterval(render, TICK_MS);

chrome.storage.local.get({ timer: TIMER_DEFAULTS }, (settings) => {
  timer = normalizeTimer(settings.timer);
  render();
});

// Окно могло остаться открытым, пока настройку меняли в другом окне браузера.
// Через это же событие приходит и смена фазы от timer.js.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }

  if (changes.enabled) {
    enabledInput.checked = changes.enabled.newValue;
  }

  if (changes.theme) {
    showTheme(changes.theme.newValue);
  }

  if (changes.showShorts) {
    shortsInput.checked = changes.showShorts.newValue;
  }

  if (changes.timer) {
    timer = normalizeTimer(changes.timer.newValue);
    render();
  }
});
