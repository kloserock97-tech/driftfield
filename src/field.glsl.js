/* The flow field, as shader source.
 *
 * Both stages are plain GLSL strings so the interesting part of this project sits in one file you
 * can read top to bottom. The number of octaves and the number of curl probes arrive as #defines:
 * changing them rebuilds the program, which costs a few milliseconds once and keeps the inner loops
 * fully unrolled. */

export const vertexShader = /* glsl */ `
precision highp float;

attribute vec3 aSeed;

uniform float uTime;        // seconds, scaled by speed on the CPU side
uniform float uCurl;        // field frequency: low is smooth sheets, high is thin tangled thread
uniform float uDissolve;    // 0 keeps the shell, 1 unwinds the whole cloud into strands
uniform float uRadius;      // cloud size in world units
uniform float uFocus;       // distance from the camera to the plane of focus
uniform float uAperture;    // 1 to 5.6, same direction as a real lens: bigger number, less blur
uniform float uScreenScale; // viewport height / (2 tan(fov/2)): world units to pixels at depth 1
uniform float uPointScale;  // user multiplier on top of the optical size

varying float vLevel;

/* One pixel of bokeh, expressed as a fraction of the cloud radius. The number is not derived from
   the projection, it is measured: a point at one unit of defocus with the aperture wide open covers
   about that much of the cloud on screen. */
const float PIX = 1.0 / 1250.0;

vec3 hash33(vec3 p)
{
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));

    return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

/* Gradient noise with the quintic fade, the usual construction. Values land in about -1 to 1. */
float gnoise(vec3 p)
{
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    return mix(mix(mix(dot(hash33(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
                       dot(hash33(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
                   mix(dot(hash33(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
                       dot(hash33(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x), u.y),
               mix(mix(dot(hash33(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
                       dot(hash33(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
                   mix(dot(hash33(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
                       dot(hash33(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

vec3 gnoise3(vec3 p)
{
    return vec3(gnoise(p), gnoise(p + 31.416), gnoise(p - 17.234));
}

/* Curl of the noise field.
 *
 * Velocity taken as the curl of a potential has zero divergence by construction, so the flow has no
 * sources and no sinks: points never pile up in clumps and never drain away. The result is
 * normalised, and that normalisation is the whole reason the cloud comes out as a sphere. There is
 * no sphere anywhere in this file.
 *
 * With PROBES 6 the derivatives are central differences (two probes per axis). With PROBES 3 they
 * are forward differences against a single sample at the centre: a third cheaper, slightly softer. */
vec3 curl(vec3 p)
{
    vec3 sum = vec3(0.0);

    #if PROBES == 3
        vec3 here = gnoise3(p);

        for(int i = 0; i < 3; i++)
        {
            vec3 axis = vec3(float(i == 0), float(i == 1), float(i == 2));
            sum += cross(axis, gnoise3(p + axis * 0.1) - here);
        }
    #else
        for(int i = 0; i < 6; i++)
        {
            int a = i / 2;
            vec3 axis = vec3(float(a == 0), float(a == 1), float(a == 2));
            float s = (i - a * 2 == 1) ? 1.0 : -1.0;
            sum += cross(axis, gnoise3(p + axis * (s * 0.1))) * s;
        }
    #endif

    return normalize(sum);
}

/* Where a point that started at "seed" ends up.
 *
 * Octave zero is the smooth shell: one turn through the field. Every octave after it folds what is
 * already folded, at twice the frequency and half the weight, and the last one starts from the shell
 * again so the fine ripple rides on top of the big shreds. Which of the two a point follows is
 * decided by another noise sample, and "dissolve" slides that decision across the whole cloud.
 *
 * The choice value is deliberately not clamped. It swings past zero and past one, and outside that
 * range the mix stops mixing and extrapolates: points get thrown out beyond the shell. That overshoot
 * is what makes the edge ragged instead of a clean ball. */
vec3 field(vec3 seed)
{
    vec3 shell = vec3(0.0);
    vec3 wisps = vec3(0.0);
    float scale = 1.0;
    float weight = 1.0;

    for(int o = 0; o < OCTAVES; o++)
    {
        vec3 base = wisps;
        if(o == 0) base = seed;
        if(o == OCTAVES - 1 && OCTAVES > 1) base = shell;

        vec3 point = base * uCurl * scale;
        if(o == 0) point += uTime;

        vec3 turn = curl(point);

        if(o == 0)
        {
            shell = turn;
            wisps = turn;
        }
        else
        {
            wisps += turn * weight;
        }

        scale *= 2.0;
        weight = (o == 0) ? 0.5 : weight * 0.5;
    }

    float choice = gnoise(shell + uTime) + uDissolve;

    return mix(shell, wisps, choice);
}

void main()
{
    vec3 local = field(aSeed) * uRadius;

    vec4 viewPosition = modelViewMatrix * vec4(local, 1.0);
    float depth = -viewPosition.z;

    /* Defocus is measured in cloud radii, not world units: the cloud is meant to be resized, and a
       small one would otherwise sit entirely inside the depth of field while a big one turned to soup. */
    float defocus = abs(depth - uFocus) / max(uRadius, 0.0001);

    /* The circle of confusion grows with distance from the plane of focus, and the aperture sets how
       fast. Same shape as a lens: at 5.6 the cloud is nearly all sharp, wide open it is mostly haze. */
    float blur = (5.6 - uAperture) * 9.0;
    float spot = max(defocus * blur * PIX, PIX) * uRadius * uPointScale;

    /* Brightness falls with the same defocus, which is what a real lens does: the same light spread
       over a larger disc. Sharp grain on top of soft haze comes out of this one line. */
    vLevel = 1.04 - clamp(defocus * 1.5, 0.0, 1.0);

    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(spot * uScreenScale / max(depth, 0.001), 1.0, 220.0);
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform float uOpacity;

varying float vLevel;

void main()
{
    /* A disc, not a square: bokeh takes the shape of the aperture, and square apertures are not a thing. */
    vec2 offset = gl_PointCoord * 2.0 - 1.0;
    float disc = smoothstep(1.0, 0.86, length(offset));

    float alpha = disc * vLevel * uOpacity;
    if(alpha <= 0.002) discard;

    gl_FragColor = vec4(uColor, alpha);
}
`;
