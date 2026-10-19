import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const SOURCE = require('../../../assets/sounds/tesbih-click.wav');
/** Overlapping pulls need spare players so seek/play never queues behind a busy one. */
const POOL = 6;

let players: AudioPlayer[] = [];
let cursor = 0;
let preparing: Promise<void> | null = null;
let ready = false;

function ensurePlayers() {
  if (players.length > 0) return;
  players = Array.from({ length: POOL }, () => {
    const player = createAudioPlayer(SOURCE, { updateInterval: 1000 });
    player.volume = 0.78;
    player.loop = false;
    return player;
  });
}

export function prepareTesbihSound() {
  ensurePlayers();
  preparing ??= (async () => {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    }).catch(() => undefined);
    // Warm every buffer so the first pull is not cold.
    await Promise.all(
      players.map(async (player) => {
        try {
          await player.seekTo(0);
        } catch {
          // Ignore warm-up failures; play path still tries.
        }
      }),
    );
    ready = true;
  })();
  return preparing;
}

function replay(player: AudioPlayer) {
  try {
    if (player.playing) player.pause();
  } catch {
    // already stopped
  }

  let synced = false;
  try {
    player.currentTime = 0;
    synced = player.currentTime < 0.03;
  } catch {
    synced = false;
  }

  if (synced) {
    try {
      player.play();
      return;
    } catch {
      // fall through to async seek
    }
  }

  void player
    .seekTo(0)
    .then(() => {
      player.play();
    })
    .catch(() => {
      try {
        player.play();
      } catch {
        // give up quietly — next pull uses another pool slot
      }
    });
}

export function playTesbihClick() {
  ensurePlayers();
  if (!ready) void prepareTesbihSound();

  // Prefer a loaded, idle player; otherwise rotate the pool.
  let player = players.find((item) => item.isLoaded && !item.playing);
  if (!player) {
    player = players[cursor % players.length];
    cursor += 1;
  } else {
    const index = players.indexOf(player);
    cursor = (index + 1) % players.length;
  }
  if (!player) return;

  const target = player.isLoaded ? player : players.find((item) => item.isLoaded);
  if (!target) return;
  replay(target);
}

export function releaseTesbihSound() {
  players.forEach((player) => {
    try {
      player.remove();
    } catch {
      // already released
    }
  });
  players = [];
  preparing = null;
  ready = false;
  cursor = 0;
}
