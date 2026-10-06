# Dream VR — Scene 1 / Traffic Passage

First public iteration of a browser-based dreamy traffic passage.

## Modes
- **Normal View**: single-camera view on laptop or phone.
- **Cardboard VR**: side-by-side stereoscopic view; phone orientation controls looking on supported devices.
- **Laptop locomotion**: forward movement is intentionally locked to MediaPipe detecting **two raised thumbs**. No keyboard/mouse locomotion.

## Local run
```bash
npm install
npm start
```
Open `http://localhost:3000`.

> Camera access requires a secure context. `localhost` is allowed by browsers. A GitHub Pages deployment is HTTPS and is also allowed. Plain LAN `http://192.168...` URLs may not receive camera/sensor permissions on some browsers.

## GitHub Pages
The deployable static build is in `/docs`.

1. Push this repository to GitHub.
2. Repository **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your main branch and folder **/docs**.
5. Save. GitHub will provide the public HTTPS Pages URL.

The same Pages URL can be opened on laptop and phone.

## Current interaction decision
Phone-only forward locomotion is deliberately not assigned yet. Cardboard head tracking is implemented independently; the next iteration can define the intended phone-only navigation behavior.
