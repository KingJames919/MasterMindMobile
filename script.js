(function () {
  'use strict';

  var CODE_LENGTH = 4;
  var MAX_GUESSES = 10;
  var LEADERBOARD_KEY = 'mastermind_leaderboard';
  var PLAYER_NAME_KEY = 'signal-array-player-name';
  var COLORS = [
    { id: 'amber', label: 'Amber' },
    { id: 'crimson', label: 'Crimson' },
    { id: 'cyan', label: 'Cyan' },
    { id: 'ivory', label: 'Ivory' },
    { id: 'jade', label: 'Jade' },
    { id: 'violet', label: 'Violet' }
  ];

  var state = {
    secret: [],
    guesses: [],
    draft: [null, null, null, null],
    cursor: 0,
    selectedColor: COLORS[0].id,
    status: 'active',
    playerName: loadPlayerName(),
    leaderboard: getLeaderboard()
  };

  var elements = {
    playerNameInput: document.getElementById('player-name-input'),
    playerPill: document.getElementById('player-pill'),
    palette: document.getElementById('palette'),
    currentGuessRow: document.getElementById('current-guess-row'),
    historyBoard: document.getElementById('history-board'),
    leaderboardList: document.getElementById('leaderboard-list'),
    submitGuessButton: document.getElementById('submit-guess-button'),
    clearRowButton: document.getElementById('clear-row-button'),
    newGameButton: document.getElementById('new-game-button'),
    resetLeaderboardButton: document.getElementById('reset-leaderboard-button'),
    statusChip: document.getElementById('status-chip'),
    statusTitle: document.getElementById('status-title'),
    exactCount: document.getElementById('exact-count'),
    partialCount: document.getElementById('partial-count'),
    remainingCount: document.getElementById('remaining-count'),
    revealPanel: document.getElementById('reveal-panel'),
    revealLabel: document.getElementById('reveal-label'),
    revealRow: document.getElementById('reveal-row')
  };

  function createRandomCode() {
    var result = [];
    for (var i = 0; i < CODE_LENGTH; i += 1) {
      result.push(COLORS[Math.floor(Math.random() * COLORS.length)].id);
    }
    return result;
  }

  function createEmptyDraft() {
    return [null, null, null, null];
  }

  function loadPlayerName() {
    try {
      var name = window.localStorage.getItem(PLAYER_NAME_KEY);
      return sanitizePlayerName(name || 'Agent');
    } catch (error) {
      return 'Agent';
    }
  }

  function savePlayerName() {
    window.localStorage.setItem(PLAYER_NAME_KEY, state.playerName);
  }

  function getLeaderboard() {
    try {
      return JSON.parse(window.localStorage.getItem(LEADERBOARD_KEY) || '[]');
    } catch (error) {
      return [];
    }
  }

  function saveLeaderboard(data) {
    window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(data));
  }

  function sanitizePlayerName(value) {
    var clean = (value || '').replace(/\s+/g, ' ').trim();
    return clean.slice(0, 18) || 'Agent';
  }

  function draftIsComplete() {
    for (var i = 0; i < CODE_LENGTH; i += 1) {
      if (!state.draft[i]) {
        return false;
      }
    }
    return true;
  }

  function remainingGuesses() {
    return MAX_GUESSES - state.guesses.length;
  }

  function colorLabel(colorId) {
    for (var i = 0; i < COLORS.length; i += 1) {
      if (COLORS[i].id === colorId) {
        return COLORS[i].label;
      }
    }
    return colorId;
  }

  function scoreGuess(secret, guess) {
    var exact = 0;
    var secretCounts = {};
    var guessCounts = {};

    for (var i = 0; i < CODE_LENGTH; i += 1) {
      if (secret[i] === guess[i]) {
        exact += 1;
      } else {
        secretCounts[secret[i]] = (secretCounts[secret[i]] || 0) + 1;
        guessCounts[guess[i]] = (guessCounts[guess[i]] || 0) + 1;
      }
    }

    var partial = 0;
    for (var color in guessCounts) {
      if (Object.prototype.hasOwnProperty.call(guessCounts, color)) {
        partial += Math.min(guessCounts[color], secretCounts[color] || 0);
      }
    }

    return { exact: exact, partial: partial };
  }

  function runScoringSelfCheck() {
    var tests = [
      {
        secret: ['amber', 'crimson', 'cyan', 'ivory'],
        guess: ['amber', 'crimson', 'cyan', 'ivory'],
        expected: { exact: 4, partial: 0 }
      },
      {
        secret: ['amber', 'crimson', 'cyan', 'ivory'],
        guess: ['ivory', 'amber', 'crimson', 'cyan'],
        expected: { exact: 0, partial: 4 }
      },
      {
        secret: ['amber', 'amber', 'cyan', 'ivory'],
        guess: ['amber', 'jade', 'amber', 'amber'],
        expected: { exact: 1, partial: 1 }
      },
      {
        secret: ['jade', 'jade', 'crimson', 'crimson'],
        guess: ['crimson', 'jade', 'jade', 'ivory'],
        expected: { exact: 1, partial: 2 }
      },
      {
        secret: ['violet', 'cyan', 'violet', 'amber'],
        guess: ['violet', 'violet', 'cyan', 'violet'],
        expected: { exact: 1, partial: 2 }
      }
    ];

    for (var i = 0; i < tests.length; i += 1) {
      var actual = scoreGuess(tests[i].secret, tests[i].guess);
      if (actual.exact !== tests[i].expected.exact || actual.partial !== tests[i].expected.partial) {
        throw new Error('Scoring self-check failed on test ' + (i + 1));
      }
    }
  }

  function createPeg(colorId, extraClass) {
    var peg = document.createElement('span');
    peg.className = 'peg ' + (colorId || 'empty') + (extraClass ? ' ' + extraClass : '');
    peg.setAttribute('aria-hidden', 'true');
    return peg;
  }

  function renderPalette() {
    elements.palette.innerHTML = '';

    COLORS.forEach(function (color, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'palette-button' + (state.selectedColor === color.id ? ' active' : '');
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(state.selectedColor === color.id));
      button.setAttribute('aria-label', 'Choose ' + color.label + ' (' + (index + 1) + ')');
      button.appendChild(createPeg(color.id));

      var number = document.createElement('span');
      number.textContent = String(index + 1);
      button.appendChild(number);

      button.addEventListener('click', function () {
        state.selectedColor = color.id;
        placeSelectedColor();
      });

      elements.palette.appendChild(button);
    });
  }

  function renderCurrentGuess() {
    elements.currentGuessRow.innerHTML = '';

    for (var i = 0; i < CODE_LENGTH; i += 1) {
      var slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'slot' + (state.cursor === i ? ' slot-active' : '');
      slot.dataset.index = String(i);
      slot.setAttribute(
        'aria-label',
        'Guess slot ' +
          (i + 1) +
          (state.draft[i] ? ', ' + colorLabel(state.draft[i]) : ', empty')
      );

      slot.appendChild(createPeg(state.draft[i]));

      var label = document.createElement('span');
      label.textContent = String(i + 1);
      slot.appendChild(label);

      slot.addEventListener('click', function (event) {
        var index = Number(event.currentTarget.dataset.index);
        state.cursor = index;
        render();
      });

      elements.currentGuessRow.appendChild(slot);
    }
  }

  function renderHistory() {
    elements.historyBoard.innerHTML = '';

    for (var i = 0; i < MAX_GUESSES; i += 1) {
      var row = document.createElement('div');
      row.className = 'history-row';
      row.setAttribute('role', 'row');

      var index = document.createElement('div');
      index.className = 'history-index';
      index.setAttribute('role', 'cell');
      index.textContent = String(i + 1).padStart(2, '0');
      row.appendChild(index);

      var pegGroup = document.createElement('div');
      pegGroup.className = 'history-pegs';
      pegGroup.setAttribute('role', 'cell');

      var guess = state.guesses[i];
      for (var j = 0; j < CODE_LENGTH; j += 1) {
        pegGroup.appendChild(createPeg(guess ? guess.colors[j] : null));
      }
      row.appendChild(pegGroup);

      var feedback = document.createElement('div');
      feedback.className = 'history-feedback';
      feedback.setAttribute('role', 'cell');

      var exact = document.createElement('span');
      var partial = document.createElement('span');
      exact.textContent = guess ? guess.feedback.exact + ' exact' : ' ';
      partial.textContent = guess ? guess.feedback.partial + ' partial' : ' ';
      feedback.appendChild(exact);
      feedback.appendChild(partial);
      row.appendChild(feedback);

      elements.historyBoard.appendChild(row);
    }
  }

  function sortLeaderboard(entries) {
    return entries.slice().sort(function (left, right) {
      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      var leftBest = left.best === null || typeof left.best === 'undefined' ? 99 : left.best;
      var rightBest = right.best === null || typeof right.best === 'undefined' ? 99 : right.best;
      if (leftBest !== rightBest) {
        return leftBest - rightBest;
      }

      var leftRate = left.games ? left.wins / left.games : 0;
      var rightRate = right.games ? right.wins / right.games : 0;
      if (rightRate !== leftRate) {
        return rightRate - leftRate;
      }

      return left.name.localeCompare(right.name);
    });
  }

  function renderLeaderboard() {
    elements.leaderboardList.innerHTML = '';

    var ranked = sortLeaderboard(getLeaderboard());
    if (!ranked.length) {
      var empty = document.createElement('div');
      empty.className = 'leaderboard-empty';
      empty.textContent = 'No results yet.';
      elements.leaderboardList.appendChild(empty);
      return;
    }

    ranked.forEach(function (entry, index) {
      var row = document.createElement('div');
      row.className = 'leaderboard-row';

      var rank = document.createElement('span');
      rank.className = 'leaderboard-rank';
      rank.textContent = String(index + 1);
      row.appendChild(rank);

      var name = document.createElement('span');
      name.className = 'leaderboard-name';
      name.title = entry.name;
      name.textContent = entry.name;
      row.appendChild(name);

      var wins = document.createElement('span');
      wins.className = 'leaderboard-num';
      wins.textContent = String(entry.wins);
      row.appendChild(wins);

      var games = document.createElement('span');
      games.className = 'leaderboard-num';
      games.textContent = String(entry.games);
      row.appendChild(games);

      var best = document.createElement('span');
      best.className = 'leaderboard-best';
      best.textContent = entry.best === null ? '-' : String(entry.best);
      row.appendChild(best);

      elements.leaderboardList.appendChild(row);
    });
  }

  function renderReveal() {
    elements.revealRow.innerHTML = '';

    if (state.status === 'active') {
      elements.revealPanel.className = 'reveal-panel hidden';
      return;
    }

    elements.revealPanel.className =
      'reveal-panel ' + (state.status === 'won' ? 'success' : 'failure');
    elements.revealLabel.textContent = state.status === 'won' ? 'Solved Code' : 'Hidden Code';

    for (var i = 0; i < state.secret.length; i += 1) {
      var peg = createPeg(state.secret[i], 'reveal-peg');
      peg.style.animationDelay = i * 90 + 'ms';
      elements.revealRow.appendChild(peg);
    }
  }

  function renderStatus() {
    var lastGuess = state.guesses[state.guesses.length - 1];

    elements.playerPill.textContent = 'Player: ' + state.playerName;
    elements.exactCount.textContent = lastGuess ? String(lastGuess.feedback.exact) : '0';
    elements.partialCount.textContent = lastGuess ? String(lastGuess.feedback.partial) : '0';
    elements.remainingCount.textContent = String(remainingGuesses());

    if (state.status === 'won') {
      elements.statusChip.textContent = 'Win';
      elements.statusTitle.textContent = 'Solved';
    } else if (state.status === 'lost') {
      elements.statusChip.textContent = 'Loss';
      elements.statusTitle.textContent = 'Locked';
    } else {
      elements.statusChip.textContent = 'Active';
      elements.statusTitle.textContent = 'Live';
    }

    elements.submitGuessButton.disabled = !draftIsComplete() || state.status !== 'active';
    elements.clearRowButton.disabled = state.status !== 'active';
    renderReveal();
  }

  function render() {
    elements.playerNameInput.value = state.playerName;
    renderPalette();
    renderCurrentGuess();
    renderHistory();
    renderStatus();
    renderLeaderboard();
    window.render_game_to_text = renderGameToText;
    window.advanceTime = function () {};
  }

  function updateLeaderboard(playerName, won, guessesUsed) {
    if (!playerName) {
      playerName = 'Player';
    }

    var data = getLeaderboard();
    var player = data.find(function (entry) {
      return entry.name === playerName;
    });

    if (!player) {
      player = { name: playerName, wins: 0, games: 0, best: null };
      data.push(player);
    }

    player.games += 1;

    if (won) {
      player.wins += 1;
      if (player.best === null || guessesUsed < player.best) {
        player.best = guessesUsed;
      }
    }

    saveLeaderboard(data);
    state.leaderboard = data;
  }

  function syncPlayerName() {
    state.playerName = sanitizePlayerName(elements.playerNameInput.value);
    elements.playerNameInput.value = state.playerName;
    savePlayerName();
  }

  function newGame() {
    syncPlayerName();
    state.secret = createRandomCode();
    state.guesses = [];
    state.draft = createEmptyDraft();
    state.cursor = 0;
    state.selectedColor = COLORS[0].id;
    state.status = 'active';
    render();
  }

  function placeSelectedColor() {
    if (state.status !== 'active') {
      render();
      return;
    }

    state.draft[state.cursor] = state.selectedColor;
    if (state.cursor < CODE_LENGTH - 1) {
      state.cursor += 1;
    }
    render();
  }

  function clearActiveSlot() {
    if (state.status !== 'active') {
      return;
    }

    state.draft[state.cursor] = null;
    render();
  }

  function clearRow() {
    if (state.status !== 'active') {
      return;
    }

    state.draft = createEmptyDraft();
    state.cursor = 0;
    render();
  }

  function submitGuess() {
    if (state.status !== 'active' || !draftIsComplete()) {
      return;
    }

    syncPlayerName();

    var guess = state.draft.slice();
    var feedback = scoreGuess(state.secret, guess);

    state.guesses.push({
      colors: guess,
      feedback: feedback
    });

    if (feedback.exact === CODE_LENGTH) {
      state.status = 'won';
      updateLeaderboard(state.playerName, true, state.guesses.length);
    } else if (state.guesses.length >= MAX_GUESSES) {
      state.status = 'lost';
      updateLeaderboard(state.playerName, false, state.guesses.length);
    }

    state.draft = createEmptyDraft();
    state.cursor = 0;
    render();
  }

  function resetLeaderboard() {
    window.localStorage.removeItem(LEADERBOARD_KEY);
    state.leaderboard = [];
    renderLeaderboard();
  }

  function renderGameToText() {
    return JSON.stringify({
      title: 'MasterMind',
      status: state.status,
      playerName: state.playerName,
      selectedColor: state.selectedColor,
      cursor: state.cursor + 1,
      draft: state.draft,
      remainingGuesses: remainingGuesses(),
      guesses: state.guesses,
      revealedCode: state.status === 'active' ? null : state.secret,
      leaderboard: sortLeaderboard(getLeaderboard()),
      controls: {
        selectColor: '1-6',
        moveCursor: 'ArrowLeft ArrowRight',
        placeColor: 'Enter Space click',
        clearSlot: 'Backspace Delete',
        submit: 'S',
        newGame: 'N'
      }
    });
  }

  function bindEvents() {
    elements.playerNameInput.addEventListener('input', function () {
      state.playerName = sanitizePlayerName(elements.playerNameInput.value);
      elements.playerPill.textContent = 'Player: ' + state.playerName;
    });
    elements.playerNameInput.addEventListener('change', function () {
      syncPlayerName();
      renderStatus();
    });
    elements.playerNameInput.addEventListener('blur', function () {
      syncPlayerName();
      renderStatus();
    });
    elements.submitGuessButton.addEventListener('click', submitGuess);
    elements.clearRowButton.addEventListener('click', clearRow);
    elements.newGameButton.addEventListener('click', newGame);
    elements.resetLeaderboardButton.addEventListener('click', resetLeaderboard);

    window.addEventListener('keydown', function (event) {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      var activeTag = document.activeElement && document.activeElement.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
        return;
      }

      var digit = Number(event.key);
      if (digit >= 1 && digit <= COLORS.length) {
        state.selectedColor = COLORS[digit - 1].id;
        render();
        event.preventDefault();
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          state.cursor = (state.cursor + CODE_LENGTH - 1) % CODE_LENGTH;
          render();
          event.preventDefault();
          break;
        case 'ArrowRight':
          state.cursor = (state.cursor + 1) % CODE_LENGTH;
          render();
          event.preventDefault();
          break;
        case 'Enter':
        case ' ':
          placeSelectedColor();
          event.preventDefault();
          break;
        case 'Backspace':
        case 'Delete':
          clearActiveSlot();
          event.preventDefault();
          break;
        case 's':
        case 'S':
          submitGuess();
          event.preventDefault();
          break;
        case 'n':
        case 'N':
          newGame();
          event.preventDefault();
          break;
      }
    });
  }

  runScoringSelfCheck();
  bindEvents();
  renderLeaderboard();
  newGame();
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js');
  });
}
