/* soundscape.js - the Lock-In Room's soundscape: real lofi radio (Lofi Girl, Chillhop) and real
   recordings of cozy places (rain on a window, a coffee shop, a fireplace...), streamed from
   YouTube. Pick a music vibe and a place, mix their volumes, and they play whenever you lock in.
   The video can also fill the room behind the timer. Your picks are saved (and synced).
   Brown noise is generated on the device, so it also works offline.
   Needs shared.js and data.js; listens to focus.js through the body's "running" class. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  if (!$("soundscape")) return;

  const KEY = "plannerSoundscape";
  // Each option lists a few videos: if one is ever taken down, the next one plays instead.
  const MUSIC = [
    { id: "lofi", emoji: "📚", name: "Lofi beats", sub: "Lofi Girl radio", videos: ["jfKfPfyJRdk", "7NOSDKb0HlU"] },
    { id: "jazz", emoji: "🎷", name: "Jazzy lofi", sub: "Warm, mellow jazz", videos: ["HuFYqnbVbzY", "5yx6BWlEVcY"] },
    { id: "piano", emoji: "🎹", name: "Peaceful piano", sub: "Soft and calm", videos: ["4oStw0r33so"] },
    { id: "asian", emoji: "⛩️", name: "Asian lofi", sub: "Koto, flutes and beats", videos: ["Na0w3Mz46GA"] },
    { id: "synth", emoji: "🌌", name: "Synthwave", sub: "Retro, upbeat", videos: ["4xDzrJKXOOY"] },
    { id: "sleepy", emoji: "💤", name: "Sleepy lofi", sub: "Slow, late-night", videos: ["28KRPhVzCus", "rUxyKA_-grg", "DWcJFNfaw9c"] },
    { id: "dark", emoji: "🌃", name: "Dark ambient", sub: "Deep and spacey", videos: ["S_MOd40zlYU"] },
  ];
  const PLACES = [
    { id: "rain", emoji: "🌧️", name: "Rain on the window", videos: ["K4yr3avr5tQ", "fN5BSR6pRas"] },
    { id: "cafe", emoji: "☕", name: "Coffee shop", videos: ["uU_RxnJOdMQ", "qU8o3_T5y5M"] },
    { id: "fire", emoji: "🔥", name: "Fireplace", videos: ["cdKop6aixVE", "UgHKb_7884o"] },
    { id: "library", emoji: "📖", name: "Cozy library", videos: ["ULk-_JdE-sk", "CHFif_y2TyM"] },
    { id: "forest", emoji: "🌲", name: "Forest birds", videos: ["Q-tFM4K7IjA", "9_BkAiM93gU"] },
    { id: "ocean", emoji: "🌊", name: "Ocean waves", videos: ["WHPEKLQID4U", "6jW4CZ-AoOg"] },
    { id: "storm", emoji: "⛈️", name: "Thunderstorm", videos: ["ekXFslHOvZ8", "nDq6TstdEi8"] },
    { id: "train", emoji: "🚂", name: "Night train", videos: ["oTqlVuGk8Yc", "ea6o5nsTtQE"] },
    { id: "noise", emoji: "🌫️", name: "Brown noise", sub: "works offline", local: true },
  ];

  const DEFAULTS = { music: null, place: null, custom: "", musicVol: 55, placeVol: 45, withTimer: true, scene: true };
  let prefs = { ...DEFAULTS, ...Store.read(KEY, {}) };
  const savedBefore = Store.read(KEY, null) !== null;
  const save = () => { if (!Store.write(KEY, prefs)) showToast("Couldn't save your soundscape."); };

  /** The 11-character video id in a YouTube link (watch, youtu.be, live, shorts, embed). */
  function videoIdFrom(text) {
    const s = String(text || "").trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    const m = s.match(/(?:youtu\.be\/|[?&]v=|\/(?:live|shorts|embed)\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }

  const musicOption = (id) => id === "custom" && prefs.custom
    ? { id: "custom", emoji: "🔗", name: "Your link", videos: [prefs.custom] }
    : MUSIC.find((m) => m.id === id) || null;
  const placeOption = (id) => PLACES.find((p) => p.id === id) || null;

  /* ---------- YouTube players (one for music, one for the place) ---------- */

  let ytReady = null;
  function loadYouTube() {
    if (ytReady) return ytReady;
    ytReady = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) { resolve(); return; }
      const before = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (before) before(); resolve(); };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => { ytReady = null; reject(new Error("offline")); };
      document.head.appendChild(script);
    });
    return ytReady;
  }

  const slots = {
    music: { holder: "musicFrame", option: null, index: 0, player: null, playing: false, vol: () => prefs.musicVol },
    place: { holder: "placeFrame", option: null, index: 0, player: null, playing: false, vol: () => prefs.placeVol },
  };

  async function play(slotName, option) {
    const slot = slots[slotName];
    if (slotName === "place") stopNoise();
    if (!option) { pause(slotName, true); return; }
    if (option.local) {
      pause("place", true);
      slot.option = option;
      startNoise();
      slot.playing = true;
      render();
      return;
    }
    const changed = !slot.option || slot.option.id !== option.id || (option.id === "custom");
    if (changed) { slot.option = option; slot.index = 0; }
    slot.playing = true;
    render();
    try {
      await loadYouTube();
    } catch {
      slot.playing = false;
      showToast("Can't reach YouTube right now. Brown noise works offline.");
      render();
      return;
    }
    const videoId = option.videos[slot.index];
    // long recordings start somewhere in their first hour, so it's not the same every time
    const start = slotName === "place" ? Math.floor(Math.random() * 3600) : 0;
    if (!slot.player) {
      const target = document.createElement("div");
      $(slot.holder).replaceChildren(target);
      slot.player = new YT.Player(target, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, start },
        events: {
          onReady: (e) => { e.target.setVolume(slot.vol()); if (slot.playing) e.target.playVideo(); else e.target.pauseVideo(); },
          onError: () => tryNext(slotName),
          onStateChange: (e) => { if (e.data === YT.PlayerState.ENDED) { e.target.seekTo(0); e.target.playVideo(); } },
        },
      });
    } else if (changed) {
      slot.player.loadVideoById({ videoId, startSeconds: start });
      slot.player.setVolume(slot.vol());
    } else {
      slot.player.playVideo();
    }
  }

  function tryNext(slotName) {
    const slot = slots[slotName];
    if (!slot.option) return;
    slot.index += 1;
    if (slot.index < slot.option.videos.length) {
      slot.player.loadVideoById({ videoId: slot.option.videos[slot.index] });
      return;
    }
    showToast(`"${slot.option.name}" isn't available right now. Try another one.`);
    slot.playing = false;
    render();
  }

  function pause(slotName, forget) {
    const slot = slots[slotName];
    if (slotName === "place") stopNoise();
    if (slot.player && slot.player.pauseVideo) slot.player.pauseVideo();
    slot.playing = false;
    if (forget) slot.option = null;
    render();
  }

  function playSaved() {
    const music = musicOption(prefs.music);
    const place = placeOption(prefs.place);
    if (music) play("music", music);
    if (place) play("place", place);
  }

  function pauseAll() {
    pause("music");
    pause("place");
  }

  /* ---------- brown noise, made on the device (works offline) ---------- */

  let audio = null;
  let noise = null;
  let noiseGain = null;

  function startNoise() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    stopNoise();
    const length = audio.sampleRate * 4;
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    noise = audio.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const low = audio.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 500;
    noiseGain = audio.createGain();
    noiseGain.gain.value = prefs.placeVol / 100 * 0.7;
    noise.connect(low).connect(noiseGain).connect(audio.destination);
    noise.start();
  }

  function stopNoise() {
    try { if (noise) noise.stop(); } catch {}
    noise = null;
  }

  /* ---------- the card ---------- */

  function tile(option, slotName) {
    const chosen = prefs[slotName] === option.id;
    const on = slots[slotName].option && slots[slotName].option.id === option.id && slots[slotName].playing;
    return h("button", {
      type: "button",
      class: `vibe${chosen ? " is-chosen" : ""}${on ? " is-playing" : ""}`,
      "aria-pressed": String(chosen),
      onclick: () => {
        if (prefs[slotName] === option.id && on) {
          // tapping the playing one turns it off
          prefs[slotName] = null;
          save();
          pause(slotName, true);
          return;
        }
        prefs[slotName] = option.id;
        save();
        play(slotName, slotName === "music" ? musicOption(option.id) : option);
      },
    },
    h("span", { class: "vibe-emoji", "aria-hidden": "true" }, option.emoji),
    h("span", { class: "vibe-name" }, option.name),
    option.sub ? h("span", { class: "vibe-sub" }, option.sub) : null,
    on ? h("span", { class: "vibe-eq", "aria-hidden": "true" }, h("i"), h("i"), h("i")) : null);
  }

  function render() {
    $("musicGrid").replaceChildren(...MUSIC.map((m) => tile(m, "music")),
      ...(prefs.custom ? [tile(musicOption("custom"), "music")] : []));
    $("placeGrid").replaceChildren(...PLACES.map((p) => tile(p, "place")));
    $("musicVol").value = prefs.musicVol;
    $("placeVol").value = prefs.placeVol;
    $("withTimer").checked = prefs.withTimer;
    $("sceneOn").checked = prefs.scene;
    $("vibePrompt").hidden = !!(prefs.music || prefs.place);

    const playing = ["music", "place"].filter((s) => slots[s].playing && slots[s].option).map((s) => `${slots[s].option.emoji} ${slots[s].option.name}`);
    $("nowPlaying").textContent = playing.length ? `Playing: ${playing.join(" + ")}` : (prefs.music || prefs.place ? "Paused. Starts with the timer, or press play." : "");
    $("soundToggle").textContent = playing.length ? "⏸ Pause" : "▶ Play";
    $("soundToggle").hidden = !(prefs.music || prefs.place);

    // the scene behind the timer: the music's video, or the place's when there's no music
    const show = prefs.scene && playing.length > 0;
    const sceneSlot = slots.music.playing && slots.music.option ? "music" : slots.place.playing && slots.place.option && !slots.place.option.local ? "place" : null;
    document.body.classList.toggle("scene-on", !!(show && sceneSlot));
    $("roomPlaying").textContent = playing.length ? `\u266b ${playing.join(" + ")}` : "";
    $("musicFrame").classList.toggle("is-shown", sceneSlot === "music");
    $("placeFrame").classList.toggle("is-shown", sceneSlot === "place");
  }

  $("musicVol").addEventListener("input", (e) => {
    prefs.musicVol = Number(e.target.value);
    if (slots.music.player && slots.music.player.setVolume) slots.music.player.setVolume(prefs.musicVol);
  });
  $("placeVol").addEventListener("input", (e) => {
    prefs.placeVol = Number(e.target.value);
    if (slots.place.player && slots.place.player.setVolume) slots.place.player.setVolume(prefs.placeVol);
    if (noiseGain) noiseGain.gain.value = prefs.placeVol / 100 * 0.7;
  });
  ["musicVol", "placeVol"].forEach((id) => $(id).addEventListener("change", save));
  $("withTimer").addEventListener("change", (e) => { prefs.withTimer = e.target.checked; save(); });
  $("sceneOn").addEventListener("change", (e) => { prefs.scene = e.target.checked; save(); render(); });
  $("soundToggle").addEventListener("click", () => {
    if (slots.music.playing || slots.place.playing) pauseAll(); else playSaved();
  });

  $("customPlay").addEventListener("click", () => {
    const id = videoIdFrom($("customLink").value);
    if (!id) { showToast("That doesn't look like a YouTube link."); return; }
    prefs.custom = id;
    prefs.music = "custom";
    save();
    $("customLink").value = "";
    play("music", musicOption("custom"));
  });
  $("customLink").addEventListener("keydown", (e) => { if (e.key === "Enter") $("customPlay").click(); });

  /* ---------- play with the timer ---------- */

  let wasRunning = false;
  let nudged = false;
  new MutationObserver(() => {
    const running = document.body.classList.contains("running");
    if (running === wasRunning) return;
    wasRunning = running;
    if (running) {
      if (prefs.withTimer && (prefs.music || prefs.place)) playSaved();
      else if (!savedBefore && !nudged && !(prefs.music || prefs.place)) {
        // first time locking in: point out the soundscape once
        nudged = true;
        $("soundscape").classList.add("is-nudged");
        showToast("Tip: pick a music vibe or a cozy place below and it plays every time you lock in.");
        setTimeout(() => $("soundscape").classList.remove("is-nudged"), 4000);
      }
    } else if (prefs.withTimer) {
      pauseAll();
    }
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  /* ---------- room view: just the timer, floating over the scene ---------- */

  function setRoom(on) {
    document.body.classList.toggle("room-view", on);
    $("roomBtn").textContent = on ? "\u2715 Exit room view" : "\u26f6 Room view";
    if (on) {
      window.scrollTo({ top: 0 });
      if (!(slots.music.playing || slots.place.playing) && (prefs.music || prefs.place)) playSaved();
      else if (!(prefs.music || prefs.place)) showToast("Pick a music vibe or a place in the Soundscape to fill the room.");
    }
  }
  $("roomBtn").addEventListener("click", () => setRoom(!document.body.classList.contains("room-view")));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("room-view") && !document.querySelector("dialog[open]")) setRoom(false);
  });

  window.addEventListener("pagehide", stopNoise);
  render();
})();
