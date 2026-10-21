const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
const DEFAULTS = {
  enabled: true,
  alwaysShow: false,
  shortcuts: true,
  rememberVolume: true,
  defaultSpeed: 1,
  skipSeconds: 5
};

const els = {};
Object.keys(DEFAULTS).forEach((key) => { els[key] = document.getElementById(key); });

function render(values) {
  for (const [key, el] of Object.entries(els)) {
    if (el.type === 'checkbox') el.checked = !!values[key];
    else el.value = String(values[key]);
  }
  document.body.classList.toggle('off', !values.enabled);
}

api.storage.sync.get(DEFAULTS).then(render);

for (const [key, el] of Object.entries(els)) {
  el.addEventListener('change', async () => {
    const value = el.type === 'checkbox' ? el.checked : Number(el.value);
    await api.storage.sync.set({ [key]: value });
    if (key === 'enabled') document.body.classList.toggle('off', !value);
  });
}
