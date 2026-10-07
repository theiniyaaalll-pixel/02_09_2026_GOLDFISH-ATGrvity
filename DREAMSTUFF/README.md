# Liminal VR synchronized v8

A laptop drives a walk through a raymarched liminal corridor; a phone in a Cardboard headset mirrors it in stereo.

## Flow

1. Open the site on a laptop (Chrome recommended). It becomes the **master** and asks for webcam access (both thumbs up = walk forward; WASD/arrows + mouse also work).
2. A **QR code** appears top-right. Scan it with a phone.
3. On the phone, tap **Enter VR** (goes fullscreen, landscape, keeps the screen awake) and put it in the headset.

**Full screen:** Android Chrome goes fullscreen on the Enter VR tap. iPhone Safari can't hide its bars from a web page (Fullscreen API is iPad-only), so on iPhone the page walks you through a one-time *Share → Add to Home Screen*; the icon then opens with no browser UI and reconnects to the same laptop (the laptop creates a fresh room code each session).

The QR panel collapses once a headset connects and reappears if it drops. Reloading the laptop creates a fresh room code; rescan the QR after a laptop reload.

## Stereo / headset tuning

Rendering follows Google's Cardboard model (from `cardboard-vr-display`): each eye's image is centred on its lens (Cardboard V2: 64 mm lens spacing, 39 mm screen-to-lens, k1 0.34 / k2 0.55, 60° FOV) with parallel eye cameras. Placing the lenses correctly needs the screen's physical size:

- **iPhone:** estimated from Apple's ppi specs.
- **Android:** only a rough guess. On the phone, tap **Calibrate screen size** and match a bank card (85.6 mm) once.
- **While someone wears the headset:** on the laptop, **G** toggles an alignment cross, **[ / ]** nudges physical lens spacing, and **; / '** adjusts stereo depth separately. Stereo depth defaults to 0 mm for maximum fusion/comfort; increase it only if comfortable 3D separation is desired. Settings are saved on the phone.

## How sync works

Static hosting can't relay data, so the laptop and phone talk directly over a WebRTC data channel via [PeerJS](https://peerjs.com/). The free public PeerJS broker (`0.peerjs.com`) is only used to introduce the two devices. They don't need to share Wi-Fi.

The app now supplies multiple public STUN servers and retries direct WebRTC automatically. Some restrictive networks can still block peer-to-peer WebRTC; a static GitHub Pages app cannot guarantee traversal of those networks without an external TURN relay.

## Deploy (GitHub Pages)

Repo **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**. The app is then at:

`https://<user>.github.io/<repo>/DREAMSTUFF/`

All paths are relative, so no build step is needed.

## Local development

`npm start`, then open `http://localhost:8080/`. Use the link under the QR code in a second tab to test the headset view. Phones can't reach `localhost`, and webcams need HTTPS off-localhost, so test on real phones against the deployed site.

URL modes: `?mode=controller` (default), `?mode=headset&room=<code>`, `?mode=solo`.
