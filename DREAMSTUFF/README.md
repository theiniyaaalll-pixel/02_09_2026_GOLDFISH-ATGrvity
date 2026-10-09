# Liminal VR synchronized v8

A laptop controls a freely explorable underwater bridge with reflective water and a distant white light sphere. Reaching the sphere, or spending two and a half minutes in the first visual, starts a white fade into a warm rural landscape with grass, shallow ponds, trees and translucent cellular materials. The phone mirrors the scene in calibrated Cardboard stereo with head tracking.

## Flow

1. Open the site on a laptop (Chrome recommended). It becomes the **master** and asks for webcam access (index up = forward, open palm = backward, point left/right = sidestep, index circle = full turn; WASD/arrows and mouse look remain available).
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

All paths are relative. The generated `visual2.bundle.js` must be published beside `index.html`; it includes the landscape renderer, model and textures. Run `npm run build` after editing `visual2.js`, `visual3.js`, their dependencies or their assets. `npm start` rebuilds it automatically.

## Local development

`npm start`, then open `http://localhost:8080/`. Use the link under the QR code in a second tab to test the headset view. Phones can't reach `localhost`, and webcams need HTTPS off-localhost, so test on real phones against the deployed site.

URL modes: `?mode=controller` (default), `?mode=headset&room=<code>`, `?mode=solo`.

## Automatic visual transition

Visual 2 preloads and prepares its shaders while visual 1 is running. The same page fades to white and then reveals the landscape automatically; no second link or page navigation is required. Both the two-and-a-half-minute timeout and reaching the light use this sequence. Visual 2 then fades to white on reaching its own light or after two minutes, and automatically reveals visual 3. The master publishes the street origin and reveal clock, so the phone follows the same transition.

The packaged landscape also runs when `index.html?mode=solo` is opened directly as a file. Laptop/phone testing should use the deployed HTTPS site as before. The `?mode=solo&scene=2` link is only an optional direct preview, not part of the normal sequence.

## Visual 3 preview

Use `index.html?mode=solo&scene=3` to preview the evening street directly. Normal simulation flow remains visual 1 ? visual 2 ? visual 3, with white fades and the same navigation and calibration. Visual 3 reuses the existing Three.js renderer and tree geometry. Its packaged assets are included in `visual2.bundle.js`, so no extra runtime model downloads are required.

The current preview uses three CC0 rigged adult characters, with walking/idle clips and custom cycling IK. It does not yet include children, region-specific scanned characters or a complete variety of Indian clothing. Close-up facial realism and the character mix remain art-review items; this is not a claim of reference-level photorealism. See `assets/street/README.md` for provenance.
