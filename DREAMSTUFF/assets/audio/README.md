# Scene audio

- `rushing-water.wav`: converted from `loudstream.ogg` in **Stream Sounds**, by kurt. Source: https://lpc.opengameart.org/content/stream-sounds . License: CC BY 3.0, https://creativecommons.org/licenses/by/3.0/ . Converted from Ogg to PCM WAV for mobile compatibility; runtime adds short loop-edge fades and wave-driven gain/filter modulation.
- `grasshopper.mp3`: **Grasshopper**, by lauris3722. Source: https://freesound.org/people/lauris3722/sounds/161720/ . CC0. Freesound high-quality MP3 preview.
- `night-nature.mp3`: **Crickets and Distant Running Water at Night**, by PKCubed. Source: https://freesound.org/people/PKCubed/sounds/826092/ . CC0. Freesound high-quality MP3 preview. Also used quietly behind the Visual 3 market.
- `market-india.mp3`: **Market in India**, by florianreichelt. Source: https://freesound.org/people/florianreichelt/sounds/434853/ . CC0. Freesound high-quality MP3 preview.

`jump-scream.mp3` is the user's supplied screaming-goat recording, copied from Downloads. `jump-scream.wav` is the decoded playback asset: 1.925 seconds of leading quiet removed, leaving the 2.708-second scream, with brief edge fades. No replacement scream is used. The earlier `videoplayback (16).mp4` contained only video and was not used for sound.

Assets are embedded in `audio-assets.js` for local-file operation; no runtime third-party audio requests are made. Sound unlocks from a user tap/key, including the phone's existing Enter VR tap. The three-second scare window mutes nature, and the scream (when supplied) starts at the shared scene offset and stops when the image leaves.
