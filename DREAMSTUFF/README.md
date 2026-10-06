# Liminal VR synchronized v7

A laptop drives a walk through a raymarched liminal corridor; a phone in a Cardboard headset mirrors it in stereo.

## Flow

1. Open the site on a laptop (Chrome recommended). It becomes the **master** and asks for webcam access (both thumbs up = walk forward; WASD/arrows + mouse also work).
2. A **QR code** appears top-right. Scan it with a phone.
3. On the phone, tap **Enter VR** (goes fullscreen, landscape, keeps the screen awake) and put it in the headset.

The QR panel collapses once a headset connects and reappears if it drops. Reloading the laptop tab keeps the same room code, so phones reconnect on their own.

## How sync works

Static hosting can't relay data, so the laptop and phone talk directly over a WebRTC data channel via [PeerJS](https://peerjs.com/). The free public PeerJS broker (`0.peerjs.com`) is only used to introduce the two devices. They don't need to share Wi-Fi.

Some restrictive networks (corporate/venue Wi-Fi, some carriers) block direct WebRTC. If the phone stays on "Connecting…", try mobile data or another network. A TURN relay would fix this permanently.

## Deploy (GitHub Pages)

Repo **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**. The app is then at:

`https://<user>.github.io/<repo>/DREAMSTUFF/`

All paths are relative, so no build step is needed.

## Local development

`npm start`, then open `http://localhost:8080/`. Use the link under the QR code in a second tab to test the headset view. Phones can't reach `localhost`, and webcams need HTTPS off-localhost, so test on real phones against the deployed site.

URL modes: `?mode=controller` (default), `?mode=headset&room=<code>`, `?mode=solo`.
