// ===========================================================
//  ПИКСЕЛЬ-АРТ
// ===========================================================
//  Спрайты рисуются кодом — картинок в проекте нет.
//  Каждый спрайт это сетка символов, один символ = один пиксель.
//  Точка — прозрачно. Остальные буквы — цвета из PIXEL_COLORS.
//
//  Хочешь перекрасить собаку — поменяй цвет 'f' ниже.
//  Хочешь другого персонажа — перерисуй сетку, размер
//  подставится сам.
// ===========================================================

const PIXEL_COLORS = {
  o: 0x3a2418,   // тёмный контур
  f: 0xde9147,   // рыжая шерсть
  d: 0xb06a2f,   // тень на шерсти
  c: 0xf7ead6,   // кремовые щёки, грудь, лапы
  e: 0x1a1208,   // глаза и нос
  W: 0xf0f0eb,   // косточка
  S: 0xc8c6be,   // тень на косточке
};

const SPRITES = {
  // 16 x 16 пикселей, рисуется в масштабе 2 → спрайт 32x32
  shiba: [
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
    '..ofco...ocfo...',
    '..occo...occo...',
  ],

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
