// ===========================================================
//  ИГРОВАЯ СЦЕНА
// ===========================================================

// --- настройки, которые приятно крутить ---------------------
const TUNING = {
  runSpeed:   210,   // скорость бега, px/сек
  jumpPower:  520,   // сила прыжка
  gravity:    950,   // гравитация
  coyoteMs:   110,   // сколько мс после края ещё можно прыгнуть
  bufferMs:   120,   // сколько мс до земли засчитывается нажатие прыжка
};

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelIndex = data && data.levelIndex ? data.levelIndex : 0;
  }

  // --- рисуем спрайты кодом, чтобы не тащить картинки --------
  preload() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // земля
    g.fillStyle(0x4a3220).fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x6b8f3a).fillRect(0, 0, TILE, 7);
    g.fillStyle(0x2c1d12).fillRect(0, TILE - 2, TILE, 2);
    g.generateTexture('ground', TILE, TILE);
    g.clear();

    // платформа
    g.fillStyle(0x8a6a3f).fillRect(0, 0, TILE, TILE / 2);
    g.fillStyle(0xb08a55).fillRect(0, 0, TILE, 4);
    g.generateTexture('platform', TILE, TILE / 2);
    g.clear();

    // игрок
    g.fillStyle(0xe04b4b).fillRect(0, 0, 24, 32);
    g.fillStyle(0xf5d0a9).fillRect(4, 6, 16, 10);
    g.fillStyle(0x2b2b3a).fillRect(0, 0, 24, 6);
    g.fillStyle(0x1a1a28).fillRect(13, 9, 3, 3);
    g.generateTexture('player', 24, 32);
    g.clear();

    // монета
    g.fillStyle(0xffcc33).fillCircle(8, 8, 8);
    g.fillStyle(0xffe89a).fillCircle(6, 6, 3);
    g.generateTexture('coin', 16, 16);
    g.clear();

    // флаг
    g.fillStyle(0xdddddd).fillRect(0, 0, 4, 64);
    g.fillStyle(0x4ec9b0).fillTriangle(4, 4, 30, 14, 4, 24);
    g.generateTexture('flag', 32, 64);
    g.destroy();
  }

  create() {
    const level = LEVELS[this.levelIndex];
    const rows = level.rows;

    this.levelWidth  = rows[0].length * TILE;
    this.levelHeight = rows.length * TILE;

    this.coinsCollected = 0;
    this.startedAt = this.time.now;
    this.finished = false;

    this.solids = this.physics.add.staticGroup();
    this.coins  = this.physics.add.group({ allowGravity: false, immovable: true });

    // --- разбираем карту ------------------------------------
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const ch = rows[r][c];
        const x = c * TILE;
        const y = r * TILE;

        if (ch === '#') {
          this.solids.create(x + TILE / 2, y + TILE / 2, 'ground');
        } else if (ch === '=') {
          this.solids.create(x + TILE / 2, y + TILE / 4, 'platform');
        } else if (ch === 'o') {
          this.coins.create(x + TILE / 2, y + TILE / 2, 'coin');
        } else if (ch === 'P') {
          this.spawn = { x: x + TILE / 2, y: y + TILE / 2 };
        } else if (ch === 'F') {
          this.flag = this.physics.add.staticSprite(x + TILE / 2, y, 'flag');
        }
      }
    }

    this.totalCoins = this.coins.getChildren().length;

    // монетки слегка покачиваются
    this.tweens.add({
      targets: this.coins.getChildren(),
      y: '-=5',
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // --- игрок ----------------------------------------------
    this.player = this.physics.add.sprite(this.spawn.x, this.spawn.y, 'player');
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(20, 32).setOffset(2, 0);

    this.physics.world.gravity.y = TUNING.gravity;
    this.physics.world.setBounds(0, 0, this.levelWidth, this.levelHeight);

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.overlap(this.player, this.coins, this.grabCoin, null, this);
    if (this.flag) {
      this.physics.add.overlap(this.player, this.flag, this.reachFlag, null, this);
    }

    // --- камера ---------------------------------------------
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor(0x6ab7e8);

    // --- управление -----------------------------------------
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      jump:  Phaser.Input.Keyboard.KeyCodes.SPACE,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
    });

    this.lastGrounded = 0;
    this.lastJumpPress = -9999;

    // --- HUD ------------------------------------------------
    const hudStyle = { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' };
    this.hud = this.add.text(14, 12, '', hudStyle)
      .setScrollFactor(0)
      .setShadow(2, 2, '#00000088', 0);

    this.banner = this.add.text(this.scale.width / 2, this.scale.height / 2, '', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#ffffff',
      align: 'center',
      backgroundColor: '#00000099',
      padding: { x: 20, y: 14 },
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false);

    this.updateHud();
  }

  updateHud() {
    const lvl = LEVELS[this.levelIndex];
    this.hud.setText(
      `${lvl.name}   монеты ${this.coinsCollected}/${this.totalCoins}   смерти ${Save.load().totalDeaths}`
    );
  }

  grabCoin(player, coin) {
    coin.disableBody(true, true);
    this.coinsCollected++;
    this.updateHud();
  }

  reachFlag() {
    if (this.finished) return;
    this.finished = true;

    const elapsed = this.time.now - this.startedAt;
    Save.completeLevel(this.levelIndex, this.coinsCollected, elapsed);

    const secs = (elapsed / 1000).toFixed(1);
    const next = this.levelIndex + 1;

    if (next < LEVELS.length) {
      this.banner.setText(`Уровень пройден!\n${this.coinsCollected}/${this.totalCoins} монет · ${secs} с`).setVisible(true);
      this.time.delayedCall(1600, () => this.scene.restart({ levelIndex: next }));
    } else {
      this.banner.setText(
        `Уровень пройден!\n${this.coinsCollected}/${this.totalCoins} монет · ${secs} с\n\nНовые уровни — в следующем обновлении.\nR — пройти заново`
      ).setVisible(true);
    }
  }

  die() {
    Save.addDeath();
    this.scene.restart({ levelIndex: this.levelIndex });
  }

  update(time) {
    if (this.finished) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
        this.scene.restart({ levelIndex: this.levelIndex });
      }
      return;
    }

    const p = this.player;

    if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
      this.die();
      return;
    }

    // упал в пропасть
    if (p.y > this.levelHeight + 120) {
      this.die();
      return;
    }

    const left  = this.cursors.left.isDown  || this.keys.left.isDown;
    const right = this.cursors.right.isDown || this.keys.right.isDown;

    if (left) {
      p.setVelocityX(-TUNING.runSpeed);
      p.setFlipX(true);
    } else if (right) {
      p.setVelocityX(TUNING.runSpeed);
      p.setFlipX(false);
    } else {
      p.setVelocityX(0);
    }

    // --- прыжок с coyote time и буфером нажатия -------------
    const onGround = p.body.blocked.down || p.body.touching.down;
    if (onGround) this.lastGrounded = time;

    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.jump) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up);

    if (jumpPressed) this.lastJumpPress = time;

    const canJump = time - this.lastGrounded <= TUNING.coyoteMs;
    const wantsJump = time - this.lastJumpPress <= TUNING.bufferMs;

    if (canJump && wantsJump) {
      p.setVelocityY(-TUNING.jumpPower);
      this.lastGrounded = -9999;
      this.lastJumpPress = -9999;
    }

    // короткое нажатие = низкий прыжок
    const jumpHeld = this.keys.jump.isDown || this.cursors.up.isDown;
    if (!jumpHeld && p.body.velocity.y < -180) {
      p.setVelocityY(-180);
    }
  }
}
