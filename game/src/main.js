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
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
/** How far a guard's step carries, for the footstep sound and its pan. */
const HEAR_STEPS = 420;
/** Detection at which the meter turns suspicious and a tick sounds. */
const SUSPICIOUS_AT = 0.45;

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

/** A staged screenshot scene: paint it twice, then signal readiness. */
function presentShot(name) {
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
  let previousDetection = 0;

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function beginRun() {
    world.reset();
    accumulator = 0;
    previousDetection = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Three shards, then the green exit — unseen.');
  }

  function finishRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Out clean. Score ${world.state.score}.` : `Caught three times. Score ${world.state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      audio.unlock();
      beginRun();
      return;
    }
    if (actions & ACTION_CONFIRM && screen !== SCREEN_PLAY && screen !== SCREEN_PAUSED) {
      audio.unlock();
      beginRun();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused. The guards wait.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  /** Sounds and announcements for what just happened in the world. */
  function reactTo(events) {
    if (events & EVENT_FOOTSTEP) audio.footstep(world.state.player.sneaking);
    if (events & EVENT_SHARD) {
      audio.pickup();
      announce(`Shard ${world.state.shardsCollected} of 3 pocketed.`);
    }
    if (events & EVENT_SPOTTED_FLAG) {
      audio.alertSting();
      announce('Spotted! Break their sight!');
    }
    if (events & EVENT_ESCAPED_FLAG) announce('Lost them. Stay low.');
    if (events & EVENT_CAUGHT_ATTEMPT) {
      audio.caughtThud();
      const left = world.state.attemptsLeft;
      announce(`Caught! ${left} attempt${left === 1 ? '' : 's'} left. Back to the door.`);
    }
    if (events & EVENT_WIN) {
      audio.winFanfare();
      finishRun(true);
    } else if (events & EVENT_LOSE) {
      audio.caughtThud();
      finishRun(false);
    }
  }

  /** One fixed step of play: move the world, then sound the guards. */
  function advanceWorld() {
    const steering = input.steering();
    const events = world.step(STEP, steering);
    const detection = world.state.guards.detection;
    if (previousDetection <= SUSPICIOUS_AT && detection > SUSPICIOUS_AT) audio.suspicionTick();
    previousDetection = detection;
    // A guard's stride nearby is a footstep the thief can hear, panned
    // toward the guard so the ears say which side it comes from.
    for (const guard of world.state.guards.guards) {
      if (!guard.stepped) continue;
      guard.stepped = false;
      const dx = guard.x - world.state.player.x;
      const dy = guard.y - world.state.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance < HEAR_STEPS) {
        audio.guardStep(distance, Math.max(-1, Math.min(1, dx / HEAR_STEPS)));
      }
    }
    reactTo(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        advanceWorld();
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
      announce('Paused. The guards wait.');
    }
  });

  announce('Mothlight. Space or click to begin the heist.');
  requestAnimationFrame(frame);
}

if (shot) presentShot(shot);
else runGame();
