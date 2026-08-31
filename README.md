# Minimal for YouTube

Turn YouTube into a productivity tool: a minimal interface instead of algorithms.

A browser extension that strips the recommendation feed, Shorts and the rest of
the attention machinery from YouTube, leaving search, subscriptions and a focus
timer.

[Русская версия](README.ru.md)

## Demo

![Subscriptions screen: a full-height header, the feed starts below the fold](docs/demo.gif)

The full recording in better quality: [docs/demo.mp4](docs/demo.mp4)

## What it does

- **No recommendation feed.** The home page redirects to Subscriptions, where
  the header takes the full screen and the feed starts below the fold.
- **No Shorts** — in subscriptions, search results, channel pages and the
  channel tab. Can be turned back on from the popup.
- **A clean watch page.** The related-videos column and the in-feed ad panel are
  gone; without a playlist the player takes the full width.
- **Theme switch** — device, light or dark, applied through YouTube's own
  setting so it survives reloads.
- **A focus timer** that keeps running with the popup closed and reports the end
  with a system notification and an in-page dialog.
- **15 interface languages**, right-to-left layout included.

## Install

### From a release

Download the archive for your browser from
[Releases](https://github.com/KARIB9/minimal-for-youtube/releases) and unpack it.

**Chrome** — `chrome://extensions` → Developer mode → Load unpacked → pick the
unpacked folder.

**Firefox** — `about:debugging` → This Firefox → Load Temporary Add-on → pick
`manifest.json`. A temporary add-on is removed when the browser restarts.

### From source

```sh
git clone https://github.com/KARIB9/minimal-for-youtube.git
cd minimal-for-youtube
sh tools/build.sh
```

Two archives appear in `build/`: one per store. They differ only in the
manifest — Chrome declares the background script as `service_worker`, Firefox as
`scripts`, and the Firefox one also carries the add-on id and the minimum
supported version.

## How it is put together

| file | role |
|---|---|
| `early.js` | runs at `document_start`: rebuilds the header, moves the real YouTube logo to the centre, inserts the navigation buttons |
| `content.js` | layout on SPA navigation, theme switching, the timer dialog, a self-check of the YouTube nodes it relies on |
| `styles.css` | every visual rule, grouped by screen |
| `timer.js` | background counter on `chrome.alarms` |
| `popup/` | the extension window: toggles, theme buttons, timer |
| `_locales/` | 15 languages |
| `tools/build.sh` | builds the per-store archives |

Two details worth knowing if you read the code:

**The theme is not repainted by us.** YouTube's newer components carry a hard
`…Dark` class applied at render time, so flipping the `dark` attribute on
`<html>` only recolours the root tokens and leaves the page itself untouched.
The extension asks YouTube to switch its own theme instead, through the same
action that sits behind the Appearance item in the account menu.

**Hiding a single Shorts card needs `:has()`.** A card is recognised by the
`/shorts/` link inside it, and only `:has()` can reach the container from a
descendant. Firefox supports it from 121; on 109–120 the shelves still go, the
individual cards stay.

## Compatibility

Chrome and Chromium-based browsers, Firefox 109+ (121+ for complete Shorts
removal). No permissions beyond `storage`, `alarms` and `notifications`; nothing
is collected or sent anywhere.

## Support

If the extension is useful to you: [Boosty](https://boosty.to/batton_rooge/donate)
· [Ko-fi](https://ko-fi.com/batton_rouge)

## License

[MIT](LICENSE)
