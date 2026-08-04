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
  banked: 0,            // косточки, накопленные с начала забега

  reset() {
    this.lives = this.LIVES_START;
    this.banked = 0;
  },

  // Возвращает true, если эта косточка дала лишнюю жизнь
  addBone() {
    this.banked++;
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
