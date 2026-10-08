import math, random, struct, sys, wave
out = sys.argv[1]
SR = 44100
def make(name, freq, decay, noise_mix, seed):
    rnd = random.Random(seed)
    n = int(SR * 3.0)
    buf = [0.0] * n
    t = 0.02
    while t < 2.9:
        start = int(t * SR)
        amp = 0.35 + rnd.random() * 0.25
        f = freq * (0.85 + rnd.random() * 0.3)
        # key down then a softer key up 60-90 ms later
        for hit, a in ((0, amp), (int(SR * (0.06 + rnd.random() * 0.03)), amp * 0.35)):
            for i in range(int(SR * 0.04)):
                j = start + hit + i
                if j >= n: break
                env = math.exp(-i / (SR * decay))
                tone = math.sin(2 * math.pi * f * i / SR)
                buf[j] += a * env * ((1 - noise_mix) * tone + noise_mix * (rnd.random() * 2 - 1))
        gap = rnd.choice([0.09, 0.11, 0.13, 0.15, 0.18, 0.22, 0.35])
        t += gap
    peak = max(abs(x) for x in buf) or 1
    with wave.open(f"{out}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(x / peak * 0.8 * 32767)) for x in buf))
make("clicky", 3200, 0.0025, 0.65, 1)
make("thock", 260, 0.006, 0.35, 2)
