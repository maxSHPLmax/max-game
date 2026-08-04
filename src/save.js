// ===========================================================
//  СОХРАНЕНИЕ ПРОГРЕССА
// ===========================================================
//  Всё живёт в localStorage браузера — бэкенд не нужен.
//  Прогресс привязан к одному браузеру на одном устройстве.
// ===========================================================

const Save = {
  KEY: 'maxgame.save.v1',

  _data: null,

  _blank() {
    return { levels: {}, totalDeaths: 0 };
  },

  load() {
    if (this._data) return this._data;
    try {
      const raw = localStorage.getItem(this.KEY);
      this._data = raw ? JSON.parse(raw) : this._blank();
    } catch (e) {
      console.warn('Не удалось прочитать сохранение, начинаем с нуля', e);
      this._data = this._blank();
    }
    if (!this._data.levels) this._data.levels = {};
    return this._data;
  },

  _write() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this._data));
    } catch (e) {
      console.warn('Не удалось записать сохранение', e);
    }
  },

  // Статистика по одному уровню
  level(index) {
    const d = this.load();
    if (!d.levels[index]) {
      d.levels[index] = { completed: false, bestCoins: 0, bestTime: null };
    }
    return d.levels[index];
  },

  completeLevel(index, coins, timeMs) {
    const lvl = this.level(index);
    lvl.completed = true;
    lvl.bestCoins = Math.max(lvl.bestCoins, coins);
    if (lvl.bestTime === null || timeMs < lvl.bestTime) lvl.bestTime = timeMs;
    this._write();
  },

  addDeath() {
    const d = this.load();
    d.totalDeaths = (d.totalDeaths || 0) + 1;
    this._write();
  },

  reset() {
    this._data = this._blank();
    this._write();
  },
};
