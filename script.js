/**
 * NUMBER SAFARI 1000 - MINIGAME SCRIPT
 * Cambridge Maths Stage 3: Numbers up to 1000 (Estimating & Rounding)
 * Compliant with GameGenerator Platform Shadow DOM standards:
 * - Uses root.getElementById / root.querySelector
 * - game.end({ score, stars, success, maxScore, meta })
 * - Self-contained Web Audio API synthesizer
 * - Responsive pointer/touch events for PC & Tablets
 */

(() => {
  'use strict';

  // --- SAFE DOM ACCESSOR (Platform Shadow DOM vs Standalone Fallback) ---
  const getRoot = () => (typeof root !== 'undefined' && root) ? root : document;
  const $ = (id) => getRoot().getElementById(id);
  const $$ = (sel) => getRoot().querySelectorAll(sel);
  const $one = (sel) => getRoot().querySelector(sel);

  // --- AUDIO SYNTHESIZER (Pure Web Audio API - Zero External URLs) ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.bgmTimer = null;
      this.bgmStep = 0;
    }

    init() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.muted) {
        this.stopBGM();
      } else {
        this.startBGM();
      }
      return this.muted;
    }

    playTone(freq, type = 'sine', duration = 0.2, volume = 0.2, attack = 0.01) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    }

    playClick() {
      this.playTone(600, 'triangle', 0.08, 0.15, 0.005);
    }

    playCorrect() {
      if (this.muted) return;
      this.init();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.25, 0.22, 0.01), idx * 75);
      });
    }

    playIncorrect() {
      if (this.muted) return;
      this.init();
      this.playTone(220, 'sawtooth', 0.3, 0.2, 0.01);
      setTimeout(() => this.playTone(180, 'sawtooth', 0.4, 0.2, 0.01), 150);
    }

    playStar() {
      if (this.muted) return;
      this.init();
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.25, 0.01), idx * 90);
      });
    }

    playFanfare() {
      if (this.muted) return;
      this.init();
      const chord = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      chord.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.6, 0.2, 0.02), idx * 100);
      });
    }

    startBGM() {
      if (this.muted || this.bgmTimer) return;
      this.init();
      // Gentle 8-step pentatonic melody loop
      const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
      const pattern = [0, 2, 4, 3, 2, 4, 5, 4];
      
      this.bgmTimer = setInterval(() => {
        if (this.muted || !this.ctx) return;
        const note = scale[pattern[this.bgmStep % pattern.length]];
        this.playTone(note, 'sine', 0.35, 0.04, 0.05);
        this.bgmStep++;
      }, 550);
    }

    stopBGM() {
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
    }
  }

  const audio = new SoundEngine();

  // --- GAME STATE VARIABLES ---
  const state = {
    score: 0,
    lives: 3,
    maxLives: 3,
    level: 1,
    subRound: 0,
    totalQuestionsAnswered: 0,
    correctAnswersCount: 0,
    timeLeft: 45,
    timerInterval: null,
    levelTimeLimit: 45,
    comboStreak: 0,
    isTransitioning: false,
    
    // Level specific data
    l1: { currentNumber: 0, roundedLow: 0, roundedHigh: 0, correctChoice: 0 },
    l2: { currentNumber: 0, roundedLow: 0, roundedHigh: 0, correctChoice: 0 },
    l3: { targetNumber: 500, currentEstimate: 500, locked: false },
    l4: { currentNumber: 0, correctVal: 0, mode: '10' }
  };

  // --- HELPER UTILITIES ---
  const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const updateHUD = () => {
    const scoreVal = $('score-display');
    if (scoreVal) scoreVal.textContent = state.score;

    const timerText = $('timer-text');
    if (timerText) timerText.textContent = `${state.timeLeft}s`;

    const timerFill = $('timer-bar-fill');
    if (timerFill) {
      const pct = (state.timeLeft / state.levelTimeLimit) * 100;
      timerFill.style.width = `${Math.max(0, pct)}%`;
      if (pct < 25) {
        timerFill.style.background = '#ef4444';
      } else if (pct < 50) {
        timerFill.style.background = '#f59e0b';
      } else {
        timerFill.style.background = 'linear-gradient(90deg, #10b981, #f59e0b)';
      }
    }

    // Update hearts
    for (let i = 1; i <= state.maxLives; i++) {
      const heart = $(`life-${i}`);
      if (heart) {
        if (i <= state.lives) {
          heart.classList.add('active');
          heart.classList.remove('lost');
        } else {
          heart.classList.remove('active');
          heart.classList.add('lost');
        }
      }
    }
  };

  const showToast = (message, isCorrect = true) => {
    const overlay = $('feedback-overlay');
    if (!overlay) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-msg ${isCorrect ? 'toast-correct' : 'toast-incorrect'}`;
    toast.textContent = message;
    overlay.appendChild(toast);

    // Spawn mini confetti particles on correct answer
    if (isCorrect) {
      for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#38bdf8'];
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.setProperty('--dx', `${(Math.random() - 0.5) * 180}px`);
        p.style.setProperty('--dy', `${(Math.random() - 0.5) * 180}px`);
        overlay.appendChild(p);
        setTimeout(() => p.remove(), 800);
      }
    }

    setTimeout(() => {
      if (toast && toast.parentNode) toast.remove();
    }, 1000);
  };

  const switchScreen = (screenId) => {
    const screens = ['screen-start', 'screen-instructions', 'screen-gameplay', 'screen-end'];
    screens.forEach(id => {
      const el = $(id);
      if (el) {
        if (id === screenId) {
          el.style.display = (id === 'screen-instructions' || id === 'screen-end') ? 'flex' : 'block';
          el.classList.add('active');
        } else {
          el.style.display = 'none';
          el.classList.remove('active');
        }
      }
    });

    const hud = $('hud');
    if (hud) {
      hud.style.display = (screenId === 'screen-gameplay') ? 'flex' : 'none';
    }
  };

  const showLevelView = (lvlNum) => {
    for (let i = 1; i <= 4; i++) {
      const view = $(`level-${i}-view`);
      if (view) {
        view.style.display = (i === lvlNum) ? 'flex' : 'none';
      }
    }
    const badge = $('level-badge');
    if (badge) {
      const titles = [
        'Level 1: Round to 10',
        'Level 2: Round to 100',
        'Level 3: Pinpoint 0–1000',
        'Level 4: Speed Rush'
      ];
      badge.textContent = titles[lvlNum - 1] || `Level ${lvlNum}`;
    }
  };

  // --- TIMER CONTROL ---
  const startTimer = (seconds = 45, onExpire) => {
    stopTimer();
    state.timeLeft = seconds;
    state.levelTimeLimit = seconds;
    updateHUD();

    state.timerInterval = setInterval(() => {
      state.timeLeft--;
      updateHUD();
      if (state.timeLeft <= 0) {
        stopTimer();
        if (onExpire) onExpire();
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  };

  // --- LEVEL 1: ROLLERCOASTER ROUNDING (Nearest 10) ---
  const setupLevel1Question = () => {
    state.isTransitioning = false;
    // Generate a number up to 1000 that is not already a multiple of 10
    let num = getRandomInt(12, 998);
    while (num % 10 === 0) {
      num = getRandomInt(12, 998);
    }
    
    const low = Math.floor(num / 10) * 10;
    const high = low + 10;
    const unitDigit = num % 10;
    const correct = unitDigit >= 5 ? 1 : 0; // 0 = low, 1 = high

    state.l1 = { currentNumber: num, roundedLow: low, roundedHigh: high, correctChoice: correct };

    $('l1-target-val').textContent = num;
    $('l1-cart-number').textContent = num;
    $('l1-unit-digit').textContent = unitDigit;
    $('l1-left-station-text').textContent = low;
    $('l1-right-station-text').textContent = high;
    $('l1-btn-val-a').textContent = low;
    $('l1-btn-val-b').textContent = high;

    // Reset cart position to center hill peak
    const cart = $('l1-cart');
    if (cart) {
      cart.style.transition = 'transform 0.2s ease-out';
      cart.setAttribute('transform', 'translate(250, 40)');
    }
  };

  const handleLevel1Choice = (choiceIdx) => {
    if (state.isTransitioning) return;
    state.isTransitioning = true;
    audio.playClick();

    const isCorrect = (choiceIdx === state.l1.correctChoice);
    state.totalQuestionsAnswered++;

    const cart = $('l1-cart');
    if (cart) {
      cart.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
      if (choiceIdx === 0) {
        cart.setAttribute('transform', 'translate(55, 115)');
      } else {
        cart.setAttribute('transform', 'translate(445, 115)');
      }
    }

    setTimeout(() => {
      if (isCorrect) {
        audio.playCorrect();
        state.score += 100;
        state.correctAnswersCount++;
        showToast('Spot On! +100', true);
      } else {
        audio.playIncorrect();
        state.lives--;
        showToast(`Oops! ${state.l1.currentNumber} rounds to ${state.l1.correctChoice === 0 ? state.l1.roundedLow : state.l1.roundedHigh}`, false);
      }
      updateHUD();

      if (state.lives <= 0) {
        setTimeout(endGame, 1000);
        return;
      }

      state.subRound++;
      if (state.subRound >= 3) {
        setTimeout(() => advanceLevel(2), 1000);
      } else {
        setTimeout(setupLevel1Question, 800);
      }
    }, 550);
  };

  // --- LEVEL 2: ISLAND BRIDGE (Nearest 100) ---
  const setupLevel2Question = () => {
    state.isTransitioning = false;
    let num = getRandomInt(110, 990);
    while (num % 100 === 0) {
      num = getRandomInt(110, 990);
    }

    const low = Math.floor(num / 100) * 100;
    const high = low + 100;
    const tensAndUnits = num % 100;
    const correct = tensAndUnits >= 50 ? 1 : 0;

    state.l2 = { currentNumber: num, roundedLow: low, roundedHigh: high, correctChoice: correct };

    $('l2-target-val').textContent = num;
    $('l2-balloon-number').textContent = num;
    $('l2-tens-digit').textContent = tensAndUnits;
    $('l2-tower-left-text').textContent = low;
    $('l2-tower-right-text').textContent = high;
    $('l2-halfway-text').textContent = `Halfway (${low + 50})`;
    $('l2-btn-val-a').textContent = low;
    $('l2-btn-val-b').textContent = high;

    const balloon = $('l2-balloon');
    if (balloon) {
      balloon.style.transition = 'transform 0.2s ease-out';
      balloon.setAttribute('transform', 'translate(250, 45)');
    }
  };

  const handleLevel2Choice = (choiceIdx) => {
    if (state.isTransitioning) return;
    state.isTransitioning = true;
    audio.playClick();

    const isCorrect = (choiceIdx === state.l2.correctChoice);
    state.totalQuestionsAnswered++;

    const balloon = $('l2-balloon');
    if (balloon) {
      balloon.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
      if (choiceIdx === 0) {
        balloon.setAttribute('transform', 'translate(67, 50)');
      } else {
        balloon.setAttribute('transform', 'translate(432, 50)');
      }
    }

    setTimeout(() => {
      if (isCorrect) {
        audio.playCorrect();
        state.score += 120;
        state.correctAnswersCount++;
        showToast('Tower Reached! +120', true);
      } else {
        audio.playIncorrect();
        state.lives--;
        showToast(`Oops! ${state.l2.currentNumber} is closer to ${state.l2.correctChoice === 0 ? state.l2.roundedLow : state.l2.roundedHigh}`, false);
      }
      updateHUD();

      if (state.lives <= 0) {
        setTimeout(endGame, 1000);
        return;
      }

      state.subRound++;
      if (state.subRound >= 3) {
        setTimeout(() => advanceLevel(3), 1000);
      } else {
        setTimeout(setupLevel2Question, 800);
      }
    }, 650);
  };

  // --- LEVEL 3: TREASURE COMPASS (0–1000 Estimation) ---
  const setupLevel3Question = () => {
    state.isTransitioning = false;
    state.l3.locked = false;

    // Pick a distinct benchmark number up to 1000
    const num = getRandomInt(80, 920);
    state.l3.targetNumber = num;
    state.l3.currentEstimate = 500;

    $('l3-target-val').textContent = num;
    $('l3-target-callout').textContent = num;
    $('l3-actual-label').textContent = num;

    // Hide previous reveal
    const targetMarker = $('l3-target-marker');
    if (targetMarker) targetMarker.style.display = 'none';

    const precisionBox = $('l3-precision-box');
    if (precisionBox) precisionBox.style.display = 'none';

    const lockBtn = $('btn-lock-estimate');
    if (lockBtn) {
      lockBtn.disabled = false;
      lockBtn.innerHTML = '<span class="btn-icon">🎯</span> Lock in My Estimate!';
    }

    updatePinPosition(500);
  };

  const updatePinPosition = (val) => {
    val = Math.max(0, Math.min(1000, Math.round(val)));
    state.l3.currentEstimate = val;

    const pin = $('l3-pin-handle');
    const badge = $('l3-current-estimate-badge');
    const fill = $('l3-track-fill');

    const pct = (val / 1000) * 100;
    if (pin) pin.style.left = `${pct}%`;
    if (badge) badge.textContent = val;
    if (fill) fill.style.width = `${pct}%`;
  };

  const setupNumberLineTouchEvents = () => {
    const track = $('l3-track');
    if (!track) return;

    let isDragging = false;

    const calcValueFromEvent = (e) => {
      const rect = track.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const relX = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, relX / rect.width));
      return Math.round(pct * 1000);
    };

    const handleStart = (e) => {
      if (state.l3.locked || state.isTransitioning) return;
      isDragging = true;
      const val = calcValueFromEvent(e);
      updatePinPosition(val);
      audio.playTone(300 + (val * 0.5), 'sine', 0.05, 0.1);
    };

    const handleMove = (e) => {
      if (!isDragging || state.l3.locked) return;
      e.preventDefault();
      const val = calcValueFromEvent(e);
      updatePinPosition(val);
    };

    const handleEnd = () => {
      isDragging = false;
    };

    // Support both mouse and multi-touch pointer events
    track.addEventListener('pointerdown', handleStart);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
  };

  const handleLockEstimate = () => {
    if (state.l3.locked || state.isTransitioning) return;
    state.l3.locked = true;
    state.isTransitioning = true;
    audio.playClick();

    const targetVal = state.l3.targetNumber;
    const estimateVal = state.l3.currentEstimate;
    const diff = Math.abs(targetVal - estimateVal);
    state.totalQuestionsAnswered++;

    // Reveal true position marker
    const targetMarker = $('l3-target-marker');
    if (targetMarker) {
      targetMarker.style.left = `${(targetVal / 1000) * 100}%`;
      targetMarker.style.display = 'flex';
    }

    const precisionBox = $('l3-precision-box');
    const gradeEl = $('l3-precision-grade');
    const detailEl = $('l3-precision-detail');

    let pts = 0;
    let gradeMsg = '';

    if (diff <= 30) {
      pts = 200;
      gradeMsg = '🎯 BULLSEYE! Amazing Precision!';
      audio.playCorrect();
      state.correctAnswersCount++;
    } else if (diff <= 75) {
      pts = 140;
      gradeMsg = '🌟 Great Estimate!';
      audio.playCorrect();
      state.correctAnswersCount++;
    } else if (diff <= 140) {
      pts = 80;
      gradeMsg = '👍 Good Effort!';
      audio.playClick();
    } else {
      pts = 30;
      gradeMsg = '🧭 A bit far off!';
      audio.playIncorrect();
      state.lives--;
    }

    state.score += pts;
    updateHUD();

    if (precisionBox && gradeEl && detailEl) {
      gradeEl.textContent = gradeMsg;
      detailEl.textContent = `Your pin: ${estimateVal} • Actual: ${targetVal} • Difference: ${diff} (${pts > 0 ? `+${pts} pts` : '0 pts'})`;
      precisionBox.style.display = 'block';
    }

    showToast(gradeMsg, diff <= 75);

    setTimeout(() => {
      if (state.lives <= 0) {
        endGame();
        return;
      }

      state.subRound++;
      if (state.subRound >= 2) {
        advanceLevel(4);
      } else {
        setupLevel3Question();
      }
    }, 2200);
  };

  // --- LEVEL 4: SPEED ROUNDING RUSH ---
  const setupLevel4Question = () => {
    state.isTransitioning = false;
    const isRound10 = Math.random() > 0.4;
    state.l4.mode = isRound10 ? '10' : '100';

    const promptLabel = isRound10 ? 'Round to nearest 10' : 'Round to nearest 100';
    $('l4-mode-label').textContent = promptLabel;
    $('l4-prompt-text').textContent = promptLabel;

    let num = 0;
    let correct = 0;
    if (isRound10) {
      num = getRandomInt(12, 989);
      while (num % 10 === 0) num = getRandomInt(12, 989);
      correct = Math.round(num / 10) * 10;
    } else {
      num = getRandomInt(110, 990);
      while (num % 100 === 0) num = getRandomInt(110, 990);
      correct = Math.round(num / 100) * 100;
    }

    state.l4.currentNumber = num;
    state.l4.correctVal = correct;
    $('l4-target-val').textContent = num;
    $('l4-combo-text').textContent = `Streak: ${state.comboStreak}x`;

    // Generate 4 plausible distinct choices
    const choices = new Set();
    choices.add(correct);

    if (isRound10) {
      choices.add(correct - 10 > 0 ? correct - 10 : correct + 20);
      choices.add(correct + 10 <= 1000 ? correct + 10 : correct - 20);
      choices.add(Math.round(num / 100) * 100);
    } else {
      choices.add(correct - 100 > 0 ? correct - 100 : correct + 200);
      choices.add(correct + 100 <= 1000 ? correct + 100 : correct - 200);
      choices.add(Math.round(num / 10) * 10);
    }

    // Fill to 4 items if duplicates collapsed
    let offset = 5;
    while (choices.size < 4) {
      choices.add(correct + offset);
      offset += 10;
    }

    const shuffled = Array.from(choices).sort(() => Math.random() - 0.5);
    for (let i = 0; i < 4; i++) {
      const btn = $(`l4-btn-${i}`);
      if (btn) {
        btn.textContent = shuffled[i];
        btn.dataset.val = shuffled[i];
      }
    }
  };

  const handleLevel4Choice = (btnEl) => {
    if (state.isTransitioning || !btnEl) return;
    state.isTransitioning = true;
    audio.playClick();

    const selectedVal = parseInt(btnEl.dataset.val, 10);
    const isCorrect = (selectedVal === state.l4.correctVal);
    state.totalQuestionsAnswered++;

    if (isCorrect) {
      audio.playCorrect();
      state.comboStreak++;
      const bonus = state.comboStreak * 20;
      const pts = 100 + bonus;
      state.score += pts;
      state.correctAnswersCount++;
      showToast(`Speedy Match! +${pts}`, true);
    } else {
      audio.playIncorrect();
      state.comboStreak = 0;
      state.lives--;
      showToast(`Wrong! Answer was ${state.l4.correctVal}`, false);
    }

    updateHUD();

    if (state.lives <= 0) {
      setTimeout(endGame, 800);
      return;
    }

    state.subRound++;
    if (state.subRound >= 4) {
      setTimeout(endGame, 900);
    } else {
      setTimeout(setupLevel4Question, 600);
    }
  };

  // --- GAME FLOW & TRANSITIONS ---
  const advanceLevel = (nextLevel) => {
    state.level = nextLevel;
    state.subRound = 0;
    audio.playFanfare();

    showLevelView(nextLevel);

    if (nextLevel === 2) {
      startTimer(40, () => advanceLevel(3));
      setupLevel2Question();
    } else if (nextLevel === 3) {
      startTimer(45, () => advanceLevel(4));
      setupLevel3Question();
    } else if (nextLevel === 4) {
      startTimer(35, endGame);
      setupLevel4Question();
    }
  };

  const startGame = () => {
    audio.init();
    audio.startBGM();

    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.subRound = 0;
    state.totalQuestionsAnswered = 0;
    state.correctAnswersCount = 0;
    state.comboStreak = 0;

    switchScreen('screen-gameplay');
    showLevelView(1);
    startTimer(45, () => advanceLevel(2));
    setupLevel1Question();
    updateHUD();
  };

  const endGame = () => {
    stopTimer();
    audio.stopBGM();
    audio.playFanfare();

    // Calculate Stars (0 to 3)
    let stars = 0;
    if (state.score >= 1000 && state.lives >= 2) {
      stars = 3;
    } else if (state.score >= 600) {
      stars = 2;
    } else if (state.score >= 250) {
      stars = 1;
    } else {
      stars = 0;
    }

    const accuracyPct = state.totalQuestionsAnswered > 0
      ? Math.round((state.correctAnswersCount / state.totalQuestionsAnswered) * 100)
      : 0;

    // Fill end screen UI
    $('stat-final-score').textContent = state.score;
    $('stat-accuracy').textContent = `${accuracyPct}%`;
    $('stat-lives').textContent = `${state.lives} / ${state.maxLives}`;

    const rankEl = $('stat-rank');
    if (rankEl) {
      if (stars === 3) rankEl.textContent = 'Safari Master';
      else if (stars === 2) rankEl.textContent = 'Math Explorer';
      else if (stars === 1) rankEl.textContent = 'Apprentice';
      else rankEl.textContent = 'Keep Practicing!';
    }

    const labelEl = $('stars-label');
    if (labelEl) labelEl.textContent = `${stars} / 3 Stars Earned!`;

    // Render animated stars with pleasant chimes
    for (let i = 1; i <= 3; i++) {
      const starWrap = $(`star-wrap-${i}`);
      if (starWrap) {
        starWrap.classList.remove('earned');
        if (i <= stars) {
          setTimeout(() => {
            starWrap.classList.add('earned');
            audio.playStar();
          }, i * 350);
        }
      }
    }

    switchScreen('screen-end');
  };

  const submitGameResult = () => {
    audio.playClick();
    let stars = 0;
    if (state.score >= 1000 && state.lives >= 2) stars = 3;
    else if (state.score >= 600) stars = 2;
    else if (state.score >= 250) stars = 1;

    const payload = {
      score: state.score,
      stars: stars,
      success: stars > 0,
      maxScore: 1600,
      meta: {
        accuracy: state.totalQuestionsAnswered > 0 ? (state.correctAnswersCount / state.totalQuestionsAnswered) : 0,
        livesRemaining: state.lives,
        topic: 'Cambridge Maths Stage 3 - Number up to 1000'
      }
    };

    // Call platform game.end API
    if (typeof game !== 'undefined' && game.end) {
      game.end(payload);
    } else {
      console.log('[Game API Fallback] game.end called with:', payload);
      alert(`Game Submitted!\nScore: ${payload.score}\nStars: ${payload.stars}/3\nStatus: ${payload.success ? 'Passed' : 'Try Again'}`);
    }
  };

  // --- INSTRUCTION TAB SWITCHER ---
  const setupInstructionsTabs = () => {
    for (let i = 1; i <= 3; i++) {
      const tabBtn = $(`tab-btn-${i}`);
      if (tabBtn) {
        tabBtn.addEventListener('click', () => {
          audio.playClick();
          for (let j = 1; j <= 3; j++) {
            const b = $(`tab-btn-${j}`);
            const s = $(`tut-slide-${j}`);
            if (b) b.classList.toggle('active', j === i);
            if (s) {
              s.style.display = (j === i) ? 'block' : 'none';
              s.classList.toggle('active', j === i);
            }
          }
        });
      }
    }
  };

  // --- EVENT LISTENERS INITIALIZATION ---
  const bindEvents = () => {
    // Menu & Navigation Buttons
    const btnPlay = $('btn-play-game');
    if (btnPlay) btnPlay.addEventListener('click', () => { audio.playClick(); startGame(); });

    const btnHowTo = $('btn-instructions');
    if (btnHowTo) btnHowTo.addEventListener('click', () => { audio.playClick(); switchScreen('screen-instructions'); });

    const btnCloseTut = $('btn-close-instructions');
    if (btnCloseTut) btnCloseTut.addEventListener('click', () => { audio.playClick(); switchScreen('screen-start'); });

    const btnStartTut = $('btn-start-from-tut');
    if (btnStartTut) btnStartTut.addEventListener('click', () => { audio.playClick(); startGame(); });

    const btnRestartHud = $('btn-restart-hud');
    if (btnRestartHud) btnRestartHud.addEventListener('click', () => {
      audio.playClick();
      stopTimer();
      audio.stopBGM();
      switchScreen('screen-start');
    });

    const btnSound = $('btn-sound-toggle');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        const isMuted = audio.toggleMute();
        const iconOn = $('icon-sound-on');
        const iconOff = $('icon-sound-off');
        const label = $('sound-label');
        if (iconOn) iconOn.style.display = isMuted ? 'none' : 'block';
        if (iconOff) iconOff.style.display = isMuted ? 'block' : 'none';
        if (label) label.textContent = isMuted ? 'Muted' : 'Sound';
      });
    }

    // Level 1 Choice Buttons
    const l1ChoiceA = $('l1-choice-a');
    if (l1ChoiceA) l1ChoiceA.addEventListener('click', () => handleLevel1Choice(0));

    const l1ChoiceB = $('l1-choice-b');
    if (l1ChoiceB) l1ChoiceB.addEventListener('click', () => handleLevel1Choice(1));

    // Level 2 Choice Buttons
    const l2ChoiceA = $('l2-choice-a');
    if (l2ChoiceA) l2ChoiceA.addEventListener('click', () => handleLevel2Choice(0));

    const l2ChoiceB = $('l2-choice-b');
    if (l2ChoiceB) l2ChoiceB.addEventListener('click', () => handleLevel2Choice(1));

    // Level 3 Number Line Drag/Tap & Lock
    setupNumberLineTouchEvents();
    const btnLockEstimate = $('btn-lock-estimate');
    if (btnLockEstimate) btnLockEstimate.addEventListener('click', handleLockEstimate);

    // Level 4 Speed Rush Buttons
    for (let i = 0; i < 4; i++) {
      const btn = $(`l4-btn-${i}`);
      if (btn) btn.addEventListener('click', () => handleLevel4Choice(btn));
    }

    // End Screen Buttons
    const btnTryAgain = $('btn-try-again');
    if (btnTryAgain) btnTryAgain.addEventListener('click', () => { audio.playClick(); startGame(); });

    const btnSubmit = $('btn-submit-game');
    if (btnSubmit) btnSubmit.addEventListener('click', submitGameResult);

    setupInstructionsTabs();
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }

})();
