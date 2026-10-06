# Liminal VR synchronized v6

Fixes two headset issues from v5:

- Stereo comfort: reduced virtual IPD, off-axis convergence correction, and mild Cardboard lens pre-warp.
- Phone smoothness: ~30 Hz master updates plus client-side prediction/interpolation so the phone renders at its own display frame rate instead of visibly snapping to network packets.

Run `npm start`, open the controller URL on the laptop and the headset URL on the phone. Keep both on the same Wi-Fi.

For the cleanest phone test, close other heavy tabs/apps and use landscape orientation.
