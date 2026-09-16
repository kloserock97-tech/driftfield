# Driftfield

A cloud of points living inside a curl-noise flow field, with a lens in front of it. Everything you
can see is on a slider: how many points there are, what the field does to them, and how much of the
result the lens keeps in focus.

**Live demo:** https://kloserock97-tech.github.io/driftfield/

![The cloud at default settings](docs/shot-default.jpg)

## The idea

Nothing here is simulated. There is no particle state, no velocity buffer, no integration step. Each
point knows one thing: where it started. Its position for the current frame is a pure function of
that seed and the clock, evaluated in the vertex shader.

That one decision pays for most of the good behaviour:

- **Time is a number, not a history.** Freeze it, scrub it backwards, jump it forward. The cloud
  reassembles itself exactly, because there is nothing to reassemble.
- **The point count is a slider.** No warm-up, no respawn, no gaps. Drag it from five thousand to two
  hundred thousand and the shape stays the same, just denser.
- **A dropped frame costs nothing.** Skipped time is skipped, not accumulated as drift.

## How the shape happens

The velocity comes from the curl of a noise field. Curl has zero divergence by construction, so the
flow has no sources and no sinks: points never pile into clumps and never drain out of the frame.
The curl is then normalised to unit length, and that single normalisation is why the cloud comes out
round. There is no sphere in the code.

The ragged parts come from folding. Octave zero is the smooth shell, one turn through the field.
Every octave after it folds what is already folded, at twice the frequency and half the weight, and
the last one starts from the shell again so a fine ripple rides on top of the big shreds. Which of
the two a point follows is decided by another noise sample — and the **dissolve** slider slides that
decision across the whole cloud, from an intact bubble to a ball of loose thread.

The choice value is deliberately left unclamped. It swings past zero and past one, and out there the
blend stops blending and extrapolates: points get thrown outside the shell. That overshoot is the
whole reason the edge looks torn instead of moulded.

## The lens

The depth of field is fake and costs almost nothing. A point's size is its distance from the plane of
focus, and its brightness falls with the same distance. A point in focus is a tight bright dot; a
point far from it swells into a pale disc. That is what a real circle of confusion does — the same
light spread over a larger area — and it is two lines of shader.

The discs are drawn with alpha blending rather than additive. Additive has no ceiling: fifty discs at
four hundredths each add up to two and anything dense burns out to flat white. Alpha saturates, so
the same fifty layers land at 0.87, and the cloud keeps both its soft haze and its sharp grain.

## Controls

| Group | What it does |
| --- | --- |
| **points** | how many are drawn, 5k to 200k |
| **seed spread** | how far apart neighbours sit in the noise: coarse shreds or fine ones |
| **radius** | size of the cloud in world units |
| **frequency** | field scale: low is smooth sheets, high is tangled thread |
| **speed** | how fast the field moves through itself |
| **dissolve** | intact shell → unwound strands |
| **octaves** | how many times the field folds itself |
| **sampling** | 6 probes per curl (accurate) or 3 (about a third cheaper) |
| **focus / aperture** | plane of focus and how fast things blur away from it |
| **point size / opacity / colours** | the rest of the look |

`H` hides the panel, `Space` freezes time, drag to orbit, scroll to zoom.

Five presets are included (bubble, nebula, threads, ember, ink). **Copy link to this look** puts the
whole setup in the address bar, so a version you liked can be sent to someone as a plain URL.

| nebula | threads | ink |
| --- | --- | --- |
| ![nebula](docs/shot-nebula.jpg) | ![threads](docs/shot-threads.jpg) | ![ink](docs/shot-ink.jpg) |

## Performance

One draw call of `gl.POINTS`. The cost is almost entirely noise sampling in the vertex shader: with
six probes and five octaves a point costs about 90 noise evaluations per frame, and that is the number
to watch. If the frame rate drops, the two useful dials are **octaves** and **sampling** — each step
down roughly halves the work, and the shape survives both.

On an Intel Arc integrated GPU the defaults (80k points, six probes, five octaves) run at over 100 fps
at 1368×775.

## Running it

Node 22 or newer.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site into dist/
npm run preview
```

`.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages on every push to `main`.

Three files matter: `src/field.glsl.js` is the field and the lens as shader source,
`src/main.js` wires the scene and the panel, `src/settings.js` holds defaults, presets and the URL
encoding. No models, no textures, no data files — the whole thing is code.

## Prior art

Particles in a curl-noise field with a fake depth of field is a known recipe; this is my own
implementation of it, written from scratch with its own noise, its own folding scheme and its own
parameter set. Built with [three.js](https://threejs.org) and [lil-gui](https://lil-gui.georgealways.com).

## Licence

MIT — see [LICENSE](LICENSE).

Nikita Gorbachev · kloserock97@gmail.com ·
[LinkedIn](https://www.linkedin.com/in/nikita-gorbachev-productdesigner)
