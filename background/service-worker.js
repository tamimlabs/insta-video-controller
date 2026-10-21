const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
const DEFAULTS = {
  enabled: true,
  alwaysShow: false,
  shortcuts: true,
  rememberVolume: true,
  defaultSpeed: 1,
  skipSeconds: 5
};

api.runtime.onInstalled.addListener(async () => {
  const current = await api.storage.sync.get(null);
  const missing = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!(key in current)) missing[key] = value;
  }
  if (Object.keys(missing).length) await api.storage.sync.set(missing);
});
