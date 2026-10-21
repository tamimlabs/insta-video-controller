# Insta Video Controller

A Firefox extension that adds real video controls to Instagram on web and Android.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Why

Instagram's built-in player is limited. This extension adds a proper control bar with seeking, speed, volume memory, and keyboard shortcuts, without modifying Instagram's own UI.

## Features

- Seek bar with current time and duration
- Play / pause and skip back / forward (5, 10, 15, or 30 seconds)
- Playback speed from 0.25x to 3x, remembered between videos
- Volume and mute state remembered
- Loop toggle and Picture-in-Picture
- Keyboard shortcuts (ignored while typing)
- Popup settings with on/off switch
- Works on Firefox for desktop and Android

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `K` | Play / pause |
| `J` / `L` | Skip back / forward |
| `←` / `→` | Skip back / forward |
| `<` / `>` | Slower / faster |
| `M` | Mute |
| `R` | Loop |
| `P` | Picture-in-Picture |
| `0`–`9` | Jump to 0–90% |

## Install

### From source (temporary)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json`

### From AMO

Install from the Firefox Add-ons listing once published.

## Development

No build step. The extension is plain JavaScript, HTML and CSS.

```
manifest.json
background/service-worker.js   default settings on install
content/content.js             control bar, shortcuts, speed/volume memory
popup/popup.{html,css,js}      settings popup
icons/                         16, 32, 48, 128 px icons
```

Instagram changes its page structure often. If the bar stops appearing, the video lookup in `scan()` and `attach()` in `content/content.js` is the place to adjust.

The control bar lives in a Shadow DOM so Instagram's CSS cannot affect it.

## Privacy

No data is collected or transmitted. Settings are stored using Firefox storage only.

## Author

Tamim Hasan — [tamimlabs.com](https://tamimlabs.com)

## License

[MIT](LICENSE)
