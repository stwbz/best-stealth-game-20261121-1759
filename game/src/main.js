// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens:
// title, play, paused, win and game over (caught three times).
//
// ?seed=N fixes the game. ?shot=start|play|alert|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT_ATTEMPT, EVENT_ESCAPED_FLAG, EVENT_FOOTSTEP, EVENT_LOSE, EVENT_SHARD, EVENT_SPOTTED_FLAG, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.guards, scene.screen, scene.best, world.exitOpen());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal 3 lantern shards, then reach the green exit.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Escaped unseen. Score ${world.state.score}.` : `Caught. Score ${world.state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      audio.unlock();
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen !== SCREEN_PLAY && screen !== SCREEN_PAUSED) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function react(events) {
    if (events & EVENT_FOOTSTEP) audio.footstep(world.state.player.sneaking);
    if (events & EVENT_SHARD) {
      audio.pickup();
      announce(`Shard ${world.state.shardsCollected} of 3.`);
    }
    if (events & EVENT_SPOTTED_FLAG) {
      audio.alertSting();
      announce('Spotted! Break their sight!');
    }
    if (events & EVENT_ESCAPED_FLAG) announce('Lost them. Stay low.');
    if (events & EVENT_CAUGHT_ATTEMPT) {
      audio.caughtThud();
      announce(`Caught! ${world.state.attemptsLeft} attempt${world.state.attemptsLeft === 1 ? '' : 's'} left. Back to the door.`);
    }
    if (events & EVENT_WIN) {
      audio.winFanfare();
      endGame(true);
    } else if (events & EVENT_LOSE) {
      audio.caughtThud();
      endGame(false);
    }
  }

  function step() {
    const steering = input.steering();
    const events = world.step(STEP, steering);
    // A guard's stride nearby is a footstep the player can hear.
    for (const guard of world.state.guards.guards) {
      if (guard.stepped) {
        guard.stepped = false;
        const distance = Math.hypot(guard.x - world.state.player.x, guard.y - world.state.player.y);
        if (distance < 420) audio.guardStep(distance);
      }
    }
    react(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, world.guards, screen, best, world.exitOpen());
  }

  // Leaving the tab pauses a running game rather than letting guards hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Mothlight. Press Space or click to begin the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
