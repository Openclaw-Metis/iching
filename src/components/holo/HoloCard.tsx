import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { cardAsset, deckBack, hasArt } from '../../data/cards.ts'
import { EDGE, FACE, VERT } from './shaders.ts'

/** 卡背可以是另一張卦牌（例如錯卦），或統一的牌背 */
export type BackFace = { kind: 'card'; number: number } | { kind: 'deck' }

interface Props {
  front: number
  back: BackFace
  flipped: boolean
  /** 牌面在平面內轉 180°：卦象上下顛倒即成綜卦 */
  rolled: boolean
  /** 卡牌往前湊近：看進卦的中間四爻，即成互卦 */
  dived?: boolean
  onDoubleClick?: () => void
  label: string
}

const CARD_W = 2.5, CARD_H = 3.5, CARD_T = 0.035, RADIUS = 0.12
const MAX_TILT = THREE.MathUtils.degToRad(20)
const REST = { yaw: THREE.MathUtils.degToRad(-7), pitch: THREE.MathUtils.degToRad(4) }
// 湊近的距離：相機約在 7.9 外，前移 0.7 讓卡牌放大約一成；再多卡角會超出畫布（卡牌原本佔畫布高的 89%）
const DIVE_Z = 0.7

type FaceUniforms = Record<string, THREE.IUniform>

const loader = new THREE.TextureLoader()
const cache = new Map<string, Promise<THREE.Texture>>()
function texture(url: string): Promise<THREE.Texture> {
  let hit = cache.get(url)
  if (!hit) {
    hit = loader.loadAsync(url).then(tex => {
      tex.colorSpace = THREE.NoColorSpace // 直接以 sRGB 數值合成，與原圖顏色一致
      tex.anisotropy = 8
      return tex
    })
    hit.catch(() => cache.delete(url))
    cache.set(url, hit)
  }
  return hit
}

const BLANK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
BLANK.needsUpdate = true

const SAMPLERS = ['tBackground', 'tSubject', 'tFx', 'tText', 'tFace'] as const
type FaceTextures = { flat: boolean } & Partial<Record<(typeof SAMPLERS)[number], THREE.Texture>>

async function faceTextures(face: BackFace): Promise<FaceTextures> {
  if (face.kind === 'deck') return { flat: true, tFace: await texture(deckBack) }
  const n = face.number
  if (!hasArt(n)) return { flat: true, tFace: await texture(cardAsset(n, 'face')) }
  const [tBackground, tSubject, tFx, tText] = await Promise.all(
    (['background', 'subject', 'fx', 'text'] as const).map(layer => texture(cardAsset(n, layer))),
  )
  return { flat: false, tBackground, tSubject, tFx, tText }
}

function applyFace(u: FaceUniforms, t: FaceTextures) {
  u.uFlat.value = t.flat ? 1 : 0
  for (const name of SAMPLERS) u[name].value = t[name] ?? BLANK
  // 平面卡沒有景深可言，鐳射也收斂一些
  u.uFoil.value = t.flat ? 0.32 : 0.42
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2, y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y)
  return s
}

// ShapeGeometry 的 uv 是形狀座標，改成 0..1 才能對應圖層；要在旋轉、平移之前做
function remapUV(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox()
  const b = geo.boundingBox!, pos = geo.attributes.position, uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - b.min.x) / (b.max.x - b.min.x), (pos.getY(i) - b.min.y) / (b.max.y - b.min.y))
  }
  uv.needsUpdate = true
}

interface Engine {
  setFront(face: BackFace): void
  setBack(face: BackFace): void
  state: { flipped: boolean; rolled: boolean; dived: boolean; onDouble?: () => void }
  dispose(): void
}

function createEngine(stage: HTMLElement, onError: (msg: string) => void, onReady: () => void): Engine | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  } catch (e) {
    onError('瀏覽器無法建立 WebGL：' + (e as Error).message)
    return null
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  stage.appendChild(renderer.domElement)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  const shared = {
    uCam: { value: new THREE.Vector3(0, 0, 10) },
    uTime: { value: 0 },
    uDepth: { value: 1.0 }, uSparkle: { value: 0.35 }, uGlow: { value: 0.45 },
  }
  const makeFace = (): FaceUniforms => ({
    ...shared,
    uFoil: { value: 0.42 }, uFlat: { value: 1 }, uFade: { value: 0 },
    tBackground: { value: BLANK }, tSubject: { value: BLANK }, tFx: { value: BLANK }, tText: { value: BLANK }, tFace: { value: BLANK },
  })
  const frontU = makeFace(), backU = makeFace()
  const material = (u: FaceUniforms, frag: string) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: frag })

  const shape = roundedRect(CARD_W, CARD_H, RADIUS)
  const frontGeo = new THREE.ShapeGeometry(shape, 24)
  remapUV(frontGeo); frontGeo.translate(0, 0, CARD_T / 2)
  const backGeo = new THREE.ShapeGeometry(shape, 24)
  remapUV(backGeo); backGeo.rotateY(Math.PI); backGeo.translate(0, 0, -CARD_T / 2)
  const edgeGeo = new THREE.ExtrudeGeometry(shape, { depth: CARD_T, bevelEnabled: false, curveSegments: 24 })
  edgeGeo.translate(0, 0, -CARD_T / 2)
  const materials = [material(frontU, FACE), material(backU, FACE), material({ ...shared, uFoil: { value: 0.4 }, uFlat: { value: 0 }, uFade: { value: 1 } }, EDGE)]
  const hidden = new THREE.MeshBasicMaterial({ visible: false })

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
  const card = new THREE.Group()
  card.add(new THREE.Mesh(frontGeo, materials[0]))
  card.add(new THREE.Mesh(backGeo, materials[1]))
  card.add(new THREE.Mesh(edgeGeo, [hidden, materials[2]]))
  scene.add(card)

  const state = { flipped: false, rolled: false, dived: false, onDouble: undefined as undefined | (() => void) }
  const motion = { yaw: REST.yaw, pitch: REST.pitch, roll: 0, z: 0, tYaw: REST.yaw, tPitch: REST.pitch, pressed: false }
  const inverse = new THREE.Matrix4()

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const dist = Math.max((CARD_H / 2 * 1.12) / tan, (CARD_W / 2 * 1.12) / (tan * camera.aspect))
    camera.position.set(0, 0, dist)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }

  function render(time: number) {
    card.rotation.set(motion.pitch, motion.yaw, motion.roll)
    card.position.z = motion.z
    card.updateMatrixWorld(true)
    shared.uCam.value.copy(camera.position).applyMatrix4(inverse.copy(card.matrixWorld).invert())
    shared.uTime.value = time
    renderer.render(scene, camera)
  }

  const rest = () => { motion.tYaw = REST.yaw; motion.tPitch = REST.pitch }
  function pointerTilt(e: PointerEvent) {
    const r = stage.getBoundingClientRect()
    const span = Math.min(r.width, r.height) * 0.45
    motion.tYaw = THREE.MathUtils.clamp((e.clientX - r.left - r.width / 2) / span, -1, 1) * MAX_TILT
    motion.tPitch = THREE.MathUtils.clamp((e.clientY - r.top - r.height / 2) / span, -1, 1) * MAX_TILT * 0.8
  }
  const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse' || motion.pressed) pointerTilt(e) }
  const onDown = (e: PointerEvent) => { motion.pressed = true; stage.setPointerCapture(e.pointerId); pointerTilt(e) }
  const onUp = (e: PointerEvent) => { motion.pressed = false; if (e.pointerType !== 'mouse') rest() }
  const onLeave = () => { if (!motion.pressed) rest() }
  const onDbl = () => state.onDouble?.()
  stage.addEventListener('pointermove', onMove)
  stage.addEventListener('pointerdown', onDown)
  stage.addEventListener('pointerup', onUp)
  stage.addEventListener('pointercancel', onUp)
  stage.addEventListener('pointerleave', onLeave)
  stage.addEventListener('dblclick', onDbl)
  const observer = new ResizeObserver(resize)
  observer.observe(stage)
  resize()

  let raf = 0, last = performance.now(), elapsed = 0, readySent = false, disposed = false
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    elapsed += dt
    // 正面換牌淡出期間維持原姿勢：倒轉或翻面後換卦時，若先轉回正面會短暫露出舊牌
    if (fadeTarget.get(frontU) !== 0) {
      const ease = reduced ? 1 : 1 - Math.exp(-dt * 6)
      motion.yaw += ((state.flipped ? Math.PI : 0) + motion.tYaw - motion.yaw) * ease
      motion.pitch += (motion.tPitch - motion.pitch) * ease
      motion.roll += ((state.rolled ? Math.PI : 0) - motion.roll) * (reduced ? 1 : 1 - Math.exp(-dt * 4))
      motion.z += ((state.dived ? DIVE_Z : 0) - motion.z) * (reduced ? 1 : 1 - Math.exp(-dt * 3))
    }
    for (const u of [frontU, backU]) {
      u.uFade.value += ((fadeTarget.get(u) ?? 0) - u.uFade.value) * (reduced ? 1 : 1 - Math.exp(-dt * 9))
      const swap = pendingSwap.get(u)
      if (swap && u.uFade.value < 0.04) { pendingSwap.delete(u); swap() }
    }
    render(reduced ? 0 : elapsed)
    if (!readySent && frontU.uFade.value > 0.9) { readySent = true; onReady() }
    raf = requestAnimationFrame(frame)
  }
  const fadeTarget = new Map<FaceUniforms, number>()
  const pendingSwap = new Map<FaceUniforms, () => void>()
  raf = requestAnimationFrame(frame)

  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); onError('WebGL 已中斷，請重新整理頁面。') })

  // 換牌時先淡出、等畫面暗下來再換貼圖並淡入；同時有新的請求時只採用最後一次。
  // 正面換牌的瞬間把翻面、平面旋轉與湊近一起歸位，倒轉、翻面或看互卦後換上的新牌才會是正面朝上
  function faceLoader(u: FaceUniforms, settlePose: boolean) {
    let token = 0
    return (face: BackFace) => {
      const mine = ++token
      fadeTarget.set(u, 0)
      faceTextures(face).then(t => {
        if (mine !== token) return
        pendingSwap.set(u, () => {
          applyFace(u, t)
          if (settlePose) {
            motion.yaw = (state.flipped ? Math.PI : 0) + motion.tYaw
            motion.roll = state.rolled ? Math.PI : 0
            motion.z = state.dived ? DIVE_Z : 0
          }
          fadeTarget.set(u, 1)
        })
      }).catch(err => onError('卡牌貼圖載入失敗：' + (err as Error).message))
    }
  }

  // 驗證用：可重現地設定角度
  ;(window as unknown as { __holo: unknown }).__holo = {
    setTilt(yawDeg: number, pitchDeg: number) {
      motion.tYaw = THREE.MathUtils.degToRad(yawDeg); motion.tPitch = THREE.MathUtils.degToRad(pitchDeg)
    },
    get ready() { return frontU.uFade.value > 0.9 },
  }

  return {
    setFront: faceLoader(frontU, true),
    setBack: faceLoader(backU, false),
    state,
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerdown', onDown)
      stage.removeEventListener('pointerup', onUp)
      stage.removeEventListener('pointercancel', onUp)
      stage.removeEventListener('pointerleave', onLeave)
      stage.removeEventListener('dblclick', onDbl)
      for (const g of [frontGeo, backGeo, edgeGeo]) g.dispose()
      for (const m of [...materials, hidden]) m.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

// WebGL 不能用或任一層貼圖載入失敗時，改顯示目前看得到的那一面的平面卡圖（仍維持 5:7）
function flatImage(front: number, back: BackFace, flipped: boolean) {
  if (!flipped) return cardAsset(front, 'thumb')
  return back.kind === 'deck' ? deckBack : cardAsset(back.number, 'thumb')
}

const FLAT_NOTE = '這個瀏覽器無法顯示全息效果，改用平面卡圖。'

export function HoloCard({ front, back, flipped, rolled, dived = false, onDoubleClick, label }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const engine = useRef<Engine | null>(null)
  const [flat, setFlat] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const e = createEngine(stageRef.current!, msg => {
      console.warn(`[WEBGL_UNAVAILABLE] ${msg}`)
      setFlat(true)
    }, () => setReady(true))
    engine.current = e
    return () => { e?.dispose(); engine.current = null }
  }, [])

  // 改用平面卡圖後就釋放 WebGL 資源，之後的換牌只換圖片
  useEffect(() => {
    if (!flat) return
    engine.current?.dispose()
    engine.current = null
  }, [flat])

  useEffect(() => { engine.current?.setFront({ kind: 'card', number: front }) }, [front])
  // back 每次 render 都是新物件，以內容當依賴，避免重複載入
  const backKey = back.kind === 'card' ? back.number : 'deck'
  useEffect(() => { engine.current?.setBack(back) }, [backKey])
  useEffect(() => {
    if (!engine.current) return
    engine.current.state.flipped = flipped
    engine.current.state.rolled = rolled
    engine.current.state.dived = dived
    engine.current.state.onDouble = onDoubleClick
  }, [flipped, rolled, dived, onDoubleClick])

  return (
    <div className="holo-stage" ref={stageRef} role="img" aria-label={label} data-flat={flat || undefined}>
      {flat && (
        <>
          <img
            className="holo-flat"
            src={flatImage(front, back, flipped)}
            alt=""
            width={400}
            height={560}
            data-rolled={rolled || undefined}
            data-dived={dived || undefined}
            onDoubleClick={onDoubleClick}
          />
          <p className="holo-flat-note">{FLAT_NOTE}</p>
        </>
      )}
      {!ready && !flat && <div className="holo-status">展開卦牌中…</div>}
    </div>
  )
}
