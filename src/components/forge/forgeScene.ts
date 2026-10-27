// 金粉成爻的 three 場景，只由 LineForge 以 import() 載入，不進卦殿首屏。
// 每一爻同時最多有一組聚合中的金粉與幾組散去中的金粉；換陰陽或清除時舊的那組向上散去，新的一組由下方升起。
// 座標是 CSS 像素、原點在畫布左下角，爻的位置由 LineForge 量 DOM 給出，所以版面變了只要重量一次。

import * as THREE from 'three'
import { FORGE_FRAG, FORGE_VERT } from './forgeShaders.ts'

export interface ForgeRect { x: number; y: number; w: number; h: number }
export interface ForgeSlot { bit: 0 | 1 | null; moving: boolean }
export interface ForgeScene {
  /** immediate：不播聚合動畫，直接顯示（剛建好場景、或從草稿恢復時） */
  set(slots: readonly ForgeSlot[], immediate?: boolean): void
  dispose(): void
}

const ASSEMBLE_S = 0.95
const DISPERSE_S = 0.75
const COLS = 96, ROWS = 7
// sRGB 數值直接輸出，不經 THREE.Color 的色彩管理（否則會被轉成線性值而變暗）
const rgb = (hex: number) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255)
const GOLD = rgb(0xd6bb85)
const VERMILION = rgb(0xd98b77)

// 固定種子：同一種爻每次的金粉分布相同，畫面才不會每次重畫都抖
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 在 0..1 的方格內抖動取點，填滿一爻；陰爻中段（42% 到 58%）留空
function lineGeometry(bit: 0 | 1) {
  const rand = seeded(bit ? 11 : 7)
  const units: number[] = [], seeds: number[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const u = (c + rand()) / COLS, v = (r + rand()) / ROWS
      if (bit === 0 && u > 0.42 && u < 0.58) continue
      units.push(u, v, 0)
      seeds.push(rand(), rand() * 2 - 1, rand())
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(units, 3))
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 3))
  return g
}

interface Strand { key: string; points: THREE.Points; material: THREE.ShaderMaterial; line: number }

export function createForgeScene(host: HTMLElement, measure: () => ForgeRect[], onError: (msg: string) => void): ForgeScene | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' })
  } catch (e) {
    onError('瀏覽器無法建立 WebGL：' + (e as Error).message)
    return null
  }
  const dpr = Math.min(devicePixelRatio, 2)
  renderer.setPixelRatio(dpr)
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.setAttribute('aria-hidden', 'true')
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1)
  const geometries = { 0: lineGeometry(0), 1: lineGeometry(1) }
  let rects: ForgeRect[] = []
  let height = 0
  const current: (Strand | null)[] = [null, null, null, null, null, null]
  const leaving: Strand[] = []

  function rectUniform(line: number) {
    const r = rects[line]
    // DOM 的 y 由上往下；畫布原點在左下
    return r ? new THREE.Vector4(r.x, height - r.y - r.h, r.w, r.h) : new THREE.Vector4(0, 0, 0, 0)
  }

  function place(s: Strand) {
    const r = rects[s.line]
    s.material.uniforms.uRect.value = rectUniform(s.line)
    s.material.uniforms.uSize.value = Math.max(2.2, (r?.h ?? 12) / 4.2) * dpr
    s.material.uniforms.uRise.value = 36 + (r?.h ?? 12) * 3
  }

  function resize() {
    const w = host.clientWidth, h = host.clientHeight
    if (!w || !h) return
    height = h
    renderer.setSize(w, h, false)
    camera.right = w
    camera.top = h
    camera.updateProjectionMatrix()
    rects = measure()
    for (const s of current) if (s) place(s)
    for (const s of leaving) place(s)
    wake()
  }

  function strand(line: number, slot: ForgeSlot & { bit: 0 | 1 }, progress: number): Strand {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uRect: { value: new THREE.Vector4() },
        uProgress: { value: progress },
        uTime: { value: 0 },
        uSize: { value: 3 },
        uRise: { value: 48 },
        uColor: { value: slot.moving ? VERMILION : GOLD },
      },
      vertexShader: FORGE_VERT,
      fragmentShader: FORGE_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const points = new THREE.Points(geometries[slot.bit], material)
    // 頂點在著色器裡才換算成像素座標，包圍球不準，關掉視錐剔除
    points.frustumCulled = false
    scene.add(points)
    const s: Strand = { key: `${slot.bit}${slot.moving ? 'm' : ''}`, points, material, line }
    place(s)
    return s
  }

  function drop(s: Strand) {
    scene.remove(s.points)
    s.material.dispose()
  }

  function set(slots: readonly ForgeSlot[], immediate = false) {
    rects = measure()
    slots.forEach((slot, i) => {
      const key = slot.bit === null ? '' : `${slot.bit}${slot.moving ? 'm' : ''}`
      const was = current[i]
      if ((was?.key ?? '') === key) return
      if (was) {
        if (immediate) drop(was)
        else {
          was.material.uniforms.uProgress.value = Math.max(1, was.material.uniforms.uProgress.value)
          leaving.push(was)
        }
      }
      current[i] = slot.bit === null ? null : strand(i, slot as ForgeSlot & { bit: 0 | 1 }, immediate ? 1 : 0)
    })
    wake()
  }

  let raf = 0, last = 0, elapsed = 0, lastDraw = 0, visible = true, disposed = false
  function frame(now: number) {
    raf = 0
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0
    last = now
    elapsed += dt
    let busy = leaving.length > 0
    for (const s of current) {
      if (!s) continue
      const u = s.material.uniforms
      if (u.uProgress.value < 1) { u.uProgress.value = Math.min(1, u.uProgress.value + dt / ASSEMBLE_S); busy = true }
      u.uTime.value = elapsed
    }
    for (let k = leaving.length - 1; k >= 0; k--) {
      const u = leaving[k].material.uniforms
      u.uProgress.value += dt / DISPERSE_S
      u.uTime.value = elapsed
      if (u.uProgress.value >= 2) { drop(leaving[k]); leaving.splice(k, 1) }
    }
    // 靜止時只剩閃爍，降到每秒約 15 格
    if (busy || now - lastDraw > 66) {
      renderer.render(scene, camera)
      lastDraw = now
    }
    if (visible && !disposed) raf = requestAnimationFrame(frame)
  }
  function wake() {
    if (!raf && visible && !disposed) { last = 0; raf = requestAnimationFrame(frame) }
  }
  function sleep() {
    cancelAnimationFrame(raf)
    raf = 0
  }

  // 離開畫面或分頁隱藏時停止繪製
  let onScreen = true
  const sync = () => {
    visible = onScreen && document.visibilityState === 'visible'
    if (visible) wake()
    else sleep()
  }
  const io = new IntersectionObserver(entries => { onScreen = entries.some(e => e.isIntersecting); sync() })
  io.observe(host)
  document.addEventListener('visibilitychange', sync)
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  const onLost = (e: Event) => { e.preventDefault(); onError('WebGL 已中斷') }
  renderer.domElement.addEventListener('webglcontextlost', onLost)
  resize()

  return {
    set,
    dispose() {
      if (disposed) return
      disposed = true
      sleep()
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', sync)
      renderer.domElement.removeEventListener('webglcontextlost', onLost)
      for (const s of [...current, ...leaving]) if (s) drop(s)
      geometries[0].dispose()
      geometries[1].dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
