// ===========================================================
//  СКРИПТ САЙТА (не игры)
//  Работает на обеих страницах, берёт данные из changelog.js
// ===========================================================

(function () {
  'use strict';

  const TAGS = {
    level: 'уровень',
    feat:  'новое',
    fix:   'фикс',
    chore: 'тех',
  };

  const latest = CHANGELOG[0];

  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // --- номер версии в углу (есть на обеих страницах) --------
  const badge = document.getElementById('version');
  if (badge) badge.textContent = 'v' + latest.version;

  // --- блок «свежее обновление» на главной ------------------
  const strip = document.getElementById('whats-new');
  if (strip) {
    strip.innerHTML =
      '<span class="eyebrow">Свежее</span>' +
      '<span class="what"><strong>v' + latest.version + '</strong> — ' + latest.title + '</span>' +
      '<span class="when">' + formatDate(latest.date) + '</span>' +
      '<a href="changelog.html">Все обновления &rarr;</a>';
  }

  // --- полная история на changelog.html ---------------------
  const list = document.getElementById('releases');
  if (list) {
    list.innerHTML = CHANGELOG.map(function (rel, i) {
      const items = rel.changes.map(function (ch) {
        const label = TAGS[ch.type] || ch.type;
        return '<li><span class="tag tag-' + ch.type + '">' + label + '</span>' +
               '<span>' + ch.text + '</span></li>';
      }).join('');

      return '' +
        '<article class="release' + (i === 0 ? ' is-latest' : '') + '">' +
          '<div class="rail"><span class="flag"></span></div>' +
          '<div class="body">' +
            '<div class="meta">' +
              '<h2 class="ver">v' + rel.version + '</h2>' +
              '<time datetime="' + rel.date + '">' + formatDate(rel.date) + '</time>' +
              (i === 0 ? '<span class="now">сейчас на сайте</span>' : '') +
            '</div>' +
            '<h3>' + rel.title + '</h3>' +
            '<ul>' + items + '</ul>' +
          '</div>' +
        '</article>';
    }).join('');
  }
})();
