// 金粉成爻（規格「經冊與畫卦」）：每顆金粉有自己在爻內的位置（position.xy，0 到 1）、延遲、漂移與閃爍相位。
// 位置放在 position 而不是自訂屬性，three 才算得出要畫幾個點。
// uProgress 0 → 1：由爻的下方升起，聚成一爻；1 → 2：向上散去並淡出（換陰陽或清除時）。
// 座標單位是 CSS 像素，原點在畫布左下角；uRect 是這一爻在畫布上的位置。

export const FORGE_VERT = /* glsl */ `
uniform vec4 uRect;
uniform float uProgress, uTime, uSize, uRise;
attribute vec3 aSeed;
varying float vAlpha;
varying float vTwinkle;
float easeOut(float t) { return 1.0 - pow(1.0 - t, 3.0); }
void main() {
  vec2 target = uRect.xy + position.xy * uRect.zw;
  float delay = aSeed.x * 0.45;
  vec2 pos;
  float alpha;
  if (uProgress <= 1.0) {
    float t = clamp((uProgress - delay) / 0.55, 0.0, 1.0);
    float e = easeOut(t);
    vec2 start = target + vec2(aSeed.y * uRect.w * 3.0, -uRise * (0.6 + aSeed.x));
    pos = mix(start, target, e);
    pos.x += sin(uTime * 2.0 + aSeed.z * 6.2832) * (1.0 - e) * 6.0;
    alpha = smoothstep(0.0, 0.35, t);
  } else {
    float t = clamp((uProgress - 1.0 - delay * 0.5) / 0.6, 0.0, 1.0);
    pos = target + vec2(aSeed.y * uRect.w * 2.0 * t, uRise * 0.8 * t * (0.5 + aSeed.x));
    alpha = 1.0 - t;
  }
  vAlpha = alpha;
  vTwinkle = 0.8 + 0.2 * sin(uTime * 1.6 + aSeed.z * 6.2832);
  gl_PointSize = uSize * (0.7 + aSeed.z * 0.6);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
}`

export const FORGE_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vTwinkle;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.18, r) * vAlpha * vTwinkle;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * (0.88 + 0.24 * (0.5 - r)), a);
}`
