// Весь файл обёрнут в функцию: early.js выполняется в том же изолированном
// мире, и совпадение имени на верхнем уровне уронило бы оба скрипта.
(() => {
  // Разбираем разметку значка парсером, а не через innerHTML: линтер AMO
  // помечает любое присваивание innerHTML, даже когда значение своё
  // и постоянное. Парсер вдобавок не выполняет скрипты при разборе,
  // так что претензия снимается по существу, а не обходится.
  function svgNode(markup) {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");

    return document.importNode(doc.documentElement, true);
  }

  const LABELS = {
    en: { scrollDown: "Scroll down" },
    ru: { scrollDown: "Прокрутить вниз" },
  };

  const T =
    LABELS[(document.documentElement.lang || "").slice(0, 2).toLowerCase()] ||
    LABELS.en;

  // Удаления #home-page-skeleton здесь нет намеренно: с главной мы уходим
  // ещё на document_start через location.replace, и до этого узла дело
  // не доходит — на остальных страницах его не существует (проверено).

  // На случай перехода на главную уже внутри SPA (клик по логотипу).
  // Первичную загрузку "/" перехватывает early.js на document_start.
  function redirectHomeToSubscriptions() {
    if (location.pathname === "/") {
      location.replace("/feed/subscriptions");
    }
  }

  function updatePageClass() {
    document.documentElement.classList.toggle(
      "subscriptions-page",
      location.pathname === "/feed/subscriptions",
    );

    // Держит видимость перенесённой кнопки меню аккаунта — см. early.js
    // и styles.css.
    document.documentElement.classList.toggle(
      "you-page",
      location.pathname === "/feed/you",
    );
  }

  // На подписках шапка занимает 100vh и стоит в потоке, поэтому до ленты нужно
  // прокрутить экран. На остальных страницах она снова фиксированная, страница
  // резко укорачивается сверху, и сохранённое смещение указывает в её середину —
  // видео открывалось снизу. Сбрасываем только при смене режима раскладки,
  // обычных переходов и возврата назад это не касается.
  let wasSubscriptions = location.pathname === "/feed/subscriptions";

  function resetScrollOnLayoutSwitch() {
    const isSubscriptions = location.pathname === "/feed/subscriptions";

    if (isSubscriptions !== wasSubscriptions) {
      window.scrollTo(0, 0);
    }

    wasSubscriptions = isSubscriptions;
  }

  // Всё, от чего зависит РАСКЛАДКА, собрано здесь: это должно случиться до
  // первой отрисовки новой страницы.
  //
  // yt-navigate-finish для этого поздно. Замер перехода лента → видео: адрес
  // меняется и приходит yt-page-type-changed на 8518 мс, плеер отрисован на
  // 8550, а yt-navigate-finish — только на 9176. Все эти ~630 мс страница
  // живёт с классом подписок, то есть с шапкой на весь экран, и плеер потом
  // прыгает вверх на 894px (замер при окне 900).
  //
  // yt-page-type-changed подходит тем, что приходит с УЖЕ обновлённым
  // location, и в обе стороны — вперёд и назад.
  function switchLayout() {
    redirectHomeToSubscriptions();
    updatePageClass();
    resetScrollOnLayoutSwitch();
  }

  // После отправки запроса фокус остаётся в поле, и YouTube держит под ним
  // открытым список подсказок — на новой странице он так и висит. На обычном
  // YouTube поле фокус теряет; возвращаем это. Снимаем только если фокус
  // действительно там: щёлкнув в другое место, пользователь ушёл сам.
  function blurSearchAfterNavigation() {
    const input = document.querySelector(".ytSearchboxComponentInput");

    if (input && document.activeElement === input) {
      input.blur();
    }
  }

  // Лишние части шапки прячем через CSS, а не удаляем: удаление ломало
  // ytd-masthead — Polymer при пересборке выдавал второй #center.
  //
  // Логотип и кнопки вставляет early.js, там же повторная вставка при
  // переходах. Здесь не трогаем: два пути вставки давали гонку.

  // Слушатель вешается один раз на весь сеанс и ищет стрелку заново при каждом
  // событии. Раньше он висел внутри вставки — и если YouTube пересоздавал
  // шапку, на каждую повторную вставку добавлялся ещё один слушатель, намертво
  // удерживающий уже отсоединённый узел.
  window.addEventListener(
    "scroll",
    () => {
      document
        .querySelector("#scroll-arrow")
        ?.classList.toggle("scroll-arrow--hidden", window.scrollY > 10);
    },
    { passive: true },
  );

  // Возвращает true, когда стрелка на месте, — сигнал наблюдателю отключиться.
  function insertScrollArrow() {
    if (document.querySelector("#scroll-arrow")) {
      return true;
    }

    const masthead = document.querySelector("#container.ytd-masthead");

    if (!masthead) {
      return false;
    }

    const arrow = document.createElement("button");
    arrow.id = "scroll-arrow";
    arrow.type = "button";
    arrow.setAttribute("aria-label", T.scrollDown);
    arrow.appendChild(
      svgNode(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
      ),
    );

    arrow.addEventListener("click", () => {
      window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
    });

    masthead.appendChild(arrow);

    return true;
  }

  const WATCH_TIMEOUT_MS = 15000;

  // #container.ytd-masthead создаёт Polymer, и на document_end его ещё может не
  // быть. Ждём появления наблюдателем — иначе стрелка не вставится, а раскрытие
  // шапки её ждёт. Тупика это уже не создаёт: у раскрытия в early.js есть
  // собственный потолок, после которого оно происходит в любом случае.
  function watchForMasthead() {
    if (insertScrollArrow()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (insertScrollArrow()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // YouTube мутирует DOM непрерывно — вечно наблюдать накладно.
    setTimeout(() => observer.disconnect(), WATCH_TIMEOUT_MS);
  }

  // Прокрутка в полноэкранном режиме держится не на скрытой нами панели, а на
  // состояниях самого плеера: правило YouTube
  // ".ytp-fullscreen-grid-active .ytp-fullscreen-grid-main-content{overflow:scroll}"
  // и десятки других завязаны на эти классы. CSS их снять не может — только JS.
  const PLAYER_GRID_CLASSES = [
    "ytp-fullscreen-grid-active",
    "ytp-fullscreen-grid-peeking",
    "ytp-grid-scrollable",
    "ytp-grid-scrolling",
  ];

  function stripGridClasses(player) {
    const present = PLAYER_GRID_CLASSES.filter((name) =>
      player.classList.contains(name),
    );

    // Проверяем перед снятием: без этого каждая наша правка порождала бы новую
    // запись мутации и наблюдатель крутился бы вхолостую.
    if (present.length) {
      player.classList.remove(...present);
    }
  }

  let gridObserver = null;

  // Возвращает true, когда плеер найден и наблюдение налажено.
  function watchPlayerGrid() {
    const player = document.querySelector("#movie_player");

    if (!player) {
      return false;
    }

    gridObserver?.disconnect();
    stripGridClasses(player);

    gridObserver = new MutationObserver(() => stripGridClasses(player));
    gridObserver.observe(player, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return true;
  }

  function watchForPlayer() {
    if (watchPlayerGrid()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (watchPlayerGrid()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => observer.disconnect(), WATCH_TIMEOUT_MS);
  }

  // ─────────────────────── САМОПРОВЕРКА ───────────────────────
  // Явный список узлов YouTube, на которые опирается расширение. Он же
  // контракт: при переименовании узла правило перестаёт работать МОЛЧА, а
  // проверка превращает это в строчку в консоли. Здесь только то, чего не
  // должно быть без изменений в разметке.
  const ANCHORS = {
    always: [
      "ytd-app",
      "ytd-masthead",
      "#container.ytd-masthead",
      "#container.ytd-masthead > #start",
      "#container.ytd-masthead > #end",
      "#center.ytd-masthead",
      "#page-manager.ytd-app",
      "ytd-masthead #guide-button",
      "ytd-topbar-logo-renderer",
      "tp-yt-app-drawer#guide",
      ".ytSearchboxComponentInput",
      ".ytSearchboxComponentSearchButton",
    ],
    watch: [
      "ytd-watch-flexy",
      "#primary.ytd-watch-flexy",
      "#secondary.ytd-watch-flexy",
      "#player-container-outer.ytd-watch-flexy",
      "#movie_player",
      ".ytp-size-button",
      ".ytp-pip-button",
      ".ytp-right-controls-right",
    ],
    subscriptions: ["ytd-browse", "#center ytd-topbar-logo-renderer", "#yt-you-link"],
  };

  // Об одном и том же сообщаем один раз за сеанс, иначе консоль зальёт
  // повторами при каждом переходе.
  const reported = new Set();

  function auditAnchors() {
    const list = [...ANCHORS.always];

    if (location.pathname.startsWith("/watch")) {
      list.push(...ANCHORS.watch);
    }

    if (location.pathname === "/feed/subscriptions") {
      list.push(...ANCHORS.subscriptions);
    }

    const missing = list.filter(
      (selector) => !reported.has(selector) && !document.querySelector(selector),
    );

    if (!missing.length) {
      return;
    }

    missing.forEach((selector) => reported.add(selector));

    console.warn(
      "[Minimal for YouTube] YouTube markup has changed: the nodes below were\n" +
        "not found, so the extension rules that rely on them have no effect.\n" +
        missing.map((selector) => "  " + selector).join("\n"),
    );
  }

  // Задержка согласована с потолком раскрытия шапки в early.js (15 с): в список
  // входят перенесённый логотип и наш #yt-you-link, а их вставка в худшем случае
  // тянется до этого потолка. Проверять раньше — значит получать ложную
  // тревогу на медленной загрузке.
  const AUDIT_DELAY_MS = 15000;

  let auditTimer = null;

  function scheduleAudit() {
    clearTimeout(auditTimer);
    auditTimer = setTimeout(auditAnchors, AUDIT_DELAY_MS);
  }

  function start() {
    document.addEventListener("yt-page-type-changed", switchLayout);

    // Застрявший subscriptions-page случался редко и живьём не воспроизвёлся:
    // поиск, клик по подсказке и кнопка "назад" отработали исправно. Но
    // механизм подобрался точно — с приклеенным классом шапка на любой
    // странице занимает 100vh, и содержимое уезжает на экран ниже.
    //
    // Два пути ниже не проверялись ни разу — просто потому, что до сих пор
    // не слушались:
    //
    //  - popstate: событие браузера, а не YouTube. В проверенных переходах
    //    "назад" yt-page-type-changed успевал раньше, но это не гарантия;
    //  - pageshow с persisted: страница вернулась из bfcache, вместе с
    //    классами на <html> с момента ухода. Своих событий YouTube тут
    //    не пришлёт вовсе.
    //
    // switchLayout() идемпотентна, поэтому лишнее срабатывание безвредно.
    window.addEventListener("popstate", switchLayout);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        switchLayout();
      }
    });

    document.addEventListener("yt-navigate-finish", () => {
      // Повтор: событие выше привязано к смене ТИПА страницы, а переход между
      // двумя лентами одного типа его может не вызвать. Обходится бесплатно —
      // все три функции идемпотентны.
      switchLayout();

      blurSearchAfterNavigation();

      // Повтор на следующем кадре: список подсказок YouTube может открыть уже
      // после того, как объявит переход завершённым.
      requestAnimationFrame(blurSearchAfterNavigation);

      insertScrollArrow();

      // Плеер переживает переходы внутри SPA не всегда — перецепляемся
      // на всякий.
      watchForPlayer();

      // У каждого типа страницы свой набор узлов, поэтому проверяем и после
      // переходов, а не только на первой загрузке.
      scheduleAudit();
    });

    redirectHomeToSubscriptions();
    updatePageClass();
    watchForMasthead();
    watchForPlayer();
    scheduleAudit();
  }

  // ─────────────────── ОКНО ОБ ОКОНЧАНИИ ТАЙМЕРА ───────────────────

  // <dialog> с showModal(), а не свой div с z-index. Причина решающая:
  // showModal() кладёт окно в TOP LAYER — туда же, где полноэкранный элемент,
  // и открытое позже окно оказывается выше развёрнутого плеера. Любой div
  // в полноэкранном режиме не виден вовсе.
  //
  // Заодно достаются бесплатно: закрытие по Escape, удержание фокуса
  // и затемнение через ::backdrop.
  let timerDialog = null;

  // Гасим сигнал в хранилище, а не только окно: событие придёт во все вкладки,
  // и окно закроется разом везде. Флаг нужен потому, что путей закрытия три
  // (кнопка, Escape, событие close) и сработать могут несколько сразу.
  let timerDismissed = true;

  function dismissTimerDialog() {
    if (timerDismissed) {
      return;
    }

    timerDismissed = true;

    chrome.storage.local.get({ timer: {} }, (settings) => {
      chrome.storage.local.set({
        timer: Object.assign({}, settings.timer, { finishedAt: null }),
      });
    });
  }

  function buildTimerDialog() {
    const dialog = document.createElement("dialog");
    dialog.id = "yt-timer-dialog";

    const text = document.createElement("p");
    text.id = "yt-timer-text";
    text.textContent = chrome.i18n.getMessage("timerDone");

    const button = document.createElement("button");
    button.id = "yt-timer-close";
    button.type = "button";
    button.textContent = chrome.i18n.getMessage("timerClose");

    // Оба пути закрытия гасят сигнал сами. Слушателя close здесь намеренно нет:
    // кнопка и Escape — единственные способы закрыть окно, и оба покрыты, а
    // событие приходит отложенно и гасит сигнал уже НОВОГО окна, если закрыть
    // и сразу открыть снова (поймано на стенде). Вдобавок нашёлся движок, где
    // close и cancel не доставляются вовсе.
    button.addEventListener("click", () => {
      dialog.close();
      dismissTimerDialog();
    });

    // Escape закрывает окно сам, средствами браузера, — нам остаётся только
    // погасить сигнал.
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        dismissTimerDialog();
      }
    });

    dialog.append(text, button);
    document.body.appendChild(dialog);

    return dialog;
  }

  function showTimerDialog() {
    if (!timerDialog) {
      timerDialog = buildTimerDialog();
    }

    // Повторный showModal() на уже открытом окне бросает InvalidStateError.
    if (timerDialog.open) {
      return;
    }

    timerDismissed = false;
    timerDialog.showModal();
  }

  // Реагируем только на СМЕНУ finishedAt и только на непустое значение.
  // Состояние при загрузке не читаем: вкладку могли открыть через час после
  // срабатывания, и окно всплыло бы посреди чужого дела. Пропущенный сигнал
  // в закрытой вкладке страхует уведомление от timer.js.
  //
  // Слушатель ставится ВНЕ проверки настройки: таймер работает независимо
  // от того, перекроен ли YouTube.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.timer) {
      return;
    }

    const now = changes.timer.newValue || {};
    const before = changes.timer.oldValue || {};

    if (now.finishedAt && now.finishedAt !== before.finishedAt) {
      showTimerDialog();
      return;
    }

    // Сигнал погасили — закрываем окно и здесь, иначе закрытие работало бы
    // только в той вкладке, где нажали кнопку. Флаг ставим ДО close(): сигнал
    // уже погасил тот, кто закрыл окно первым.
    if (!now.finishedAt && timerDialog && timerDialog.open) {
      timerDismissed = true;
      timerDialog.close();
    }
  });

  // ─────────────────────────── ТЕМА ───────────────────────────

  // Первая попытка переставляла атрибут dark на <html> и оказалась неверной:
  // он отвечает только за корневые токены (--yt-sys-color-*). По ним
  // перекрашивались наши стрелка и кнопки, а сам YouTube оставался прежним —
  // его новые компоненты покрашены КЛАССОМ, который ставится при отрисовке
  // (замер: .ytSearchboxComponentInputBoxDark с жёстким rgb(18, 18, 18)).
  //
  // Поэтому просим переключиться сам YouTube — тем же действием, что стоит
  // за пунктом "Тема" в меню аккаунта. Он переставит и классы, и атрибут,
  // и запомнит выбор: меняется поле f6 в cookie PREF (замер: 40000400 у
  // тёмной, 40080000 у светлой, 40000000 у "как на устройстве").
  //
  // Цена осознанная: меняется НАСТРОЙКА YouTube, а не только вид открытой
  // страницы. Альтернатива — сотни своих правил, ломающихся при каждом
  // обновлении их вёрстки.
  //
  // Живёт здесь, а не в early.js: действию нужен узел ytd-app.
  function currentTheme() {
    return document.documentElement.hasAttribute("dark") ? "dark" : "light";
  }

  const THEME_ACTIONS = {
    dark: "yt-signal-action-toggle-dark-theme-on",
    light: "yt-signal-action-toggle-dark-theme-off",
    device: "yt-signal-action-toggle-dark-theme-device",
  };

  function requestTheme(theme) {
    const app = document.querySelector("ytd-app");

    if (!app) {
      return;
    }

    const detail = {
      actionName: THEME_ACTIONS[theme],
      optionalAction: false,
      args: [],
      returnValue: [],
    };

    // cloneInto обязателен в Firefox: объект, созданный в изолированном мире
    // расширения, страница иначе получит пустым. В Chromium этой функции нет,
    // и там detail клонирует сам браузер.
    app.dispatchEvent(
      new CustomEvent("yt-action", {
        detail:
          typeof cloneInto === "function" ? cloneInto(detail, window) : detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Ключ в sessionStorage, а не переменная: действие заставляет YouTube
  // перерисовать страницу, и переменная обнулилась бы вместе с контекстом.
  //
  // Защита от петли: если выбор не сохранится, второй попытки в этой вкладке
  // не делаем. Нажатие в окне расширения проходит всегда — человек попросил.
  const THEME_ATTEMPT_KEY = "yt-ext-theme-attempt";

  function alreadyTried(theme) {
    try {
      if (sessionStorage.getItem(THEME_ATTEMPT_KEY) === theme) {
        return true;
      }

      sessionStorage.setItem(THEME_ATTEMPT_KEY, theme);
    } catch (error) {
      // Приватный режим или запрет на хранилище — обойдёмся без защиты.
    }

    return false;
  }

  // "Как на устройстве" — НАСТРОЙКА, а не вид: на экране она выглядит обычной
  // тёмной или светлой, смотря что в системе. Поэтому сравниваем не с самой
  // настройкой, а с тем, как страница при ней должна выглядеть.
  //
  // Отличить у YouTube явную тёмную от следования тёмной системе нельзя — вид
  // один, и при совпадении вида мы ничего не делаем. Само исправится: сменится
  // система — виды разойдутся, и следующая загрузка отправит действие.
  function wantedTheme(theme) {
    if (theme !== "device") {
      return theme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme, onLoad) {
    // Ещё не спрашивали: запоминаем ту тему, что стоит у YouTube, и ничего
    // не переключаем — иначе первый же заход навязал бы своё, а кнопки в окне
    // показывали бы не то, что на экране. Записываем именно вид (dark/light):
    // следование системе по странице не опознать, см. выше.
    if (!THEME_ACTIONS[theme]) {
      chrome.storage.local.set({ theme: currentTheme() });
      return;
    }

    if (currentTheme() === wantedTheme(theme)) {
      return;
    }

    if (onLoad && alreadyTried(theme)) {
      return;
    }

    requestTheme(theme);
  }

  // Тему читаем по готовности страницы, а не сразу: в режиме "как на
  // устройстве" атрибут dark ставит скрипт YouTube, и на document_end его может
  // ещё не быть — вышло бы ложное расхождение и лишнее переключение. Задержка
  // не накапливается: после первого применения выбор лежит в PREF.
  function whenSettled(task) {
    if (document.readyState === "complete") {
      task();
      return;
    }

    window.addEventListener("load", task, { once: true });
  }

  // Настройку читаем сами, а не смотрим на класс от early.js: тот ставится
  // асинхронно, и к моменту document_end мог ещё не появиться. Значение
  // по умолчанию совпадает с early.js и окном настроек.
  chrome.storage.local.get({ enabled: true, theme: null }, (settings) => {
    if (!settings.enabled) {
      return;
    }

    start();

    whenSettled(() => applyTheme(settings.theme, true));

    // Слушатель ставим внутри ветки включённого расширения: выключенное
    // страницу не трогает, темой в том числе.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.theme) {
        applyTheme(changes.theme.newValue, false);
      }
    });
  });
})();
