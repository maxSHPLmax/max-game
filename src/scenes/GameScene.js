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
  mercyMs:    1600,  // неуязвимость после того, как собака уменьшилась
};

// Салют из сердечек на финише. Считается отдельно от TUNING: это
// декорация, а не игровая физика, и её собственная гравитация
// сильно больше мировой, чтобы частицы успели упасть в бюджет.
const FIREWORKS = {
  countMin:     40,    // сколько сердечек разлетается, минимум
  countMax:     60,    // и максимум
  vyMin:       600,    // вертикальная скорость вылета, px/сек (меньшая по модулю)
  vyMax:       900,    // и большая по модулю — вверх, поэтому в коде со знаком минус
  vxSpread:    420,    // горизонтальная скорость: разброс от -vxSpread до +vxSpread
  gravity:    1400,    // итоговая гравитация частиц, px/сек²
  fadeDelayMs: 700,    // сколько лететь без затухания
  fadeMs:      800,    // и сколько потом гаснуть — вместе укладывается в бюджет 1.5с
};

// Габариты тела для обеих комплекций. Спрайт большой собаки
// рисуется в двойном масштабе, поэтому 64x64 против 32x32.
const SIZES = {
  small: { prefix: 'dog',    w: 22, h: 30, ox: 5, oy: 2, half: 16 },
  big:   { prefix: 'dogbig', w: 44, h: 60, ox: 10, oy: 4, half: 32 },
};

// 273500 -> '4:33.5'
function formatTime(ms) {
  const total = ms / 1000;
  const min = Math.floor(total / 60);
  const sec = total - min * 60;
  return min + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1);
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    // Забег всегда начинается с первого уровня — как в аркадах.
    // Иначе жизни и «игра окончена» теряют смысл: возврат в начало
    // ведёт туда, куда обычным путём уже не попасть.
    this.levelIndex = data && typeof data.levelIndex === 'number' ? data.levelIndex : 0;
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

    // большая собака — те же позы, но в масштабе 4
    ['stand', 'step1', 'step2', 'jump'].forEach(function (pose) {
      const big = drawPixelArt(g, composeShiba(pose), 4);
      g.generateTexture('dogbig-' + pose, big.width, big.height);
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

    // золотая косточка — крупнее обычной, чтобы бросалась в глаза
    const gold = drawPixelArt(g, SPRITES.goldbone, 3);
    g.generateTexture('goldbone', gold.width, gold.height);
    g.clear();

    // флаг
    g.fillStyle(0xdddddd).fillRect(0, 0, 4, 64);
    g.fillStyle(0x4ec9b0).fillTriangle(4, 4, 30, 14, 4, 24);
    g.generateTexture('flag', 32, 64);
    g.clear();

    // сердечко для салюта на финише
    const heart = drawPixelArt(g, SPRITES.heart, 3);
    g.generateTexture('heart', heart.width, heart.height);
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
    this.runComplete = false;

    Run.beginIfNeeded();
    this.pose = null;

    this.levelRows = rows;      // нужен для проверки края платформы
    this.dying = false;
    this.golden = null;         // ссылка с прошлого запуска сцены не нужна

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
        } else if (ch === 'G') {
          this.golden = this.physics.add.sprite(x + TILE / 2, y + TILE / 2, 'goldbone');
          this.golden.body.setAllowGravity(false).setImmovable(true);
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
    // Размер сохраняется между уровнями, как гриб в Марио.
    const size = Run.big ? SIZES.big : SIZES.small;
    this.invulnUntil = 0;

    this.player = this.physics.add.sprite(
      this.spawn.x,
      this.spawn.y - (size.half - SIZES.small.half),
      size.prefix + '-stand'
    );
    this.player.setCollideWorldBounds(false);
    this.applyBody(size);

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

    if (!this.anims.exists('dogbig-walk')) {
      this.anims.create({
        key: 'dogbig-walk',
        frames: [{ key: 'dogbig-step1' }, { key: 'dogbig-step2' }],
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
    if (this.golden) {
      this.physics.add.overlap(this.player, this.golden, this.grabGolden, null, this);
      this.tweens.add({
        targets: this.golden,
        y: this.golden.y - 6,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }

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
      `${lvl.name}   ${Run.heartsLabel()}   косточки ${this.bonesCollected}/${this.totalBones}`
    );
  }

  // --- размер собаки ---------------------------------------

  applyBody(size) {
    this.player.body.setSize(size.w, size.h).setOffset(size.ox, size.oy);
    this.texPrefix = size.prefix;
    this.pose = null;
  }

  // Спрайт растёт от центра, поэтому при смене размера собаку
  // нужно сдвинуть по вертикали — иначе ноги уедут под землю
  // или она повиснет в воздухе.
  resize(toBig) {
    const from = toBig ? SIZES.small : SIZES.big;
    const to   = toBig ? SIZES.big   : SIZES.small;

    Run.big = toBig;
    this.player.y -= (to.half - from.half);
    this.applyBody(to);
    this.player.anims.stop();
    this.player.setTexture(to.prefix + '-stand');
  }

  grabGolden(player, gold) {
    gold.disableBody(true, true);
    this.golden = null;

    this.bonesCollected++;
    Run.addBone();

    if (!Run.big) {
      this.resize(true);
      this.toast('Большая собака!');
    } else {
      this.toast('+1 косточка');
    }

    this.updateHud();
  }

  // Касание кота в большой форме: уменьшаемся и получаем
  // короткую неуязвимость, чтобы не потерять всё разом.
  shrink() {
    this.resize(false);
    this.invulnUntil = this.time.now + TUNING.mercyMs;

    this.tweens.add({
      targets: this.player,
      alpha: 0.25,
      duration: 110,
      yoyo: true,
      repeat: 6,
      onComplete: () => this.player.setAlpha(1),
    });
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
      return;
    }

    if (this.time.now < this.invulnUntil) return;   // ещё мигает после удара

    if (Run.big) {
      this.shrink();
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

    if (Run.addBone()) {
      this.toast('+1 жизнь');
    }

    this.updateHud();
  }

  // Всплывающая надпись поверх игры
  toast(text) {
    const t = this.add.text(this.scale.width / 2, 96, text, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffcc33',
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setShadow(2, 2, '#000000aa', 0);

    this.tweens.add({
      targets: t,
      y: 62,
      alpha: 0,
      duration: 1200,
      ease: 'Quad.out',
      onComplete: function () { t.destroy(); },
    });
  }

  reachFlag() {
    if (this.finished) return;
    this.finished = true;
    this.freeze();
    this.fireworks(this.flag.x, this.flag.y);

    const elapsed = this.time.now - this.startedAt;
    Save.completeLevel(this.levelIndex, this.bonesCollected, elapsed);

    const secs = (elapsed / 1000).toFixed(1);
    const next = this.levelIndex + 1;

    if (next < LEVELS.length) {
      this.banner
        .setText(`Уровень пройден!\n${this.bonesCollected}/${this.totalBones} косточек · ${secs} с`)
        .setVisible(true);
      this.time.delayedCall(1600, () => this.scene.restart({ levelIndex: next }));
    } else {
      this.finishRun();
    }
  }

  // Уровень взят: всё останавливается. Без этого собака
  // продолжает бежать вправо на старой скорости, пока висит
  // баннер, и успевает убежать за край уровня.
  freeze() {
    const p = this.player;
    p.setVelocity(0, 0);
    p.body.moves = false;
    p.anims.stop();
    p.setTexture(this.texPrefix + '-stand');

    this.enemies.getChildren().forEach(function (e) {
      e.setVelocity(0, 0);
      e.anims.stop();
    });
  }

  // Салют из сердечек в точке флага: разлетаются вверх и в
  // стороны с разбросом по скорости и углу, потом падают и
  // тают. Глубина ниже баннера и таблицы рекордов (depth 0/100),
  // чтобы не перекрывать текст. Живут физикой мира независимо
  // от update() — тот после freeze() сразу возвращается, но шаг
  // физики и твины Phaser это не останавливает.
  fireworks(x, y) {
    const count = Phaser.Math.Between(FIREWORKS.countMin, FIREWORKS.countMax);

    for (let i = 0; i < count; i++) {
      const heart = this.physics.add.sprite(x, y, 'heart');
      heart.setDepth(-1);
      heart.setScale(Phaser.Math.FloatBetween(0.6, 1.1));

      const vx = Phaser.Math.Between(-FIREWORKS.vxSpread, FIREWORKS.vxSpread);
      const vy = -Phaser.Math.Between(FIREWORKS.vyMin, FIREWORKS.vyMax);
      heart.setVelocity(vx, vy);
      heart.setAngularVelocity(Phaser.Math.Between(-180, 180));

      // body.gravity складывается с мировой (TUNING.gravity), а не
      // заменяет её — добавляем только разницу, чтобы итог был FIREWORKS.gravity.
      heart.body.setGravityY(FIREWORKS.gravity - TUNING.gravity);

      this.tweens.add({
        targets: heart,
        alpha: 0,
        delay: FIREWORKS.fadeDelayMs,
        duration: FIREWORKS.fadeMs,
        ease: 'Quad.in',
        onComplete: function () { heart.destroy(); },
      });
    }
  }

  // --- игра пройдена целиком -------------------------------

  finishRun() {
    this.runComplete = true;

    const totalMs = Run.elapsed();
    const bones = Run.bonesTotal;
    const place = Save.addRecord(totalMs, bones);

    this.showResults(totalMs, bones, place);
  }

  showResults(totalMs, bones, place) {
    const lines = [];
    lines.push('  И Г Р А   П Р О Й Д Е Н А  ');
    lines.push('');
    lines.push('время      ' + formatTime(totalMs));
    lines.push('косточек   ' + bones);
    lines.push('');
    lines.push('ЛУЧШИЕ ЗАБЕГИ');

    Save.records().forEach(function (r, i) {
      lines.push(
        (i + 1) + '.  ' + formatTime(r.timeMs) +
        '   ' + String(r.bones).padStart(3, ' ') + ' кост.' +
        (i === place ? '   <-- сейчас' : '')
      );
    });

    if (place === -1) {
      lines.push('');
      lines.push('в таблицу не попал');
    }

    lines.push('');
    lines.push('R — пройти заново');

    this.banner.setVisible(false);

    this.results = this.add.text(
      this.scale.width / 2, this.scale.height / 2, lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#ffffff',
        align: 'left',
        backgroundColor: '#0f0f1bee',
        padding: { x: 26, y: 20 },
        lineSpacing: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
  }

  die() {
    // finished — страховка: уровень уже взят, отнимать жизнь не за что
    if (this.dying || this.finished) return;
    this.dying = true;
    Save.addDeath();

    // Полёт как в Марио: собака подпрыгивает и проваливается
    // сквозь платформы вниз.
    const p = this.player;
    p.body.checkCollision.none = true;
    p.setVelocity(0, -330);
    p.anims.stop();
    p.setTexture(this.texPrefix + '-jump');

    Run.big = false;          // при гибели усиление теряется
    const left = Run.loseLife();
    const self = this;

    if (left > 0) {
      this.banner.setText('Осталось жизней: ' + left).setVisible(true);
      this.time.delayedCall(1200, function () {
        self.scene.restart({ levelIndex: self.levelIndex });
      });
    } else {
      this.banner
        .setText('ИГРА ОКОНЧЕНА\n\nНачинаем с первого уровня')
        .setVisible(true);
      this.time.delayedCall(2600, function () {
        Run.reset();
        self.scene.restart({ levelIndex: 0 });
      });
    }
  }

  update(time) {
    // рестарт: клавиша R или экранная кнопка (читаем один раз за кадр)
    const restartPressed =
      Phaser.Input.Keyboard.JustDown(this.keys.restart) ||
      TouchInput.consumeRestart();

    if (this.dying) return;   // собака падает, ввод не принимаем

    if (this.finished) {
      if (restartPressed) {
        if (this.runComplete) {
          Run.reset();                                  // новый забег: жизни, косточки, таймер
          this.scene.restart({ levelIndex: 0 });
        } else {
          this.scene.restart({ levelIndex: this.levelIndex });
        }
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
        p.anims.play(this.texPrefix + '-walk', true);
      } else {
        p.anims.stop();
        p.setTexture(this.texPrefix + '-' + pose);
      }
    }
  }
}
