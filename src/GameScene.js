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

  enemySpeed:  65,   // скорость патрулирования кота
  stompBounce: 380,  // отскок после прыжка на врага
};

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    if (data && typeof data.levelIndex === 'number') {
      this.levelIndex = data.levelIndex;
      return;
    }

    // Заход с нуля: начинаем с первого непройденного уровня,
    // чтобы не заставлять переигрывать то, что уже сделано.
    let idx = 0;
    while (idx < LEVELS.length - 1 && Save.level(idx).completed) idx++;
    this.levelIndex = idx;
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

    // сиба-ину: четыре позы из src/sprites.js
    ['stand', 'step1', 'step2', 'jump'].forEach(function (pose) {
      const dog = drawPixelArt(g, composeShiba(pose), 2);
      g.generateTexture('dog-' + pose, dog.width, dog.height);
      g.clear();
    });

    // кот-противник: две позы шага
    ['step1', 'step2'].forEach(function (pose) {
      const cat = drawPixelArt(g, composeCat(pose), 2);
      g.generateTexture('cat-' + pose, cat.width, cat.height);
      g.clear();
    });

    // косточка
    const bone = drawPixelArt(g, SPRITES.bone, 2);
    g.generateTexture('bone', bone.width, bone.height);
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

    this.bonesCollected = 0;
    this.startedAt = this.time.now;
    this.finished = false;
    this.pose = null;

    this.levelRows = rows;      // нужен для проверки края платформы
    this.dying = false;

    this.solids = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();
    this.bones  = this.physics.add.group({ allowGravity: false, immovable: true });

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
          this.bones.create(x + TILE / 2, y + TILE / 2, 'bone');
        } else if (ch === 'E') {
          this.spawnEnemy(x + TILE / 2, y + TILE / 2);
        } else if (ch === 'P') {
          this.spawn = { x: x + TILE / 2, y: y + TILE / 2 };
        } else if (ch === 'F') {
          this.flag = this.physics.add.staticSprite(x + TILE / 2, y, 'flag');
        }
      }
    }

    this.totalBones = this.bones.getChildren().length;

    // косточки слегка покачиваются
    this.tweens.add({
      targets: this.bones.getChildren(),
      y: '-=5',
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // --- игрок ----------------------------------------------
    this.player = this.physics.add.sprite(this.spawn.x, this.spawn.y, 'dog-stand');
    this.player.setCollideWorldBounds(false);
    this.player.body.setSize(22, 30).setOffset(5, 2);

    // анимация ходьбы регистрируется один раз на всю игру,
    // а create() выполняется заново при каждом рестарте уровня
    if (!this.anims.exists('dog-walk')) {
      this.anims.create({
        key: 'dog-walk',
        frames: [{ key: 'dog-step1' }, { key: 'dog-step2' }],
        frameRate: 9,
        repeat: -1,
      });
    }

    if (!this.anims.exists('cat-walk')) {
      this.anims.create({
        key: 'cat-walk',
        frames: [{ key: 'cat-step1' }, { key: 'cat-step2' }],
        frameRate: 6,
        repeat: -1,
      });
    }

    this.enemies.getChildren().forEach(function (e) {
      e.play('cat-walk');
    });

    this.physics.world.gravity.y = TUNING.gravity;
    this.physics.world.setBounds(0, 0, this.levelWidth, this.levelHeight);

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.overlap(this.player, this.bones, this.grabBone, null, this);
    this.physics.add.collider(this.enemies, this.solids);
    this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
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
      `${lvl.name}   косточки ${this.bonesCollected}/${this.totalBones}   смерти ${Save.load().totalDeaths}`
    );
  }

  // --- враги -----------------------------------------------

  spawnEnemy(x, y) {
    const e = this.enemies.create(x, y, 'cat-step1');
    e.body.setSize(24, 24).setOffset(4, 8);
    e.setData('dir', -1);
    e.setData('dead', false);
    return e;
  }

  // Есть ли опора под точкой чуть впереди врага?
  // Проверяем не физикой, а самой картой уровня — так надёжнее
  // и не нужны невидимые сенсоры.
  groundAhead(e) {
    const dir = e.getData('dir');
    const px = dir < 0 ? e.body.left - 4 : e.body.right + 4;
    const py = e.body.bottom + 6;

    const c = Math.floor(px / TILE);
    const r = Math.floor(py / TILE);

    if (r < 0 || r >= this.levelRows.length) return false;
    const line = this.levelRows[r];
    if (c < 0 || c >= line.length) return false;

    const ch = line[c];
    return ch === '#' || ch === '=';
  }

  patrol() {
    const self = this;
    this.enemies.getChildren().forEach(function (e) {
      if (e.getData('dead')) return;

      let dir = e.getData('dir');

      // разворот у стены или на краю площадки
      if (e.body.blocked.left) dir = 1;
      else if (e.body.blocked.right) dir = -1;
      else if (e.body.blocked.down && !self.groundAhead(e)) dir = -dir;

      e.setData('dir', dir);
      e.setVelocityX(TUNING.enemySpeed * dir);
      e.setFlipX(dir > 0);
    });
  }

  hitEnemy(player, enemy) {
    if (this.finished || this.dying || enemy.getData('dead')) return;

    // Прыгнул сверху или налетел сбоку? Смотрим на две вещи:
    // собака должна падать вниз и находиться выше кота.
    const falling = player.body.velocity.y > 0;
    const fromAbove = player.body.bottom - enemy.body.top < 20;

    if (falling && fromAbove) {
      this.squash(enemy);
      player.setVelocityY(-TUNING.stompBounce);
    } else {
      this.die();
    }
  }

  squash(enemy) {
    enemy.setData('dead', true);
    enemy.body.enable = false;
    enemy.anims.stop();
    enemy.setTexture('cat-step1');

    this.tweens.add({
      targets: enemy,
      scaleY: 0.25,
      y: enemy.y + 10,
      alpha: 0,
      duration: 220,
      ease: 'Quad.out',
      onComplete: function () { enemy.destroy(); },
    });
  }

  grabBone(player, bone) {
    bone.disableBody(true, true);
    this.bonesCollected++;
    this.updateHud();
  }

  reachFlag() {
    if (this.finished) return;
    this.finished = true;

    const elapsed = this.time.now - this.startedAt;
    Save.completeLevel(this.levelIndex, this.bonesCollected, elapsed);

    const secs = (elapsed / 1000).toFixed(1);
    const next = this.levelIndex + 1;

    if (next < LEVELS.length) {
      this.banner.setText(`Уровень пройден!\n${this.bonesCollected}/${this.totalBones} косточек · ${secs} с`).setVisible(true);
      this.time.delayedCall(1600, () => this.scene.restart({ levelIndex: next }));
    } else {
      this.banner.setText(
        `Уровень пройден!\n${this.bonesCollected}/${this.totalBones} косточек · ${secs} с\n\nНовые уровни — в следующем обновлении.\nR — пройти заново`
      ).setVisible(true);
    }
  }

  die() {
    if (this.dying) return;
    this.dying = true;
    Save.addDeath();
    this.scene.restart({ levelIndex: this.levelIndex });
  }

  update(time) {
    // рестарт: клавиша R или экранная кнопка (читаем один раз за кадр)
    const restartPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.restart) ||
      TouchInput.consumeRestart();

    if (this.finished) {
      if (restartPressed) {
        this.scene.restart({ levelIndex: this.levelIndex });
      }
      return;
    }

    this.patrol();

    const p = this.player;

    if (restartPressed) {
      this.die();
      return;
    }

    // упал в пропасть
    if (p.y > this.levelHeight + 120) {
      this.die();
      return;
    }

    const left  = this.cursors.left.isDown  || this.keys.left.isDown  || TouchInput.left;
    const right = this.cursors.right.isDown || this.keys.right.isDown || TouchInput.right;

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
      Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      TouchInput.consumeJump();

    if (jumpPressed) this.lastJumpPress = time;

    const canJump = time - this.lastGrounded <= TUNING.coyoteMs;
    const wantsJump = time - this.lastJumpPress <= TUNING.bufferMs;

    if (canJump && wantsJump) {
      p.setVelocityY(-TUNING.jumpPower);
      this.lastGrounded = -9999;
      this.lastJumpPress = -9999;
    }

    // короткое нажатие = низкий прыжок
    const jumpHeld = this.keys.jump.isDown || this.cursors.up.isDown || TouchInput.jumpHeld;
    if (!jumpHeld && p.body.velocity.y < -180) {
      p.setVelocityY(-180);
    }

    // --- поза собаки ----------------------------------------
    const pose = !onGround ? 'jump' : (left || right) ? 'walk' : 'stand';

    if (pose !== this.pose) {
      this.pose = pose;
      if (pose === 'walk') {
        p.anims.play('dog-walk', true);
      } else {
        p.anims.stop();
        p.setTexture('dog-' + pose);
      }
    }
  }
}
