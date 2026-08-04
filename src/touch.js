// ===========================================================
//  УПРАВЛЕНИЕ С СЕНСОРНОГО ЭКРАНА
// ===========================================================
//  Кнопки — обычные HTML-элементы поверх канваса, а не спрайты
//  внутри игры. Так они остаются одного размера под палец,
//  независимо от того, как сильно масштабировался канвас.
//
//  Игра читает состояние из глобального объекта TouchInput.
// ===========================================================

const TouchInput = {
  left: false,
  right: false,
  jumpHeld: false,

  _jumpQueued: false,
  _restartQueued: false,

  // «нажали прыжок» срабатывает один раз на нажатие
  consumeJump() {
    const q = this._jumpQueued;
    this._jumpQueued = false;
    return q;
  },

  consumeRestart() {
    const q = this._restartQueued;
    this._restartQueued = false;
    return q;
  },
};

(function () {
  'use strict';

  const pad = document.getElementById('touch');
  if (!pad) return;

  // Показываем кнопки только там, где палец, а не мышь.
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (!coarse) return;

  document.body.classList.add('is-touch');
  pad.hidden = false;

  function bind(id, onPress, onRelease) {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      // захват указателя: отпускание придёт на эту же кнопку,
      // даже если палец уехал в сторону
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      el.classList.add('is-on');
      onPress();
    });

    function release(e) {
      el.classList.remove('is-on');
      if (onRelease) onRelease();
    }

    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);

    // на всякий случай гасим контекстное меню от долгого нажатия
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  bind('btn-left',
    function () { TouchInput.left = true; },
    function () { TouchInput.left = false; });

  bind('btn-right',
    function () { TouchInput.right = true; },
    function () { TouchInput.right = false; });

  bind('btn-jump',
    function () { TouchInput.jumpHeld = true; TouchInput._jumpQueued = true; },
    function () { TouchInput.jumpHeld = false; });

  bind('btn-restart',
    function () { TouchInput._restartQueued = true; });
})();
