// ===========================================================
//  ТОЧКА ВХОДА
// ===========================================================

const GAME_VERSION = '0.1.0';

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
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [GameScene],
};

// Phaser сам запускает первую сцену из списка
const game = new Phaser.Game(config);
