// ===========================================================
//  ПИКСЕЛЬ-АРТ
// ===========================================================
//  Спрайты рисуются кодом — картинок в проекте нет.
//  Каждый спрайт это сетка символов, один символ = один пиксель.
//  Точка — прозрачно. Остальные буквы — цвета из PIXEL_COLORS.
//
//  Собака собирается из двух частей: неизменное тело плюс
//  вариант лап. Так кадры анимации не приходится рисовать
//  целиком — меняются только две нижние строки.
// ===========================================================

const PIXEL_COLORS = {
  o: 0x3a2418,   // тёмный контур
  f: 0xde9147,   // рыжая шерсть
  d: 0xb06a2f,   // тень на шерсти
  c: 0xf7ead6,   // кремовые щёки, грудь, лапы
  e: 0x1a1208,   // глаза и нос
  W: 0xf0f0eb,   // косточка
  S: 0xc8c6be,   // тень на косточке

  k: 0x2d263a,   // контур кота — холоднее собачьего
  g: 0x7a7196,   // серо-лиловая шерсть
  h: 0x585170,   // тень на шерсти
  m: 0xcec9e0,   // светлая морда и лапы
  y: 0xffd23f,   // злые жёлтые глаза

  Y: 0xffcc33,   // золотая косточка
  Z: 0xc4941c,   // тень на золоте
};

// Тело — 14 строк. Ниже к нему приставляются лапы.
const SHIBA_BODY = [
  '..oo........oo..',
  '.offo......offo.',
  '.offdo....odffo.',
  '..offoooooooffo.',
  '..offffffffffdo.',
  '.offccfffccffdo.',
  '.offcefdcceffdo.',
  '.offccfdfccffdo.',
  '.offfffdfffffdo.',
  '..offffeefffdo..',
  '...offcccccdo...',
  '....oofffdoo....',
  '...offcccccfo...',
  '...offcccccfo...',
];

// Варианты лап — по 2 строки, приставляются снизу к телу.
const SHIBA_LEGS = {
  stand: ['..ofco...ocfo...',
          '..occo...occo...'],

  step1: ['..ofco...ocfo...',   // левая лапа поднята
          '.........occo...'],

  step2: ['..ofco...ocfo...',   // правая лапа поднята
          '..occo..........'],

  jump:  ['.ofco.....ocfo..',   // лапы враскоряку
          'occo.......occo.'],
};

// Собирает готовую сетку собаки: тело + выбранные лапы
function composeShiba(legsKey) {
  return SHIBA_BODY.concat(SHIBA_LEGS[legsKey]);
}

// --- кот-противник -----------------------------------------
// Собран так же, как собака: тело плюс варианты лап.
const CAT_BODY = [
  '................',
  '..k..........k..',
  '..kk........kk..',
  '..kgk......kgk..',
  '..kggkkkkkkggk..',
  '..kggggggggggk..',
  '.kggyeggggeyggk.',
  '.kggyyggggyyggk.',
  '.kggggmmmmggggk.',
  '.kgggmkkmmggggk.',
  '..kggmmmmmmggk..',
  '...kgghhhhggk...',
  '...kggmmmmggk...',
  '...kggmmmmggk...',
];

const CAT_LEGS = {
  step1: ['..kggk....kggk..',
          '..kmmk..........'],

  step2: ['..kggk....kggk..',
          '..........kmmk..'],
};

function composeCat(legsKey) {
  return CAT_BODY.concat(CAT_LEGS[legsKey]);
}

const SPRITES = {
  // 9 x 7 пикселей, масштаб 2 → 18x14
  bone: [
    '.oo...oo.',
    'oWWo.oWWo',
    'oWWWWWWWo',
    'oWWWWWSSo',
    'oWWWWWSSo',
    'oWSo.oSSo',
    '.oo...oo.',
  ],

  // та же форма, но золотая и крупнее — масштаб 3 → 27x21
  goldbone: [
    '.oo...oo.',
    'oYYo.oYYo',
    'oYYYYYYYo',
    'oYYYYYZZo',
    'oYYYYYZZo',
    'oYZo.oZZo',
    '.oo...oo.',
  ],
};

// Рисует сетку в объект Graphics и возвращает итоговый размер
function drawPixelArt(g, grid, scale) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const ch = grid[y][x];
      if (ch === '.') continue;
      g.fillStyle(PIXEL_COLORS[ch]);
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return { width: grid[0].length * scale, height: grid.length * scale };
}
