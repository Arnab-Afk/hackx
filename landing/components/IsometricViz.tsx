"use client"

import { useEffect, useRef } from "react"

export function IsometricViz() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let t = 0
    let W = 0
    let H = 0
    const dpr = window.devicePixelRatio || 1

    function resize() {
      const r = canvas!.getBoundingClientRect()
      W = r.width
      H = r.height
      canvas!.width = W * dpr
      canvas!.height = H * dpr
      ctx!.setTransform(1, 0, 0, 1, 0, 0)
      ctx!.scale(dpr, dpr)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // ── Isometric projection ─────────────────────────────────────────
    const TW = 32   // screen x-delta per grid unit
    const TH = 18   // screen y-delta per grid unit
    const ZU = 20   // screen y-delta per z-unit (upward)

    const ox = () => W * 0.70
    const oy = () => H * 0.54

    const sx = (gx: number, gy: number) => ox() + (gx - gy) * TW
    const sy = (gx: number, gy: number, gz = 0) => oy() + (gx + gy) * TH - gz * ZU

    // ── Helpers ──────────────────────────────────────────────────────
    function face(pts: [number, number][], fill: string, stroke = "", lw = 0) {
      ctx!.beginPath()
      ctx!.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx!.lineTo(pts[i][0], pts[i][1])
      ctx!.closePath()
      ctx!.fillStyle = fill
      ctx!.fill()
      if (stroke && lw > 0) { ctx!.strokeStyle = stroke; ctx!.lineWidth = lw; ctx!.stroke() }
    }

    function drawBox(
      gx: number, gy: number, gz: number,
      w: number, h: number, d: number,
      topC: string, leftC: string, rightC: string,
      borderc = "", borderw = 0,
    ) {
      const z0 = gz, z1 = gz + d
      face(
        [[sx(gx,gy),sy(gx,gy,z1)],[sx(gx+w,gy),sy(gx+w,gy,z1)],
         [sx(gx+w,gy+h),sy(gx+w,gy+h,z1)],[sx(gx,gy+h),sy(gx,gy+h,z1)]],
        topC, borderc, borderw,
      )
      face(
        [[sx(gx,gy),sy(gx,gy,z1)],[sx(gx,gy+h),sy(gx,gy+h,z1)],
         [sx(gx,gy+h),sy(gx,gy+h,z0)],[sx(gx,gy),sy(gx,gy,z0)]],
        leftC, borderc, borderw,
      )
      face(
        [[sx(gx+w,gy),sy(gx+w,gy,z1)],[sx(gx+w,gy+h),sy(gx+w,gy+h,z1)],
         [sx(gx+w,gy+h),sy(gx+w,gy+h,z0)],[sx(gx+w,gy),sy(gx+w,gy,z0)]],
        rightC, borderc, borderw,
      )
    }

    // Horizontal slot lines on the right face of a box (server-rack look)
    function rackLines(gx: number, gy: number, gz: number, w: number, h: number, d: number, slots: number) {
      ctx!.save()
      ctx!.strokeStyle = "rgba(160,160,180,0.35)"
      ctx!.lineWidth = 0.8
      for (let i = 1; i <= slots; i++) {
        const lz = gz + (d * i / (slots + 1))
        ctx!.beginPath()
        ctx!.moveTo(sx(gx + w, gy), sy(gx + w, gy, lz))
        ctx!.lineTo(sx(gx + w, gy + h), sy(gx + w, gy + h, lz))
        ctx!.stroke()
        ctx!.beginPath()
        ctx!.moveTo(sx(gx, gy + h), sy(gx, gy + h, lz))
        ctx!.lineTo(sx(gx + w, gy + h), sy(gx + w, gy + h, lz))
        ctx!.stroke()
      }
      ctx!.restore()
    }

    // ── Floor grid ───────────────────────────────────────────────────
    function drawGrid() {
      const G = 13
      ctx!.save()
      ctx!.setLineDash([2, 6])
      ctx!.strokeStyle = "rgba(100,80,200,0.35)"
      ctx!.lineWidth = 0.7
      for (let x = -G; x <= G; x++) {
        ctx!.beginPath()
        ctx!.moveTo(sx(x, -G), sy(x, -G))
        ctx!.lineTo(sx(x,  G), sy(x,  G))
        ctx!.stroke()
      }
      for (let y = -G; y <= G; y++) {
        ctx!.beginPath()
        ctx!.moveTo(sx(-G, y), sy(-G, y))
        ctx!.lineTo(sx( G, y), sy( G, y))
        ctx!.stroke()
      }
      ctx!.setLineDash([])
      // Intersection dots
      ctx!.fillStyle = "rgba(130,100,220,0.25)"
      for (let x = -G; x <= G; x++) {
        for (let y = -G; y <= G; y++) {
          ctx!.beginPath()
          ctx!.arc(sx(x, y), sy(x, y), 1.0, 0, Math.PI * 2)
          ctx!.fill()
        }
      }
      ctx!.restore()
    }

    // ── Purple asterisk (Runlayer star logo) ─────────────────────────
    function drawAsterisk(cx: number, cy: number, r: number, alpha: number) {
      ctx!.save()
      ctx!.globalAlpha = alpha
      ctx!.strokeStyle = "#7c45ff"
      ctx!.lineWidth = r * 0.14
      ctx!.lineCap = "round"
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI
        ctx!.beginPath()
        ctx!.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        ctx!.lineTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r)
        ctx!.stroke()
      }
      ctx!.restore()
    }

    // ── Floor pill labels ─────────────────────────────────────────────
    function drawPill(gx: number, gy: number, w: number, h: number, label: string, a: number) {
      const p: [number, number][] = [
        [sx(gx, gy), sy(gx, gy)],
        [sx(gx + w, gy), sy(gx + w, gy)],
        [sx(gx + w, gy + h), sy(gx + w, gy + h)],
        [sx(gx, gy + h), sy(gx, gy + h)],
      ]
      ctx!.save()
      ctx!.globalAlpha = a
      face(p, "rgba(10,7,28,0.92)", "rgba(150,150,170,0.5)", 0.9)
      const cx2 = p.reduce((s, q) => s + q[0], 0) / 4
      const cy2 = p.reduce((s, q) => s + q[1], 0) / 4
      ctx!.translate(cx2, cy2)
      ctx!.rotate(-0.52)
      ctx!.textAlign = "center"
      ctx!.textBaseline = "middle"
      ctx!.fillStyle = "rgba(210,180,255,1.0)"
      ctx!.font = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif"
      ctx!.fillText(label, 0, 0)
      ctx!.restore()
    }

    // ── Scene data ────────────────────────────────────────────────────
    // Center platform — layered chip like Runlayer
    const PLATFORM = [
      { gx: -5.5, gy: -5.5, w: 11, h: 11, d: 0.28, z: 0,    tc: "#131326", lc: "#0a0a1c", rc: "#101025" },
      { gx: -4.5, gy: -4.5, w:  9, h:  9, d: 0.3,  z: 0.28, tc: "#171734", lc: "#0d0d26", rc: "#12122e" },
      { gx: -3.5, gy: -3.5, w:  7, h:  7, d: 0.32, z: 0.58, tc: "#1c1945", lc: "#100e30", rc: "#17153c" },
      { gx: -2.5, gy: -2.5, w:  5, h:  5, d: 0.36, z: 0.9,  tc: "#22185a", lc: "#130f3c", rc: "#1c154e" },
    ]

    // Peripheral server nodes
    const NODES = [
      { gx: -7.5, gy: -9.5, w: 3.2, h: 2.4, d: 3.8, phase: 0,   spd: 0.52, label: "Provider #1", sub: "node" },
      { gx:  5.5, gy: -5.5, w: 2.8, h: 2.2, d: 3.2, phase: 1.4, spd: 0.44, label: "Docker",       sub: "runtime" },
      { gx: -8.5, gy:  1,   w: 3.2, h: 2.2, d: 4.2, phase: 2.3, spd: 0.58, label: "LUKS2",        sub: "encrypted" },
      { gx:  1.5, gy:  6,   w: 2.8, h: 2.2, d: 2.8, phase: 0.7, spd: 0.75, label: "EAS",          sub: "on-chain" },
      { gx:  6.5, gy:  1,   w: 2.2, h: 1.8, d: 2.2, phase: 1.9, spd: 0.48, label: "x402",         sub: "payments" },
    ]

    // Flat floor tiles (on-grid labels)
    const TILES = [
      { gx: -6.0, gy: -11.5, w: 3.0, h: 2.2, label: "GitHub",      sub: "open source" },
      { gx:  8.0, gy: -3.0,  w: 2.8, h: 2.0, label: "Base",        sub: "L2 chain" },
      { gx:  9.0, gy:  4.5,  w: 2.6, h: 2.0, label: "USDC",        sub: "micropay" },
      { gx:  1.0, gy:  8.5,  w: 3.0, h: 2.2, label: "Attestation", sub: "EAS schema" },
    ]

    const topLayer = PLATFORM[PLATFORM.length - 1]
    const platformTopZ = topLayer.z + topLayer.d
    const chipcx = sx(0, 0)
    const chipcy = () => sy(0, 0, platformTopZ + 0.05)

    // ── Main render ───────────────────────────────────────────────────
    function draw() {
      ctx!.clearRect(0, 0, W, H)

      // Ambient glow
      const bg = ctx!.createRadialGradient(ox(), oy() - 50, 0, ox(), oy() - 50, Math.min(W, H) * 0.72)
      bg.addColorStop(0, `rgba(55,18,170,${0.13 + 0.04 * Math.sin(t * 0.7)})`)
      bg.addColorStop(0.55, "rgba(18,6,60,0.04)")
      bg.addColorStop(1, "transparent")
      ctx!.fillStyle = bg
      ctx!.fillRect(0, 0, W, H)

      drawGrid()

      // Floor pill labels
      drawPill(-7.5, 7.5, 4.5, 2.2, "Security",    0.6 + 0.1 * Math.sin(t * 0.4))
      drawPill( 7.5, -0.5, 3.5, 2,  "Payments",    0.55 + 0.1 * Math.sin(t * 0.4 + 2.2))

      // Flat floor tiles
      TILES.forEach((tile) => {
        const p: [number,number][] = [
          [sx(tile.gx, tile.gy),           sy(tile.gx, tile.gy)],
          [sx(tile.gx+tile.w, tile.gy),    sy(tile.gx+tile.w, tile.gy)],
          [sx(tile.gx+tile.w, tile.gy+tile.h), sy(tile.gx+tile.w, tile.gy+tile.h)],
          [sx(tile.gx, tile.gy+tile.h),    sy(tile.gx, tile.gy+tile.h)],
        ]
        ctx!.save()
        face(p, "rgba(18,14,42,0.88)", "rgba(150,130,200,0.5)", 0.9)
        const cx2 = p.reduce((s,q) => s+q[0], 0) / 4
        const cy2 = p.reduce((s,q) => s+q[1], 0) / 4
        ctx!.translate(cx2, cy2)
        ctx!.rotate(-0.52)
        ctx!.textAlign = "center"
        ctx!.textBaseline = "middle"
        ctx!.fillStyle = "rgba(210,190,255,1.0)"
        ctx!.font = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif"
        ctx!.fillText(tile.label, 0, -5)
        ctx!.fillStyle = "rgba(140,120,200,0.85)"
        ctx!.font = "8px -apple-system, BlinkMacSystemFont, sans-serif"
        ctx!.fillText(tile.sub, 0, 6)
        ctx!.restore()
      })

      const ccy = chipcy()

      // Dashed connection lines + travelling dots from nodes → center
      NODES.forEach((n) => {
        const bob = 0.3 * Math.sin(t * n.spd + n.phase)
        const nx = sx(n.gx + n.w / 2, n.gy + n.h / 2)
        const ny = sy(n.gx + n.w / 2, n.gy + n.h / 2, n.d + bob + 0.05)
        const lineA = 0.09 + 0.04 * Math.sin(t * 0.5 + n.phase)
        ctx!.save()
        ctx!.setLineDash([3, 8])
        ctx!.strokeStyle = `rgba(100,65,220,${lineA})`
        ctx!.lineWidth = 0.8
        ctx!.beginPath(); ctx!.moveTo(nx, ny); ctx!.lineTo(chipcx, ccy)
        ctx!.stroke()
        ctx!.restore()
        const prog = ((t * 0.28 + n.phase) % 1 + 1) % 1
        ctx!.beginPath()
        ctx!.arc(nx + (chipcx - nx) * prog, ny + (ccy - ny) * prog, 2, 0, Math.PI * 2)
        ctx!.fillStyle = "rgba(160,115,255,0.85)"
        ctx!.fill()
      })

      // Center chip layers bottom → top
      PLATFORM.forEach((layer, li) => {
        const isTop = li === PLATFORM.length - 1
        const pulse = isTop ? 0.06 * Math.sin(t * 1.3) : 0
        const topC = isTop
          ? `rgba(${36 + Math.round(pulse * 22)},${14 + Math.round(pulse * 12)},${178 + Math.round(pulse * 30)},0.97)`
          : layer.tc
        drawBox(layer.gx, layer.gy, layer.z, layer.w, layer.h, layer.d,
          topC, layer.lc, layer.rc,
          "rgba(150,130,200,0.65)", isTop ? 1.4 : 0.8)

        // Circuit-trace lines on non-top layers
        if (!isTop) {
          ctx!.save()
          ctx!.strokeStyle = "rgba(255,255,255,0.04)"
          ctx!.lineWidth = 0.5
          const z = layer.z + layer.d
          for (let i = 1; i < 4; i++) {
            const f = i / 4
            ctx!.beginPath()
            ctx!.moveTo(sx(layer.gx + layer.w * f, layer.gy), sy(layer.gx + layer.w * f, layer.gy, z))
            ctx!.lineTo(sx(layer.gx + layer.w * f, layer.gy + layer.h), sy(layer.gx + layer.w * f, layer.gy + layer.h, z))
            ctx!.stroke()
          }
          ctx!.restore()
        }
      })

      // Purple asterisk on center chip
      const astX = sx(0, 0)
      const astY = sy(0, 0, platformTopZ + 0.1) - 2
      const astR = 22 + 3 * Math.sin(t * 1.7)
      drawAsterisk(astX, astY, astR, 0.88 + 0.08 * Math.sin(t * 1.7))

      // Chip glow
      const cgr = ctx!.createRadialGradient(astX, astY - 8, 0, astX, astY - 8, 140 + 18 * Math.sin(t * 0.95))
      cgr.addColorStop(0, `rgba(110,55,245,${0.3 + 0.07 * Math.sin(t * 1.1)})`)
      cgr.addColorStop(0.45, "rgba(65,25,175,0.07)")
      cgr.addColorStop(1, "transparent")
      ctx!.fillStyle = cgr
      ctx!.beginPath(); ctx!.arc(astX, astY - 8, 155, 0, Math.PI * 2); ctx!.fill()

      // Pulse rings
      for (let i = 0; i < 3; i++) {
        const p = ((t * 0.42 + i * 0.68) % 1 + 1) % 1
        ctx!.beginPath()
        ctx!.arc(astX, astY - 8, 22 + p * 140, 0, Math.PI * 2)
        ctx!.strokeStyle = `rgba(145,90,255,${(1 - p) * 0.14})`
        ctx!.lineWidth = 1
        ctx!.stroke()
      }

      // Peripheral nodes (painter sort)
      const sorted = [...NODES].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy))
      sorted.forEach((n) => {
        const bob = 0.3 * Math.sin(t * n.spd + n.phase)
        drawBox(n.gx, n.gy, bob, n.w, n.h, n.d,
          "#252545", "#171738", "#32325a",
          "rgba(160,160,180,0.55)", 1.0)
        rackLines(n.gx, n.gy, bob, n.w, n.h, n.d, Math.floor(n.d * 2))

        const lx = sx(n.gx + n.w / 2, n.gy + n.h / 2)
        const ly = sy(n.gx + n.w / 2, n.gy + n.h / 2, n.d + bob + 0.12)
        ctx!.textAlign = "center"
        ctx!.textBaseline = "middle"
        ctx!.fillStyle = "#ffffff"
        ctx!.font = "bold 10px -apple-system, BlinkMacSystemFont, sans-serif"
        ctx!.fillText(n.label, lx, ly - 6)
        ctx!.fillStyle = "#a0a0c8"
        ctx!.font = "9px -apple-system, BlinkMacSystemFont, sans-serif"
        ctx!.fillText(n.sub, lx, ly + 6)
      })

      t += 0.012
      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => { ro.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
}
