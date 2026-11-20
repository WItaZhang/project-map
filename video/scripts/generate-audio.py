#!/usr/bin/env python3
"""Generate original deterministic Project Map music and UI clicks (stdlib only).

No recordings, samples, speech, network, or third-party synthesis libraries.
100 BPM, 4/4, 45 bars = 108 seconds. All waveforms are authored here.
"""
from array import array
from pathlib import Path
import math
import random
import struct
import wave

SR = 48_000
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 45
DURATION = BARS * BAR
N = round(SR * DURATION)
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
SEED = 1902026
TABLE_SIZE = 4096


def make_table(harmonics):
    norm = sum(abs(h) for h in harmonics)
    return array('f', (
        sum(h * math.sin(2 * math.pi * (k + 1) * i / TABLE_SIZE)
            for k, h in enumerate(harmonics)) / norm
        for i in range(TABLE_SIZE)
    ))


PAD = make_table([1.0, .22, .12, .035, .014])
PLUCK = make_table([1.0, .38, .16, .08, .024, .01])


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def tone(left, right, start, duration, midi, gain, pan, pluck=False):
    first = max(0, round(start * SR))
    count = min(round(duration * SR), len(left) - first)
    if count <= 0:
        return
    table = PLUCK if pluck else PAD
    freq = hz(midi)
    inc1 = freq * TABLE_SIZE / SR
    inc2 = inc1 * 1.0026
    phase1 = ((midi * 173) % TABLE_SIZE) * 1.0
    phase2 = phase1 + 713.0
    gl = gain * math.sqrt((1 - pan) / 2)
    gr = gain * math.sqrt((1 + pan) / 2)
    attack = max(1, round((.009 if pluck else .32) * SR))
    release = max(1, round((.12 if pluck else .46) * SR))
    decay = math.exp(-1 / (SR * (.27 if pluck else 8.0)))
    envelope = 1.0
    mask = TABLE_SIZE - 1
    for i in range(count):
        envelope *= decay
        e = min(1.0, i / attack, (count - i) / release) * envelope
        a = table[int(phase1) & mask]
        b = table[int(phase2) & mask]
        j = first + i
        # Closely detuned harmonic waves provide a warm, soft stereo body.
        left[j] += (a * .78 + b * .22) * e * gl
        right[j] += (a * .32 + b * .68) * e * gr
        phase1 += inc1
        phase2 += inc2


def percussion(left, right, start, gain, rng, kind='shaker'):
    first = round(start * SR)
    duration = .075 if kind == 'shaker' else .13
    count = min(round(duration * SR), len(left) - first)
    lp = 0.0
    prev = 0.0
    envelope = 1.0
    decay = math.exp(-1 / (SR * (.018 if kind == 'shaker' else .035)))
    pan = rng.uniform(-.35, .35)
    for i in range(max(0, count)):
        raw = rng.uniform(-1, 1)
        lp += (.22 if kind == 'shaker' else .035) * (raw - lp)
        signal = (lp - prev) if kind == 'shaker' else lp
        prev = lp
        envelope *= decay
        attack = min(1.0, i / (SR * .0015))
        signal *= gain * envelope * attack
        left[first + i] += signal * (1 - pan)
        right[first + i] += signal * (1 + pan)


def write_wave(path, left, right, target_rms=None, peak_limit=.62):
    """RMS is measured; it is not a BS.1770 integrated-loudness measurement."""
    squares = sum(x * x + y * y for x, y in zip(left, right))
    rms = math.sqrt(squares / (2 * max(1, len(left))))
    peak = max(max(abs(x) for x in left), max(abs(y) for y in right), 1e-9)
    scale = min(target_rms / max(rms, 1e-12), peak_limit / peak) if target_rms else 1.0
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        chunk = bytearray()
        for x, y in zip(left, right):
            chunk.extend(struct.pack('<hh',
                round(max(-.999, min(.999, x * scale)) * 32767),
                round(max(-.999, min(.999, y * scale)) * 32767)))
            if len(chunk) >= 65_536:
                wav.writeframesraw(chunk)
                chunk.clear()
        if chunk:
            wav.writeframesraw(chunk)
    out_rms = rms * scale
    print(f'{path.name}: {len(left) / SR:.3f}s, stereo 48kHz 16-bit, '
          f'RMS {20 * math.log10(max(out_rms, 1e-12)):.2f} dBFS, '
          f'peak {20 * math.log10(max(peak * scale, 1e-12)):.2f} dBFS')


def make_music():
    rng = random.Random(SEED)
    left = array('f', [0]) * N
    right = array('f', [0]) * N
    # Cmaj7, Am7, Fmaj7, G6, Dm7, Em7, Gsus2; gentle seven-bar cycles.
    chords = [(48, 55, 59, 64), (45, 55, 60, 64), (41, 53, 57, 64),
              (43, 55, 59, 64), (45, 53, 57, 60), (47, 55, 59, 62),
              (43, 55, 57, 62)]
    for bar in range(BARS):
        chord = chords[bar % len(chords)]
        start = bar * BAR
        intensity = .88 if bar < 4 or bar >= BARS - 4 else 1.0
        for k, midi in enumerate(chord):
            tone(left, right, start, BAR + .40, midi,
                 .085 * intensity, [-.5, .36, -.18, .52][k])
        for k, beat in enumerate((0.0, 1.5, 3.0)):
            # Sparse, rounded midrange plucks; no bright isolated sine pings.
            midi = chord[(bar + k) % len(chord)] + (12 if k == 1 else 0)
            tone(left, right, start + beat * BEAT + .025, .82, midi,
                 .095 * intensity, (-.28 if k % 2 else .26), pluck=True)
        if 2 <= bar < BARS - 2:
            for beat in range(8):
                percussion(left, right, start + beat * BEAT / 2,
                           .026 if beat % 2 else .020, rng)
            for beat in (0, 2):
                percussion(left, right, start + beat * BEAT,
                           .09, rng, 'body')
    # 2.2s fade in and 3.4s fade out, sine-squared for quiet endpoints.
    fade_in = round(2.2 * SR)
    fade_out = round(3.4 * SR)
    for i in range(fade_in):
        g = math.sin(i / fade_in * math.pi / 2) ** 2
        left[i] *= g
        right[i] *= g
    for i in range(fade_out):
        j = N - 1 - i
        g = math.sin(i / fade_out * math.pi / 2) ** 2
        left[j] *= g
        right[j] *= g
    write_wave(OUT / 'music.wav', left, right, target_rms=10 ** (-21 / 20), peak_limit=.52)


def make_click(name, duration, lowpass, decay_ms, gain, seed):
    rng = random.Random(seed)
    count = round(duration * SR)
    left = array('f', [0]) * count
    right = array('f', [0]) * count
    lp = 0.0
    for i in range(count):
        lp += lowpass * (rng.uniform(-1, 1) - lp)
        t = i / SR
        env = min(1.0, t / .0012) * math.exp(-t / (decay_ms / 1000))
        tail = min(1.0, (duration - t) / .012)
        x = lp * env * tail * gain
        left[i] = x
        right[i] = x * .97
    write_wave(OUT / name, left, right)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    make_music()
    make_click('click-soft.wav', .080, .30, 8, .14, SEED + 1)
    make_click('click-deep.wav', .105, .065, 15, .21, SEED + 2)
    print(f'Original composition: {BPM} BPM, 4/4, {BARS} bars, {DURATION:.1f}s. No listening check performed.')
