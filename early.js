// Весь файл обёрнут в функцию: content.js выполняется в том же изолированном
// мире, и совпадение имени на верхнем уровне уронило бы оба скрипта.
(() => {
  const root = document.documentElement;
  const path = location.pathname;

  // Подписи берём по языку интерфейса. Полноценная локализация через _locales
  // здесь избыточна — строк всего две.
  const LABELS = {
    en: { you: "You", subscriptions: "Subscriptions" },
    ru: { you: "Вы", subscriptions: "Подписки" },
  };

  const T = LABELS[(root.lang || "").slice(0, 2).toLowerCase()] || LABELS.en;

  // Шапка скрыта стилями, пока YouTube не навесит на неё класс masthead-finish
  // (см. styles.css). Здесь — подстраховка: если маркер почему-то не придёт,
  // шапка не должна остаться невидимой навсегда. Работает на всех страницах,
  // поэтому стоит до всех проверок пути.
  setTimeout(() => root.classList.add("yt-masthead-ready"), 3000);

  // Содержимое страницы показываем, когда она собрана. Раньше ждали только
  // load — а он наступает после ВСЕХ ресурсов, включая картинки и рекламу,
  // и на медленной сети экран оставался пустым надолго. Берём самое раннее
  // из трёх событий.
  function revealContent() {
    root.classList.add("yt-content-ready");
  }

  if (document.readyState === "complete") {
    revealContent();
  } else {
    window.addEventListener("load", revealContent, { once: true });
    document.addEventListener("yt-navigate-finish", revealContent, {
      once: true,
    });
    setTimeout(revealContent, 3000);
  }

  // Инлайновые размеры из оригинальной разметки YouTube убраны: размер задаётся
  // в styles.css, иначе width/height по 100% конфликтуют с размером кнопки.
  const YOU_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M12 1C5.925 1 1 5.925 1 12a10.98 10.98 0 004.68 9c1.788 1.258 3.967 2 6.32 2s4.532-.742 6.32-2c.227-.159.447-.325.66-.499v.001A10.98 10.98 0 0023 12c0-6.075-4.925-11-11-11Zm0 4a3.5 3.5 0 110 7 3.5 3.5 0 010-7Zm0 9a7 7 0 016.446 4.276A8.97 8.97 0 0112 21a8.97 8.97 0 01-6.447-2.724 7 7 0 013.768-3.743A6.998 6.998 0 0112 14Z"></path></svg>';

  const HOME_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="m11.485 2.143-8 4.8-2 1.2a1 1 0 001.03 1.714L3 9.567V20a2 2 0 002 2h5v-8h4v8h5a2 2 0 002-2V9.567l.485.29a1 1 0 001.03-1.714l-2-1.2-8-4.8a1 1 0 00-1.03 0Z"></path></svg>';

  // Иконка помечена aria-hidden, поэтому без подписи у ссылки не осталось бы
  // доступного имени. Заодно даёт всплывающую подсказку.
  // Разбираем разметку значка парсером, а не через innerHTML: линтер AMO
  // помечает любое присваивание innerHTML предупреждением, независимо от того,
  // что значения у нас свои и постоянные. Парсер к тому же не может выполнить
  // скрипт при разборе, поэтому претензия снимается по существу, а не обходится.
  function svgNode(markup) {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");

    return document.importNode(doc.documentElement, true);
  }

  function makeIconLink(id, href, svg, label) {
    const link = document.createElement("a");

    link.id = id;
    link.href = href;
    link.appendChild(svgNode(svg));
    link.setAttribute("aria-label", label);
    link.title = label;

    return link;
  }

  // Переносим НАСТОЯЩИЙ логотип YouTube, а не рисуем копию: копия означала бы
  // фирменный SVG в коде, который пришлось бы обновлять вручную. Из левого
  // угла он при этом исчезает — следствие переноса, а не отдельное решение.
  //
  // href снимаем, а не гасим клик через CSS: без href <a> перестаёт быть
  // ссылкой по существу — уходит из обхода по Tab, не показывает адрес
  // и не открывается средней кнопкой. pointer-events этого не даёт.
  function disableLogoLink(logo) {
    const link = logo.querySelector("a");

    if (!link) {
      return;
    }

    link.removeAttribute("href");
    link.removeAttribute("title");
    link.tabIndex = -1;
  }

  // Возвращает true, когда логотип на месте, — сигнал наблюдателю отключиться.
  function moveLogoToCenter() {
    const center = document.querySelector("#center");

    if (!center) {
      return false;
    }

    const moved = center.querySelector("ytd-topbar-logo-renderer");

    // Повторяем снятие href и на уже перенесённом: Polymer владеет этим узлом
    // и может вернуть атрибут при пересборке шаблона.
    if (moved) {
      disableLogoLink(moved);
      return true;
    }

    const logo = document.querySelector("ytd-topbar-logo-renderer");

    if (!logo) {
      return false;
    }

    center.prepend(logo);
    disableLogoLink(logo);

    return true;
  }

  // Кнопка аккаунта — настоящий узел YouTube, а не своя ссылка: у него уже есть
  // готовое меню, пересобирать которое незачем. Ищем по #avatar-btn, а не по
  // тегу: тем же тегом помечена и кнопка меню приложений.
  function findAvatarButton() {
    return (
      document
        .getElementById("avatar-btn")
        ?.closest("ytd-topbar-menu-button-renderer") ?? null
    );
  }

  // Переносим в #container, а не в #center: тот у́же экрана и стоит по центру,
  // поэтому его край — это край блока с поиском, а кнопке нужен настоящий край
  // шапки, как у #end на обычном YouTube. В #container она становится сестрой
  // #center и встаёт абсолютно (см. styles.css).
  //
  // Переносим НАВСЕГДА, как логотип: одного перемещения хватает на сеанс,
  // а видимость по страницам держит CSS через html.you-page.
  //
  // Ищем узел именно в #container, а не по глобальному #avatar-btn: Polymer
  // может создать новый экземпляр с тем же id обратно в #end, и поиск по
  // одному id вернул бы не тот. Тот же приём, что в moveLogoToCenter.
  //
  // Возвращает true, когда кнопка на месте, — сигнал наблюдателю отключиться.
  function moveAvatarButtonToMasthead() {
    const container = document.querySelector("#container.ytd-masthead");

    if (!container) {
      return false;
    }

    if (container.querySelector(":scope > ytd-topbar-menu-button-renderer #avatar-btn")) {
      return true;
    }

    const button = findAvatarButton();

    if (!button) {
      return false;
    }

    container.appendChild(button);

    return true;
  }

  // Отдельный наблюдатель, а не часть общего task(): кнопка аккаунта есть
  // только у залогиненных. Требуй её screenReady наравне с остальными — шапка
  // держалась бы скрытой до потолка в 15 с у каждого, кто не вошёл. Здесь она
  // в раскрытии не участвует: встанет на место, когда появится.
  function watchForAvatarButton() {
    if (location.pathname !== "/feed/you") {
      return;
    }

    if (moveAvatarButtonToMasthead()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (moveAvatarButtonToMasthead()) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => observer.disconnect(), WATCH_TIMEOUT_MS);
  }

  // Своя ссылка, а не перенесённый ytd-guide-entry-renderer из бокового меню:
  // вырывать узлы Polymer уже приводило к пересборке шапки со вторым #center.
  // Кладём прямо в #center: ссылка стоит в одном ряду со строкой поиска и
  // является таким же элементом grid, отдельная обёртка ей не нужна.
  function insertYouLink() {
    if (document.querySelector("#yt-you-link")) {
      return true;
    }

    const center = document.querySelector("#center");

    if (!center) {
      return false;
    }

    center.appendChild(
      makeIconLink("yt-you-link", "/feed/you", YOU_ICON_SVG, T.you),
    );

    return true;
  }

  // Обе вставки разом: у них общее условие (наличие #center) и общий момент.
  function decorateCenter() {
    const logo = moveLogoToCenter();
    const link = insertYouLink();

    return logo && link;
  }

  // Кнопка возврата на подписки — на всех страницах, кроме самих подписок.
  // prepend, а не append: она должна стоять слева от строки поиска.
  function syncHomeLink() {
    const existing = document.querySelector("#yt-home-link");

    // На самих подписках кнопка не нужна и мешала бы grid-раскладке #center,
    // поэтому при переходе туда её убираем.
    if (location.pathname === "/feed/subscriptions") {
      existing?.remove();
      return true;
    }

    if (existing) {
      return true;
    }

    const center = document.querySelector("#center");

    if (!center) {
      return false;
    }

    center.prepend(
      makeIconLink(
        "yt-home-link",
        "/feed/subscriptions",
        HOME_ICON_SVG,
        T.subscriptions,
      ),
    );

    return true;
  }

  // #center создаёт Polymer уже после document_start. Наблюдатель — быстрый
  // путь: он вставляет содержимое тем же тактом, что и появление узла, до
  // отрисовки. Медленный путь (опрос ниже) страхует на случай, если узел
  // появится позже, чем наблюдатель успеет сдаться.
  const WATCH_TIMEOUT_MS = 15000;

  function watchForCenter(task) {
    if (task()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (task()) {
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

  // Готовность всего экрана: строка поиска наполнена и все видимые элементы
  // на месте — показываем их разом. Иконки ищем как <svg> в глубину: обёртка
  // <span> появляется раньше самой иконки.
  //
  // Узел YouTube ждём только пока strict. Разница принципиальная: в первые
  // секунды его отсутствие значит "ещё не создан", позже — "возможно,
  // переименован", и ждать нельзя, иначе одна чужая правка добавляет
  // многосекундную задержку к КАЖДОЙ загрузке.
  function ytNodeReady(selector, isReady, strict) {
    const node = document.querySelector(selector);

    return node ? isReady(node) : !strict;
  }

  function screenReady(strict) {
    // Пока YouTube не объявил шапку собранной, состав кнопок ещё не окончателен:
    // кнопки голосового ввода может просто не быть в DOM, и проверка ниже
    // пропустила бы её — иконка появилась бы уже после раскрытия.
    if (!ytNodeReady("ytd-masthead.masthead-finish", () => true, strict)) {
      return false;
    }

    // Классы вида ytSearchboxComponent* — самые ненадёжные из всех, что мы
    // используем: строку поиска YouTube уже переписывал целиком. Поэтому
    // они тоже под послаблением.
    if (
      !ytNodeReady(
        ".ytSearchboxComponentInput",
        (node) => Boolean(node.placeholder),
        strict,
      )
    ) {
      return false;
    }

    if (
      !ytNodeReady(
        ".ytSearchboxComponentSearchButton",
        (node) => Boolean(node.querySelector("svg")),
        strict,
      )
    ) {
      return false;
    }

    // Кнопку голосового ввода ждём только когда YouTube её показывает: там, где
    // распознавание речи недоступно, он держит её в display:none, и безусловное
    // ожидание упиралось бы в таймаут при каждой загрузке.
    const voice = document.querySelector("#voice-search-button");

    if (
      voice &&
      getComputedStyle(voice).display !== "none" &&
      !voice.querySelector("svg")
    ) {
      return false;
    }

    // Собственные элементы послаблению НЕ подлежат: их отсутствие значит, что
    // наша вставка ещё не отработала, а она отработает — опрос повторяет её
    // каждый такт. location.pathname, а не константа: внутри SPA адрес меняется.
    if (location.pathname === "/feed/subscriptions") {
      return Boolean(
        document.querySelector("#center ytd-topbar-logo-renderer") &&
          document.querySelector("#yt-you-link") &&
          document.querySelector("#scroll-arrow"),
      );
    }

    return Boolean(document.querySelector("#yt-home-link"));
  }

  // Потолок раскрытия. Ждать бесконечно нельзя: в условие входят наши
  // собственные вставки, и если узел-хозяин не появится, шапка осталась бы
  // скрытой навсегда. Значение заведомо больше обычной загрузки.
  const REVEAL_TIMEOUT_MS = 15000;

  // Сколько ждать узлы YouTube, прежде чем считать их пропавшими и продолжить
  // без них. При нормальной работе все они появляются заметно раньше, так что
  // поведение не меняется; при переименовании теряется две секунды, а не весь
  // потолок — и не один раз, а при каждой загрузке.
  const YT_NODE_GRACE_MS = 2000;

  function waitForCenterContent(task) {
    const startedAt = Date.now();

    const poll = setInterval(() => {
      // Вставку повторяем прямо здесь, а не полагаемся только на наблюдателя:
      // тот отключается по своему таймауту, и поздно появившийся #center
      // означал бы, что элемент не вставится уже никогда.
      task();

      const elapsed = Date.now() - startedAt;

      if (
        screenReady(elapsed < YT_NODE_GRACE_MS) ||
        elapsed > REVEAL_TIMEOUT_MS
      ) {
        clearInterval(poll);
        root.classList.add("yt-center-ready");
      }
      // Шаг мелкий: на 50 мс раскрытие само по себе запаздывало до трёх кадров.
    }, 16);
  }

  function start() {
    // Логотипом и кнопками распоряжается только этот файл, включая переходы
    // внутри SPA: межфайловый вызов при несовпадении областей видимости упал бы
    // с ReferenceError и оборвал там весь код.
    //
    // Обработчик обязан быть ВНУТРИ start(). Снаружи он работал и при
    // выключенном расширении: логотип переносился в #center, стили были
    // отключены, и шапка выглядела сломанной.
    document.addEventListener("yt-navigate-finish", () => {
      if (location.pathname === "/feed/subscriptions") {
        decorateCenter();
      }

      // Зовём всегда: внутри SPA переход идёт в обе стороны, и функция сама
      // решает, вставить кнопку или убрать.
      syncHomeLink();

      // Сама проверяет путь и не делает ничего вне /feed/you.
      watchForAvatarButton();
    });

    if (path === "/") {
      // replace, а не pushState: главная не остаётся в истории, иначе кнопка
      // "Назад" возвращает на / и та снова редиректит вперёд.
      location.replace("/feed/subscriptions");
      return;
    }

    const onSubscriptions = path === "/feed/subscriptions";

    if (onSubscriptions) {
      // Ставим до первой отрисовки, иначе шапка мелькнёт в обычном виде.
      root.classList.add("subscriptions-page");
    }

    const task = onSubscriptions ? decorateCenter : syncHomeLink;

    watchForCenter(task);

    // На всех страницах, а не только на подписках: иконки лупы и голосового
    // ввода YouTube дорисовывает позже строки поиска везде одинаково.
    waitForCenterContent(task);

    watchForAvatarButton();
  }

  // Выключенное состояние. Класс yt-ext-off отключает правила в styles.css,
  // а три "готовности" ставятся сразу: без них элементы, скрытые до готовности,
  // остались бы скрытыми навсегда — ведь ставить эти классы больше некому.
  function disableEverything() {
    root.classList.add(
      "yt-ext-off",
      "yt-masthead-ready",
      "yt-center-ready",
      "yt-content-ready",
    );
  }

  // Слушатель ставится ДО проверки настройки: иначе выключенное расширение
  // не узнало бы о включении.
  //
  // Здесь перезагружаются только ФОНОВЫЕ вкладки. Активную берёт на себя окно
  // настроек через chrome.tabs.reload — иначе не обновить вкладку, открытую
  // до установки расширения: контент-скрипта в ней ещё нет. Разделение нужно,
  // чтобы активная не перезагружалась дважды.
  function applyShorts(showShorts) {
    root.classList.toggle("yt-shorts-visible", Boolean(showShorts));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }

    if (changes.enabled && document.hidden) {
      location.reload();
    }

    // Перезагрузка не нужна: правила чисто стилевые, и лента перерисовывается
    // сразу. Выключенное расширение страницу не трогает.
    if (changes.showShorts && !root.classList.contains("yt-ext-off")) {
      applyShorts(changes.showShorts.newValue);
    }
  });

  // Чтение асинхронное, а мы на document_start. На практике это незаметно:
  // узлы, которые мы прячем и переносим, Polymer создаёт заметно позже,
  // и к их появлению настройка уже прочитана.
  chrome.storage.local.get({ enabled: true, showShorts: false }, (settings) => {
    if (settings.enabled) {
      applyShorts(settings.showShorts);
      start();
    } else {
      disableEverything();
    }
  });
})();
