// 全息卡 shader：移植自 webgl-holo-card 的 viewer 模板（分層視差、鐳射、掃光、星光、線稿發光）。
// 差異：卡框與文字已畫在 tText 圖層，不再由 shader 畫框；多一個平面模式（uFlat）
// 給尚未繪製插圖的佔位卡與牌背；uFade 用於換牌時的淡入。

export const VERT = /* glsl */ `
uniform vec3 uCam;
varying vec2 vUv;
varying vec3 vView;
void main() {
  vUv = uv;
  vView = uCam - position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const COMMON = /* glsl */ `
uniform float uTime, uFoil, uDepth, uSparkle, uGlow, uFlat, uFade;
varying vec2 vUv;
varying vec3 vView;

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 spectrum(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
vec3 softLight(vec3 b, vec3 s) { return mix(2.0 * b * s + b * b * (1.0 - 2.0 * s), sqrt(b) * (2.0 * s - 1.0) + 2.0 * b * (1.0 - s), step(0.5, s)); }
float inside01(vec2 p) { vec2 q = step(vec2(0.0), p) * step(p, vec2(1.0)); return q.x * q.y; }
vec2 tiltOffset(vec3 V) { return V.xy / max(V.z, 0.35); }
// 鐳射色帶偏向古金與灰青，配合低飽和的礦物色卡面
vec3 foilColor(vec2 uv, vec3 V) {
  vec2 a = uv * vec2(1.0, 1.4) + V.xy * 1.8;
  float t = dot(a, vec2(0.83, 0.55)) * 1.6 + vnoise(a * 3.2) * 0.55 + uTime * 0.015;
  return mix(spectrum(t), vec3(0.95, 0.86, 0.66), 0.45);
}
float sheen(vec2 uv, vec3 V) {
  float s = sin((uv.x * 0.9 + uv.y * 0.5 + V.x * 2.4 + V.y * 1.4) * 6.28318);
  return pow(max(s, 0.0), 12.0);
}
float sparkle(vec2 uv, vec3 V) {
  vec2 g = uv * vec2(60.0, 84.0);
  vec2 id = floor(g), f = fract(g) - 0.5;
  float h = hash12(id);
  vec2 o = (vec2(hash12(id + 17.0), hash12(id + 31.0)) - 0.5) * 0.6;
  vec2 d = abs(f - o);
  float core = smoothstep(0.10, 0.0, length(f - o));
  float rays = smoothstep(0.035, 0.0, min(d.x, d.y)) * smoothstep(0.45, 0.0, max(d.x, d.y));
  float twinkle = pow(0.5 + 0.5 * sin(h * 80.0 + V.x * 40.0 + V.y * 31.0 + uTime * 1.3), 10.0);
  return step(0.88, h) * (core + rays * 0.6) * twinkle;
}
float glare(vec2 uv, vec3 V) {
  vec2 c = vec2(0.5) - V.xy * 1.3;
  return smoothstep(0.85, 0.0, length((uv - c) * vec2(1.0, 0.75)));
}
const vec3 LINE_TINT = vec3(1.0, 0.92, 0.74);
`

export const FACE = COMMON + /* glsl */ `
uniform sampler2D tBackground, tSubject, tFx, tText, tFace;
void main() {
  vec3 V = normalize(vView);
  vec2 uv = vUv;
  vec3 foil = foilColor(uv, V);
  float sh = sheen(uv, V);
  vec3 col;
  if (uFlat > 0.5) {
    col = texture2D(tFace, uv).rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, softLight(col, foil), uFoil * 0.45);
    col += foil * sh * uFoil * 0.22 * (0.3 + lum);
    col += vec3(0.95, 0.9, 0.8) * sparkle(uv, V) * uSparkle * 0.6;
  } else {
    vec2 off = tiltOffset(V);
    // 背景在卡面後方反向位移，放大 14% 留邊；主體浮在前方同向位移
    vec2 bu = (uv - 0.5) / 1.14 + 0.5 - off * 0.060 * uDepth;
    vec2 su = uv + off * 0.040 * uDepth;
    vec3 bg = texture2D(tBackground, bu).rgb;
    float lum = dot(bg, vec3(0.299, 0.587, 0.114));
    bg = mix(bg, softLight(bg, foil), uFoil * 0.65);
    bg += foil * sh * uFoil * 0.30 * (0.35 + lum);
    bg += vec3(0.95, 0.9, 0.8) * sparkle(bu, V) * uSparkle;
    vec2 shadowUv = su + vec2(0.010, -0.014);
    bg *= 1.0 - texture2D(tSubject, shadowUv).a * inside01(shadowUv) * 0.35 * min(uDepth, 1.0);
    vec4 sub = texture2D(tSubject, su);
    sub.a *= inside01(su);
    vec3 sc = mix(sub.rgb, softLight(sub.rgb, foil), uFoil * 0.16) + foil * sh * uFoil * 0.07;
    col = mix(bg, sc, sub.a);
    float line = texture2D(tFx, su).r * inside01(su);
    col += mix(LINE_TINT, foil, 0.5) * line * (0.25 + 1.2 * sh) * uGlow;
    vec4 tx = texture2D(tText, uv);
    // 金框也吃一點掃光，像金屬
    float gold = tx.a * smoothstep(0.35, 0.75, tx.r) * step(tx.b, tx.r * 0.9);
    col = mix(col, tx.rgb, tx.a) + gold * sh * 0.35;
  }
  col += glare(uv, V) * 0.07 * (0.5 + uFoil);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * uFade, 1.0);
}`

export const EDGE = COMMON + /* glsl */ `
void main() {
  vec3 V = normalize(vView);
  float sh = sheen(vUv * 0.2, V);
  gl_FragColor = vec4(clamp(vec3(0.62, 0.5, 0.3) + foilColor(vUv * 0.1, V) * 0.18 + sh * 0.3, 0.0, 1.0), 1.0);
}`
