// ===========================================================
//  СОСТОЯНИЕ ЗАБЕГА
// ===========================================================
//  Жизни и накопленные косточки живут только в текущей сессии
//  и в localStorage не пишутся — как в Марио, где жизни
//  сбрасываются при выключении приставки. В save.js хранится
//  другое: какие уровни пройдены, это остаётся навсегда.
// ===========================================================

const Run = {
  LIVES_START:    3,
  BONES_PER_LIFE: 50,   // столько косточек даёт лишнюю жизнь

  lives: 3,
  banked: 0,            // счётчик до следующей лишней жизни
  bonesTotal: 0,        // всего косточек за забег
  startedAt: null,      // время старта забега
  big: false,           // подобрана ли золотая косточка

  reset() {
    this.lives = this.LIVES_START;
    this.banked = 0;
    this.bonesTotal = 0;
    this.startedAt = null;
    this.big = false;
  },

  // Таймер запускается один раз за забег. Смерть и перезапуск
  // уровня его не сбрасывают — время идёт, как в спидранах.
  beginIfNeeded() {
    if (this.startedAt === null) this.startedAt = Date.now();
  },

  elapsed() {
    return this.startedAt === null ? 0 : Date.now() - this.startedAt;
  },

  // Возвращает true, если эта косточка дала лишнюю жизнь
  addBone() {
    this.banked++;
    this.bonesTotal++;
    if (this.banked >= this.BONES_PER_LIFE) {
      this.banked -= this.BONES_PER_LIFE;
      this.lives++;
      return true;
    }
    return false;
  },

  loseLife() {
    this.lives--;
    return this.lives;
  },

  // Строка для интерфейса: до пяти — сердечки, дальше числом
  heartsLabel() {
    if (this.lives <= 0) return '—';
    if (this.lives <= 5) return '♥'.repeat(this.lives);
    return '♥ x' + this.lives;
  },
};
