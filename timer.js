// Фоновый скрипт нужен ради одного: досчитать интервал и сообщить об
// окончании, когда окно расширения закрыто.
//
// Отсчёт не тикает в коде — в хранилище лежит МОМЕНТ окончания, будильник
// взводится на него. Поэтому ни сон компьютера, ни выгрузка service worker'а
// счёт не сбивают: время считают часы, а не мы.

const ALARM = "timer";

// Продублировано в popup.js: два независимых контекста, общего модуля у них
// нет, а тянуть сборку ради одного объекта незачем.
const DEFAULTS = {
  minutes: 10,
  endsAt: null,
  leftMs: null,
  // Момент срабатывания. Нужен как СИГНАЛ для окна на странице YouTube:
  // обнуление endsAt само по себе неотличимо от сброса руками, а по смене
  // этого поля контент-скрипт понимает, что отсчёт именно закончился.
  finishedAt: null,
};

// Колбэки, а не промисы, и так же во всех остальных файлах расширения.
// Промисы у chrome.* — свойство Chrome; Firefox обещает их у browser.*,
// а про chrome.* документация внятного ответа не даёт. Колбэк работает
// в обоих браузерах без оговорок, поэтому зависимости от этого вопроса
// здесь просто нет.
function readTimer(done) {
  chrome.storage.local.get({ timer: DEFAULTS }, (settings) => {
    done(Object.assign({}, DEFAULTS, settings.timer));
  });
}

// Будильником распоряжается только этот файл. Окно расширения его не трогает —
// оно пишет состояние в хранилище, а сюда приходит storage.onChanged. Так
// у будильника один хозяин, и рассинхрона между окном и фоном не бывает.
function syncAlarm() {
  readTimer((timer) => {
    chrome.alarms.clear(ALARM, () => {
      if (timer.endsAt) {
        chrome.alarms.create(ALARM, { when: timer.endsAt });
      }
    });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM) {
    return;
  }

  readTimer((timer) => {
    // Пауза могла случиться в ту же секунду, что и срабатывание будильника.
    // Тогда отсчёта уже нет и заканчивать нечего.
    if (!timer.endsAt) {
      return;
    }

    // Возвращаем в исходное, а не оставляем 00:00: сразу после сигнала таймер
    // снова готов к запуску, и отдельного сброса для этого не нужно.
    //
    // Запись поднимет storage.onChanged, а тот снимет будильник — отдельного
    // вызова здесь не нужно.
    chrome.storage.local.set(
      {
        timer: Object.assign({}, timer, {
          endsAt: null,
          leftMs: null,
          finishedAt: Date.now(),
        }),
      },
      () => {
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icons/icon128.png"),
          title: chrome.i18n.getMessage("extName"),
          message: chrome.i18n.getMessage("timerDone"),
        });
      },
    );
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.timer) {
    syncAlarm();
  }
});

// Будильники переживают перезапуск браузера, но не переустановку и не сбой.
// Восстанавливаем из endsAt: если момент уже прошёл, будильник со сроком в
// прошлом срабатывает сразу — сигнал догонит сам.
chrome.runtime.onStartup.addListener(syncAlarm);
chrome.runtime.onInstalled.addListener(syncAlarm);
