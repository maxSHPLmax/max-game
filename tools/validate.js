#!/usr/bin/env node
// ===========================================================
//  ПРОВЕРКА ПРОЕКТА
// ===========================================================
//  Запуск:  node tools/validate.js
//  Выход:   0 — всё хорошо, 1 — есть ошибки
//
//  Проверяет инварианты из CLAUDE.md: целостность карт,
//  проходимость ям для обеих комплекций собаки, опору под
//  флагом и котами, потолки, порядок скриптов и changelog.
//
//  Физические числа не дублируются — они читаются прямо из
//  TUNING и SIZES в GameScene.js. Поменяешь прыжок в игре —
//  проверка автоматически станет считать по-новому.
// ===========================================================

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TILE = 32;

const errors = [];
const warnings = [];

const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// Файлы проекта — обычные скрипты без экспорта, поэтому
// вычисляем их и забираем нужные значения тем же выражением.
function evalFile(rel, expr) {
  return eval(read(rel) + ';' + expr);
}

// GameScene наследуется от Phaser.Scene, которого в Node нет.
// Классу для объявления достаточно пустышки — методы не вызываются.
function evalScene(expr) {
  const Phaser = {
    Scene: class {},
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false } },
    Scale: {},
    AUTO: 0,
  };
  void Phaser;
  return eval(read('src/scenes/GameScene.js') + ';' + expr);
}

// ---------- 1. обязательные файлы --------------------------

const REQUIRED = [
  'index.html', 'changelog.html', 'changelog.js', 'style.css',
  'favicon.svg', 'og.png', 'CLAUDE.md', 'README.md',
  'src/main.js', 'src/site.js', 'src/touch.js', 'src/sprites.js',
  'src/levels.js', 'src/save.js', 'src/run.js',
  'src/scenes/GameScene.js',
  '.github/workflows/telegram.yml',
  '.github/scripts/post-telegram.js',
];

REQUIRED.forEach((f) => {
  if (!exists(f)) fail('файлы', `нет ${f}`);
});

fs.readdirSync(ROOT)
  .filter((f) => f.endsWith('.js') && f !== 'changelog.js')
  .forEach((f) => fail('файлы', `${f} лежит в корне, место в src/`));

// ---------- 2. порядок подключения скриптов ----------------

const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);

const mustPrecede = [
  ['src/sprites.js', 'src/scenes/GameScene.js'],
  ['src/levels.js', 'src/scenes/GameScene.js'],
  ['src/save.js', 'src/scenes/GameScene.js'],
  ['src/run.js', 'src/scenes/GameScene.js'],
  ['src/touch.js', 'src/scenes/GameScene.js'],
  ['changelog.js', 'src/site.js'],
  ['src/scenes/GameScene.js', 'src/main.js'],
];

mustPrecede.forEach(([a, b]) => {
  const ia = scripts.indexOf(a);
  const ib = scripts.indexOf(b);
  if (ia === -1) fail('index.html', `${a} не подключён`);
  else if (ib === -1) fail('index.html', `${b} не подключён`);
  else if (ia > ib) fail('index.html', `${a} должен идти до ${b}`);
});

// ---------- 3. физика из кода игры -------------------------

const sceneSrc = read('src/scenes/GameScene.js');

function num(name) {
  const m = sceneSrc.match(new RegExp(name + '\\s*:\\s*(-?[\\d.]+)'));
  if (!m) {
    fail('GameScene.js', `не нашёл настройку ${name}`);
    return NaN;
  }
  return parseFloat(m[1]);
}

const SPEED = num('runSpeed');
const JUMP = num('jumpPower');
const GRAV = num('gravity');

const SIZES = evalScene('SIZES');
const BODIES = [
  { name: 'малая', h: SIZES.small.h },
  { name: 'большая', h: SIZES.big.h },
];

// Высота подъёма к моменту, когда собака пролетела по
// горизонтали расстояние в gap клеток (плюс клетка на края).
function apexAfterGap(gap) {
  const t = ((gap + 1) * TILE) / SPEED;
  if (t > (2 * JUMP) / GRAV) return null;      // прыжок кончится раньше
  return JUMP * t - 0.5 * GRAV * t * t;
}

const MAX_APEX = (JUMP * JUMP) / (2 * GRAV);

// Минимальная высота, без которой яму не перелететь: чтобы
// провести в воздухе нужное время, собака обязана подняться
// хотя бы настолько. Под низким потолком это и есть ограничение
// — не «дотянется ли», а «хватит ли места разогнаться вверх».
function minApex(gap, rise) {
  const v = ((gap + 1) * TILE * GRAV) / (2 * SPEED);
  return Math.max((v * v) / (2 * GRAV), Math.max(rise, 0));
}

// ---------- 4. уровни --------------------------------------

const LEVELS = evalFile('src/levels.js', 'LEVELS');
const LEGEND = new Set(['#', '=', 'o', 'G', 'P', 'F', 'E', ' ']);
const SOLID = new Set(['#', '=']);

const isSolid = (rows, r, c) =>
  r >= 0 && r < rows.length && c >= 0 && c < rows[r].length && SOLID.has(rows[r][c]);

// Верх поверхности клетки: платформа '=' занимает верхнюю половину
const surfaceY = (rows, r, c) => (rows[r][c] === '=' ? r * TILE + TILE / 2 : r * TILE);

// Движущаяся платформа, чья стартовая позиция накрывает клетку
// (r, c) — стоит так же, как '=' в том же ряду.
function moverAtRow(movers, r, c) {
  return movers.find((m) => m.row === r && c >= m.col && c < m.col + m.w);
}

// Ближайшая опора под точкой: возвращает {r, y} или null.
// movers передаётся только там, где стартовая позиция платформы
// разрешена как опора (коты) — флаг и игрок должны стоять на земле.
function supportBelow(rows, r, c, movers) {
  for (let rr = r + 1; rr < rows.length; rr++) {
    if (isSolid(rows, rr, c)) return { r: rr, y: surfaceY(rows, rr, c) };
    if (movers) {
      const m = moverAtRow(movers, rr, c);
      if (m) return { r: rr, y: rr * TILE + TILE / 2, mover: m };
    }
  }
  return null;
}

// Положение платформы в момент t∈[0,1] пути от старта к дальней
// точке, округлённое до клетки — как площадка для графа прыжков.
function moverSample(m, t) {
  const col = Math.round(m.col + m.dx * t);
  const row = Math.round(m.row + m.dy * t);
  return { r: row, c0: col, c1: col + m.w - 1, y: row * TILE + TILE / 2 };
}

// Просвет над головой на площадке: сколько пикселей свободно
// между макушкой стоящей собаки и низом ближайшего потолка
function clearance(rows, r, c, surfY, bodyH) {
  for (let rr = r - 1; rr >= 0; rr--) {
    if (isSolid(rows, rr, c)) {
      return surfY - bodyH - (rr + 1) * TILE;
    }
  }
  return Infinity;
}

LEVELS.forEach((lvl, li) => {
  const where = `уровень ${li + 1} «${lvl.name}»`;
  const rows = lvl.rows;
  const movers = lvl.movers || [];

  // --- геометрия сетки ---
  if (rows.length !== 16) fail(where, `${rows.length} строк вместо 16`);

  const widths = new Set(rows.map((r) => r.length));
  if (widths.size > 1) fail(where, `строки разной длины: ${[...widths].join(', ')}`);

  const W = rows[0].length;

  const count = {};
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      count[ch] = (count[ch] || 0) + 1;
      if (!LEGEND.has(ch)) fail(where, `неизвестный символ "${ch}" в строке ${r}, колонке ${c}`);
    });
  });

  if ((count.P || 0) !== 1) fail(where, `меток старта P: ${count.P || 0}, нужна ровно одна`);
  if ((count.F || 0) !== 1) fail(where, `флагов F: ${count.F || 0}, нужен ровно один`);
  if (!count.o) warn(where, 'ни одной косточки');

  // --- объекты стоят на земле ---
  // Спрайт ставится центром в клетку, низ тела приходится
  // на (строка+1)*32 — это должно совпасть с верхом опоры.
  ['P', 'F', 'E', 'G'].forEach((mark) => {
    rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch !== mark) return;
        const bottom = (r + 1) * TILE;
        const sup = supportBelow(rows, r, c, mark === 'E' ? movers : undefined);

        if (mark === 'G') {
          if (!sup) warn(where, `золотая косточка в колонке ${c} висит над пропастью`);
          return;
        }

        if (!sup) {
          fail(where, `${mark} в строке ${r}, колонке ${c}: под ним нет опоры`);
          return;
        }

        const drop = sup.y - bottom;

        // Флаг статичен — он обязан стоять точно. Собака и коты
        // падают под гравитацией, поэтому им прощается полклетки:
        // ровно столько даёт платформа '=', занимающая верхнюю
        // половину клетки. Точнее текстовая карта выразить не может.
        const allowed = mark === 'F' ? 0 : TILE / 2;

        if (drop < 0) {
          fail(where, `${mark} в строке ${r}, колонке ${c}: утоплен в опору на ${-drop}px`);
        } else if (drop > allowed) {
          fail(where,
            `${mark} в строке ${r}, колонке ${c}: низ на ${bottom}px, ` +
            `а опора на ${sup.y}px — разрыв ${drop}px`);
        }
      });
    });
  });

  // --- котам нужно место для патрулирования ---
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch !== 'E') return;
      const sup = supportBelow(rows, r, c, movers);
      if (!sup) return;                       // уже сообщили выше

      if (sup.mover) {
        if (sup.mover.w < 3) {
          fail(where, `кот в колонке ${c}: движущаяся платформа шириной ${sup.mover.w} клеток, нужно от 3`);
        }
        return;
      }

      let left = c;
      let right = c;
      while (isSolid(rows, sup.r, left - 1)) left--;
      while (isSolid(rows, sup.r, right + 1)) right++;
      const width = right - left + 1;

      if (width < 5) {
        fail(where, `кот в колонке ${c}: площадка ${width} клеток, нужно от 5`);
      }
    });
  });

  // --- предметы не внутри стен ---
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if ((ch === 'o' || ch === 'G') && isSolid(rows, r, c)) {
        fail(where, `косточка в строке ${r}, колонке ${c} внутри блока`);
      }
    });
  });

  // --- путь движущейся платформы не задевает твёрдые блоки ---
  movers.forEach((m) => {
    const STEPS = 20;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const x0 = (m.col + m.dx * t) * TILE;
      const y0 = (m.row + m.dy * t) * TILE;
      const x1 = x0 + m.w * TILE;
      const y1 = y0 + TILE / 2;

      const c0 = Math.floor(x0 / TILE);
      const c1 = Math.ceil(x1 / TILE) - 1;
      const r0 = Math.floor(y0 / TILE);
      const r1 = Math.ceil(y1 / TILE) - 1;

      let hit = null;
      for (let r = r0; r <= r1 && !hit; r++) {
        for (let c = c0; c <= c1 && !hit; c++) {
          if (isSolid(rows, r, c)) hit = { r, c };
        }
      }

      if (hit) {
        fail(where,
          `платформа из строки ${m.row}, колонки ${m.col}: путь пересекает твёрдый блок ` +
          `в строке ${hit.r}, колонке ${hit.c}`);
        break;
      }
    }
  });

  // --- площадки и ямы между ними ---
  const plats = [];
  for (let r = 0; r < rows.length; r++) {
    let run = null;
    for (let c = 0; c <= W; c++) {
      const top = isSolid(rows, r, c) && !isSolid(rows, r - 1, c);
      if (top) {
        if (!run) run = { r, c0: c, c1: c };
        else run.c1 = c;
      } else if (run) {
        run.y = surfaceY(rows, run.r, run.c0);
        plats.push(run);
        run = null;
      }
    }
  }

  plats.sort((a, b) => a.c0 - b.c0);

  // Движущаяся платформа даёт опору в любой точке пути — считаем
  // её присутствующей в обеих крайних точках и в середине пути.
  // Как источник прыжка (a) её не используем: игрок может подождать
  // на ней сколько угодно и прыгнуть с любой позиции, а не только
  // с трёх сэмплов, так что тут она — только цель приземления (b).
  const moverPlats = [];
  movers.forEach((m) => [0, 0.5, 1].forEach((t) => moverPlats.push(moverSample(m, t))));
  const landingSpots = plats.concat(moverPlats).sort((a, b) => a.c0 - b.c0);

  plats.forEach((a) => {
    const onward = landingSpots.filter((b) => b.c0 > a.c1);
    if (!onward.length) return;               // самая правая площадка

    let best = null;
    const reachable = onward.some((b) => {
      const gap = b.c0 - a.c1 - 1;
      const apex = apexAfterGap(gap);
      const rise = a.y - b.y;                 // >0 — прыгать вверх

      if (apex === null) return false;
      const need = Math.max(rise, 0);

      // потолок на взлёте и на посадке
      const room = Math.min(
        ...BODIES.map((body) => Math.min(
          clearance(rows, a.r, a.c1, a.y, body.h),
          clearance(rows, b.r, b.c0, b.y, body.h)
        ))
      );

      const floor = minApex(gap, rise);
      const fits = room === Infinity || floor + 8 <= room;
      const ok = apex >= need && fits;

      if (!best || (apex - need) > (best.apex - best.need)) {
        best = { gap, rise, apex, need, room, floor, b };
      }
      return ok;
    });

    if (!reachable && best) {
      const roomTxt = best.room === Infinity ? 'открыто' : `${Math.round(best.room)}px`;
      fail(where,
        `с площадки ${a.c0}-${a.c1} (строка ${a.r}) не перепрыгнуть дальше: ` +
        `яма ${best.gap} клеток, подъём ${Math.round(best.need)}px, ` +
        `нужна высота от ${Math.round(best.floor)}px, ` +
        `прыжок даёт ${Math.round(best.apex)}px, над головой ${roomTxt}`);
    }
  });

  // --- потолки: собака обеих комплекций должна помещаться ---
  plats.forEach((p) => {
    BODIES.forEach((body) => {
      for (let c = p.c0; c <= p.c1; c++) {
        const room = clearance(rows, p.r, c, p.y, body.h);
        if (room < 0) {
          fail(where, `${body.name} собака не помещается на площадке в колонке ${c}: не хватает ${-Math.round(room)}px`);
          return;
        }
      }
    });
  });

  // --- на своды нельзя забраться сверху ---
  // Свод — это блок, под которым есть проход: пол ниже и
  // хотя бы две пустые клетки между ними. Обычная висячая
  // платформа сводом не считается, на неё и надо запрыгивать.
  plats.forEach((p) => {
    // толщина блока: свод делается многослойным, платформа — в одну клетку
    let thick = 0;
    while (isSolid(rows, p.r + thick, p.c0)) thick++;
    if (thick < 2) return;

    const floor = supportBelow(rows, p.r + thick - 1, p.c0);
    if (!floor || floor.r - (p.r + thick) < 2) return;

    const reach = floor.y - SIZES.small.h - MAX_APEX;   // куда достаёт макушка в прыжке
    if (p.y > reach) {
      warn(where, `на свод в колонках ${p.c0}-${p.c1} можно запрыгнуть сверху и обойти его`);
    }
  });
});

// ---------- 5. спрайты -------------------------------------

const spr = evalFile('src/sprites.js',
  '({ pal: PIXEL_COLORS, grids: { shiba: composeShiba("stand"), shibaJump: composeShiba("jump"), cat: composeCat("step1"), bone: SPRITES.bone, gold: SPRITES.goldbone } })');

Object.entries(spr.grids).forEach(([name, grid]) => {
  const w = new Set(grid.map((r) => r.length));
  if (w.size > 1) fail('спрайты', `${name}: строки разной длины ${[...w].join(', ')}`);
  [...new Set(grid.join(''))].forEach((ch) => {
    if (ch !== '.' && !(ch in spr.pal)) {
      fail('спрайты', `${name}: символ "${ch}" отсутствует в PIXEL_COLORS`);
    }
  });
});

// ---------- 6. changelog -----------------------------------

const CHANGELOG = evalFile('changelog.js', 'CHANGELOG');
const TYPES = new Set(['level', 'feat', 'fix', 'chore']);

const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
};

const seen = new Set();
CHANGELOG.forEach((rel, i) => {
  if (!/^\d+\.\d+\.\d+$/.test(rel.version)) fail('changelog', `странная версия "${rel.version}"`);
  if (seen.has(rel.version)) fail('changelog', `версия ${rel.version} встречается дважды`);
  seen.add(rel.version);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rel.date)) fail('changelog', `${rel.version}: дата не в формате ГГГГ-ММ-ДД`);
  if (!rel.title) fail('changelog', `${rel.version}: пустой заголовок`);
  if (!rel.changes || !rel.changes.length) fail('changelog', `${rel.version}: нет изменений`);

  (rel.changes || []).forEach((ch) => {
    if (!TYPES.has(ch.type)) fail('changelog', `${rel.version}: неизвестный тип "${ch.type}"`);
    if (!ch.text) fail('changelog', `${rel.version}: пустой текст изменения`);
  });

  if (i > 0 && cmp(CHANGELOG[i - 1].version, rel.version) <= 0) {
    fail('changelog', `${rel.version} стоит не по убыванию — свежая запись должна быть сверху`);
  }
});

// ---------- итог -------------------------------------------

console.log('физика из кода: скорость %d, прыжок %d, гравитация %d (подъём до %dpx)',
  SPEED, JUMP, GRAV, Math.round(MAX_APEX));
console.log('уровней: %d | версия: %s\n', LEVELS.length, CHANGELOG[0].version);

warnings.forEach((w) => console.log('  ⚠  ' + w));
errors.forEach((e) => console.log('  ✗  ' + e));

if (errors.length) {
  console.log('\nПРОВЕРКА НЕ ПРОЙДЕНА: ошибок %d, предупреждений %d', errors.length, warnings.length);
  process.exit(1);
}

console.log('%sПроверка пройдена%s', warnings.length ? '\n' : '',
  warnings.length ? ` (предупреждений: ${warnings.length})` : '');
