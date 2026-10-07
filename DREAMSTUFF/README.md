# Liminal VR synchronized v8

A laptop drives a walk through a raymarched liminal corridor; a phone in a Cardboard headset mirrors it in stereo.

## Flow

1. Open the site on a laptop (Chrome recommended). It becomes the **master** and asks for webcam access (both thumbs up = walk forward; WASD/arrows + mouse also work).
2. A **QR code** appears top-right. Scan it with a phone.
3. On the phone, tap **Enter VR** (goes fullscreen, landscape, keeps the screen awake) and put it in the headset.

**Full screen:** Android Chrome goes fullscreen on the Enter VR tap. iPhone Safari can't hide its bars from a web page (Fullscreen API is iPad-only), so on iPhone the page walks you through a one-time *Share → Add to Home Screen*; the icon then opens with no browser UI and reconnects to the same laptop (the laptop keeps its room code).

The QR panel collapses once a headset connects and reappears if it drops. Reloading the laptop tab keeps the same room code, so phones reconnect on their own.

## Stereo / headset tuning

Rendering follows Google's Cardboard model (from `cardboard-vr-display`): each eye's image is centred on its lens (Cardboard V2: 64 mm lens spacing, 39 mm screen-to-lens, k1 0.34 / k2 0.55, 60° FOV) with parallel eye cameras. Placing the lenses correctly needs the screen's physical size:

- **iPhone:** estimated from Apple's ppi specs.
- **Android:** only a rough guess. On the phone, tap **Calibrate screen size** and match a bank card (85.6 mm) once.
- **While someone wears the headset:** on the laptop, **G** toggles an alignment cross (it should look like one sharp cross), and **[ / ]** nudge lens spacing by 0.5 mm. Settings are saved on the phone.

## How sync works

Static hosting can't relay data, so the laptop and phone talk directly over a WebRTC data channel via [PeerJS](https://peerjs.com/). The free public PeerJS broker (`0.peerjs.com`) is only used to introduce the two devices. They don't need to share Wi-Fi.

Some restrictive networks (corporate/venue Wi-Fi, some carriers) block direct WebRTC. If the phone stays on "Connecting…", try mobile data or another network. A TURN relay would fix this permanently.

## Deploy (GitHub Pages)

Repo **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**. The app is then at:

`https://<user>.github.io/<repo>/DREAMSTUFF/`

The QR code uses the exact landing-page URL open on the laptop, then adds the headset mode and room code. Keep the controller open at the deployed HTTPS address so phones can open the QR destination and connect.

All paths are relative, so no build step is needed.

## Local development

`npm start`, then open `http://localhost:8080/`. Use the link under the QR code in a second tab to test the headset view. Phones can't reach `localhost`, and webcams need HTTPS off-localhost, so test on real phones against the deployed site.

URL modes: `?mode=controller` (default), `?mode=headset&room=<code>`, `?mode=solo`.
