(() => {
  'use strict';
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  if (window.__ivcLoaded) return;
  window.__ivcLoaded = true;

  const DEFAULTS = {
    enabled: true,
    alwaysShow: false,
    shortcuts: true,
    rememberVolume: true,
    defaultSpeed: 1,
    skipSeconds: 5
  };
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  let settings = { ...DEFAULTS };
  let savedVolume = null;
  let applyingVolume = false;
  const controllers = new Set();

  /* ---------- helpers ---------- */
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const safe = (fn) => { try { return fn(); } catch (_) { /* extension reloaded */ } };

  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>',
    fwd: '<svg viewBox="0 0 24 24"><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z"/></svg>',
    vol: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z"/></svg>',
    loop: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>',
    pip: '<svg viewBox="0 0 24 24"><path d="M19 7H5v10h14zm2-2v14H3V5zm-9 6h7v5h-7z"/></svg>'
  };

  const BAR_CSS = `
    :host{all:initial}
    .bar{pointer-events:auto;display:flex;align-items:center;gap:4px;padding:6px 10px;margin:0 10px 10px;
      border-radius:12px;background:rgba(18,18,18,.78);backdrop-filter:blur(8px);color:#fff;
      font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;opacity:0;transform:translateY(6px);
      transition:opacity .15s,transform .15s;user-select:none}
    .bar.visible{opacity:1;transform:none}
    button{all:unset;box-sizing:border-box;cursor:pointer;min-width:28px;height:28px;display:grid;place-items:center;border-radius:6px}
    button:hover{background:rgba(255,255,255,.2)}
    button:focus-visible{outline:2px solid #fff}
    button.on{color:#ff5a8a}
    svg{width:18px;height:18px;fill:currentColor}
    .speed{padding:0 6px}
    .time{font-variant-numeric:tabular-nums;white-space:nowrap;padding:0 4px;opacity:.9}
    input[type=range]{flex:1;min-width:60px;height:4px;accent-color:#ff3d7f;cursor:pointer;margin:0 4px}
    @media (prefers-reduced-motion:reduce){.bar{transition:none}}
  `;

  /* ---------- toast ---------- */
  let toastEl, toastTimer;
  function toast(text) {
    if (!toastEl) {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;';
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>div{font:600 14px system-ui,sans-serif;color:#fff;background:rgba(18,18,18,.85);padding:8px 14px;border-radius:10px;opacity:0;transition:opacity .15s}div.show{opacity:1}</style><div></div>';
      document.documentElement.appendChild(host);
      toastEl = root.querySelector('div');
    }
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 900);
  }

  /* ---------- actions ---------- */
  function togglePlay(v) { v.paused ? v.play().catch(() => {}) : v.pause(); }
  function skip(v, seconds) {
    if (!isFinite(v.duration)) return;
    v.currentTime = clamp(v.currentTime + seconds, 0, v.duration);
    toast((seconds > 0 ? '+' : '') + seconds + 's');
  }
  function setSpeed(v, rate) {
    rate = clamp(Math.round(rate * 100) / 100, 0.25, 3);
    settings.defaultSpeed = rate;
    document.querySelectorAll('video').forEach((el) => { el.playbackRate = rate; });
    safe(() => api.storage.sync.set({ defaultSpeed: rate }));
    toast(rate + 'x');
  }
  function stepSpeed(v, dir) {
    const cur = v.playbackRate;
    let next;
    if (dir > 0) next = SPEEDS.find((s) => s > cur + 0.001) ?? SPEEDS[SPEEDS.length - 1];
    else next = [...SPEEDS].reverse().find((s) => s < cur - 0.001) ?? SPEEDS[0];
    setSpeed(v, next);
  }
  function cycleSpeed(v) {
    const idx = SPEEDS.findIndex((s) => Math.abs(s - v.playbackRate) < 0.001);
    setSpeed(v, SPEEDS[(idx + 1) % SPEEDS.length]);
  }
  function toggleMute(v) { v.muted = !v.muted; toast(v.muted ? 'Muted' : 'Unmuted'); }
  function toggleLoop(v) { v.loop = !v.loop; toast(v.loop ? 'Loop on' : 'Loop off'); }
  async function togglePiP(v) {
    try {
      v.disablePictureInPicture = false;
      if (document.pictureInPictureElement === v) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch (_) { toast('Picture-in-Picture unavailable'); }
  }

  function activeVideo() {
    let best = null, bestScore = 0;
    document.querySelectorAll('video').forEach((v) => {
      const r = v.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      let score = w * h;
      if (!v.paused) score *= 1.5;
      if (score > bestScore) { best = v; bestScore = score; }
    });
    return best;
  }

  /* ---------- per-video controller ---------- */
  function attach(video) {
    if (video.__ivc) return;
    const parent = video.parentElement;
    if (!parent) return;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

    const host = document.createElement('div');
    host.className = 'ivc-host';
    host.style.cssText = 'position:absolute;left:0;right:0;bottom:0;z-index:2147483000;pointer-events:none;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${BAR_CSS}</style>
      <div class="bar" part="bar">
        <button class="play" title="Play / Pause (K)">${ICON.play}</button>
        <button class="back" title="Back (J)">${ICON.back}</button>
        <button class="fwd" title="Forward (L)">${ICON.fwd}</button>
        <span class="time">0:00 / 0:00</span>
        <input class="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek">
        <button class="speed" title="Playback speed (< >)">1x</button>
        <button class="mute" title="Mute (M)">${ICON.vol}</button>
        <button class="loop" title="Loop (R)">${ICON.loop}</button>
        <button class="pip" title="Picture-in-Picture (P)">${ICON.pip}</button>
      </div>`;
    parent.appendChild(host);

    const $ = (s) => root.querySelector(s);
    const bar = $('.bar'), playBtn = $('.play'), seek = $('.seek'), timeEl = $('.time');
    const speedBtn = $('.speed'), muteBtn = $('.mute'), loopBtn = $('.loop');
    let hovering = false, dragging = false;

    // Keep Instagram from reacting to clicks on our controls (play/pause, like, navigate).
    ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'contextmenu']
      .forEach((ev) => host.addEventListener(ev, (e) => e.stopPropagation()));

    const refreshVisibility = () => {
      host.style.display = settings.enabled ? '' : 'none';
      bar.classList.toggle('visible', settings.enabled && (settings.alwaysShow || hovering || dragging || video.paused));
    };
    const refreshUI = () => {
      playBtn.innerHTML = video.paused ? ICON.play : ICON.pause;
      muteBtn.innerHTML = video.muted || video.volume === 0 ? ICON.mute : ICON.vol;
      speedBtn.textContent = video.playbackRate + 'x';
      loopBtn.classList.toggle('on', video.loop);
      if (!dragging && isFinite(video.duration) && video.duration > 0) {
        seek.value = Math.round((video.currentTime / video.duration) * 1000);
      }
      timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
      refreshVisibility();
    };

    playBtn.onclick = () => togglePlay(video);
    $('.back').onclick = () => skip(video, -settings.skipSeconds);
    $('.fwd').onclick = () => skip(video, settings.skipSeconds);
    speedBtn.onclick = () => cycleSpeed(video);
    muteBtn.onclick = () => toggleMute(video);
    loopBtn.onclick = () => { toggleLoop(video); refreshUI(); };
    $('.pip').onclick = () => togglePiP(video);

    seek.addEventListener('input', () => {
      dragging = true;
      if (isFinite(video.duration)) video.currentTime = (seek.value / 1000) * video.duration;
      refreshUI();
    });
    seek.addEventListener('change', () => { dragging = false; refreshUI(); });

    parent.addEventListener('mouseenter', () => { hovering = true; refreshVisibility(); });
    parent.addEventListener('mouseleave', () => { hovering = false; refreshVisibility(); });

    ['timeupdate', 'play', 'pause', 'ratechange', 'volumechange', 'durationchange', 'seeking', 'seeked']
      .forEach((ev) => video.addEventListener(ev, refreshUI));

    const applyPrefs = () => {
      if (video.playbackRate !== settings.defaultSpeed) video.playbackRate = settings.defaultSpeed;
      if (settings.rememberVolume && savedVolume) {
        applyingVolume = true;
        video.volume = savedVolume.volume;
        video.muted = savedVolume.muted;
        setTimeout(() => { applyingVolume = false; }, 50);
      }
    };
    video.addEventListener('loadedmetadata', () => { applyPrefs(); refreshUI(); });
    video.addEventListener('play', () => {
      if (video.playbackRate !== settings.defaultSpeed) video.playbackRate = settings.defaultSpeed;
    });
    video.addEventListener('volumechange', () => {
      if (applyingVolume || !settings.rememberVolume) return;
      savedVolume = { volume: video.volume, muted: video.muted };
      safe(() => api.storage.local.set({ volumeState: savedVolume }));
    });

    video.disablePictureInPicture = false;
    video.__ivc = { host, refreshUI };
    controllers.add(video);
    applyPrefs();
    refreshUI();
  }

  function scan() {
    document.querySelectorAll('video').forEach(attach);
    controllers.forEach((v) => { if (!v.isConnected) controllers.delete(v); });
  }
  let scanTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 150);
  });

  /* ---------- keyboard shortcuts ---------- */
  document.addEventListener('keydown', (e) => {
    if (!settings.enabled || !settings.shortcuts) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.composedPath()[0];
    if (t && t.tagName) {
      const tag = t.tagName;
      const type = (t.type || '').toLowerCase();
      if (tag === 'TEXTAREA' || t.isContentEditable) return;
      if (tag === 'INPUT' && !['range', 'button', 'checkbox'].includes(type)) return;
    }
    const v = activeVideo();
    if (!v) return;
    const k = e.key;
    let handled = true;
    if (k === 'k' || k === 'K') togglePlay(v);
    else if (k === 'j' || k === 'J' || k === 'ArrowLeft') skip(v, -settings.skipSeconds);
    else if (k === 'l' || k === 'L' || k === 'ArrowRight') skip(v, settings.skipSeconds);
    else if (k === 'm' || k === 'M') toggleMute(v);
    else if (k === 'r' || k === 'R') toggleLoop(v);
    else if (k === 'p' || k === 'P') togglePiP(v);
    else if (k === '<') stepSpeed(v, -1);
    else if (k === '>') stepSpeed(v, 1);
    else if (/^[0-9]$/.test(k) && isFinite(v.duration)) {
      v.currentTime = (Number(k) / 10) * v.duration;
      toast(Number(k) * 10 + '%');
    } else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ---------- settings sync ---------- */
  function applySettings() {
    controllers.forEach((v) => {
      if (v.isConnected && v.__ivc) {
        if (settings.enabled && v.playbackRate !== settings.defaultSpeed) v.playbackRate = settings.defaultSpeed;
        v.__ivc.refreshUI();
      }
    });
  }

  safe(() => {
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
      applySettings();
    });
  });

  Promise.all([
    safe(() => api.storage.sync.get(DEFAULTS)),
    safe(() => api.storage.local.get('volumeState'))
  ]).then(([sync, local]) => {
    settings = { ...DEFAULTS, ...(sync || {}) };
    savedVolume = (local && local.volumeState) || null;
    scan();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
