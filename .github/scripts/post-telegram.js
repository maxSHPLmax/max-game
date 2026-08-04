// ===========================================================
//  АВТОПОСТ В TELEGRAM
// ===========================================================
//  Запускается из GitHub Actions после пуша в main.
//  Берёт верхнюю запись из changelog.js, сравнивает её версию
//  с той, что была в предыдущем коммите, и если версия
//  изменилась — публикует пост в канал.
//
//  Переменные окружения:
//    TELEGRAM_BOT_TOKEN  — токен бота от @BotFather
//    TELEGRAM_CHAT_ID    — @имя_канала или числовой id
//    SITE_URL            — адрес игры
//    PREV_SHA            — состояние репозитория до пуша
//    FORCE               — 'true', чтобы запостить даже без
//                          смены версии (ручной запуск)
//    DRY_RUN             — 'true', чтобы только показать текст
// ===========================================================

const fs = require('fs');
const { execSync } = require('child_process');

const EMOJI = {
  level: '🗺',
  feat:  '✨',
  fix:   '🔧',
  chore: '⚙️',
};

// --- чтение changelog.js ------------------------------------
// Файл написан как обычный скрипт с `const CHANGELOG = [...]`,
// поэтому вычисляем его и сразу возвращаем значение.
function readChangelog(source) {
  return eval(source + ';CHANGELOG');
}

function currentChangelog() {
  return readChangelog(fs.readFileSync('changelog.js', 'utf8'));
}

function previousVersion() {
  // За один push может приехать несколько коммитов. Сравнивать надо
  // с состоянием ДО пуша, а не с предыдущим коммитом — иначе, если
  // версию подняли не последним коммитом, пост не уйдёт.
  const before = process.env.PREV_SHA;
  const refs = [];

  if (before && !/^0+$/.test(before)) refs.push(before);
  refs.push('HEAD~1');

  for (const ref of refs) {
    try {
      const old = execSync('git show ' + ref + ':changelog.js', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return readChangelog(old)[0].version;
    } catch (e) {
      // этой ревизии нет или в ней не было файла — пробуем следующую
    }
  }

  return null;   // первый коммит
}

// --- сборка текста ------------------------------------------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMessage(release, siteUrl) {
  const lines = [];

  lines.push('🐕 <b>Siba Hunter v' + escapeHtml(release.version) + '</b>');
  lines.push(escapeHtml(release.title));
  lines.push('');

  release.changes.forEach(function (ch) {
    lines.push((EMOJI[ch.type] || '•') + ' ' + escapeHtml(ch.text));
  });

  lines.push('');
  lines.push('▶️ Играть: ' + siteUrl);

  return lines.join('\n');
}

// --- отправка -----------------------------------------------
async function send(token, chatId, text) {
  const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error('Telegram отказал: ' + JSON.stringify(data));
  }
  return data;
}

// --- основной сценарий --------------------------------------
async function main() {
  const release = currentChangelog()[0];
  const prev = previousVersion();
  const force = process.env.FORCE === 'true';
  const dryRun = process.env.DRY_RUN === 'true';

  console.log('Текущая версия: ' + release.version);
  console.log('Версия в прошлом коммите: ' + (prev || 'нет'));

  if (prev === release.version && !force) {
    console.log('Версия не менялась — постить нечего.');
    return;
  }

  const siteUrl = process.env.SITE_URL || 'https://maxshplmax.github.io/max-game/';
  const text = buildMessage(release, siteUrl);

  console.log('\n--- текст поста ---\n' + text + '\n-------------------\n');

  if (dryRun) {
    console.log('DRY_RUN — ничего не отправлено.');
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('Нет TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в секретах репозитория.');
  }

  await send(token, chatId, text);
  console.log('Опубликовано.');
}

main().catch(function (err) {
  console.error(err.message);
  process.exit(1);
});
