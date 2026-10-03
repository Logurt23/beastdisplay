# Kiosk device setup

For the screen that runs BeastDisplay. The display device (Pi, Windows mini PC or ChromeOS) is still an open question, so Linux and Windows are both covered.

## TV

- Set the picture size to **Just Scan**, **Screen Fit** or **1:1** so the TV does not crop the edges. If the TV has no such setting, raise `safeAreaPx` in `config.js` from 48 to 96.
- Turn off input auto-switch and any eco or auto-off timer.
- 1920x1080 is the design size. On a 4K TV set the OS scaling to 100% or 200% and Chrome zoom to 100%; the app scales itself.

## Chrome or Chromium

Launch:

```
chromium --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
  --no-first-run --no-default-browser-check --disable-pinch \
  --overscroll-history-navigation=0 --check-for-update-interval=31536000 \
  "https://display.emmadvertising.com/"
```

(`chrome.exe` with the same flags on Windows.)

- Do **not** use `--incognito` or `--disk-cache-dir=/dev/null`. The display keeps its last good board in `localStorage` and relies on the HTTP cache during a Nexus outage.
- Zoom 100%.
- Settings > Performance: add `display.emmadvertising.com` to "Always keep these sites active", and turn Energy Saver off.
- Crash bubble after a power cut: on each boot, before launching, set `"exited_cleanly": true` and `"exit_type": "Normal"` in the profile's `Default/Preferences`:

```
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences
```

## No sleep

Linux (X11), in the session autostart:

```
xset s noblank
xset s off
xset -dpms
```

Windows: Power plan "Turn off the display: Never", "Put the computer to sleep: Never"; screen saver off.

The app also requests a screen wake lock. That is a backup; the OS setting is the real guard.

## Cursor

The app sets `cursor: none`. If a mouse is ever plugged in, hide it after 3 s idle:

```
unclutter -idle 3 -root
```

(Windows: AutoHideMouseCursor or similar.)

## Daily reboot

Reboot at 04:00 Chicago every day (cron on Linux, Task Scheduler on Windows). It lets Chrome apply updates and clears anything the 6 h in-app reload does not.

```
0 4 * * * /sbin/shutdown -r now     # with the machine's timezone set to America/Chicago
```

## Known blank-screen causes outside the app

- TLS certificate expiry on `display.emmadvertising.com`: automate renewal on the host.
- DNS failure at boot.
- TV input auto-switch.
- A Chrome update or "restore pages" prompt (handled by the flags and Preferences fix above).

The app never reloads unless the host answers, so an outage that starts after boot keeps the last frame on screen.
