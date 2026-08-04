// ===========================================================
//  ТОЧКА ВХОДА
// ===========================================================
//  Номер версии живёт в changelog.js, здесь его дублировать
//  не нужно.
// ===========================================================

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 896,          // 28 клеток по 32px
  height: 512,         // 16 клеток по 32px — ровно высота уровня
  pixelArt: true,
  backgroundColor: '#6ab7e8',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 950 },
      debug: false,     // поставь true, чтобы увидеть хитбоксы
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,          // вписать в контейнер целиком
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: false,             // не трогать нашу вёрстку
  },
  scene: [GameScene],
};

// Phaser сам запускает первую сцену из списка
const game = new Phaser.Game(config);

// Контейнер меняет размер вместе с окном — пересчитываем масштаб.
// Без этого канвас остаётся того размера, что был при загрузке.
const holder = document.getElementById('game');
if (holder && window.ResizeObserver) {
  new ResizeObserver(function () {
    game.scale.refresh();
  }).observe(holder);
}
