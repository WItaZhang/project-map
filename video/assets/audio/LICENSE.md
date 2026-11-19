# Original Project Map audio

These assets are original, locally synthesized audio authored for Project Map:

- `music.m4a` (distributed AAC copy) and `music.wav` (regenerated master): 84 seconds, 100 BPM, 4/4, 35 bars; warm harmonic pads, rounded plucks, and quiet noise percussion.
- `click-soft.wav`: 80 ms filtered-noise interface click.
- `click-deep.wav`: 105 ms lower filtered-noise interface click.

Regenerate with `python3 video/scripts/generate-audio.py` from the repository root. The deterministic generator uses Python's standard library only. It contains no sampled recordings, third-party audio, speech, paid services, or network requests. All WAV files are 48 kHz, stereo, 16-bit PCM.

The music is scaled to approximately -21 dBFS RMS with a peak ceiling. This is an engineering level target, not a measured integrated LUFS claim. Final delivery may apply measured loudness normalization. These assets have been checked programmatically; no listening review is claimed.

## MIT License

Copyright (c) 2026 Qianqian Zhang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
