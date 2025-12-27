import React, { useEffect, useState } from 'react'

export default function Walkthrough({ steps = [], visible = false, onClose = () => {} }) {
  const [index, setIndex] = useState(0)
  const step = steps[index]
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!visible) return
    const computePos = () => {
      if (!step || !step.selector) {
        setPos(null)
        return
      }
      try {
        const el = document.querySelector(step.selector)
        if (!el) { setPos(null); return }
        const r = el.getBoundingClientRect()
        setPos({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height })
      } catch (e) {
        setPos(null)
      }
    }
    computePos()
    window.addEventListener('resize', computePos)
    window.addEventListener('scroll', computePos, true)
    return () => {
      window.removeEventListener('resize', computePos)
      window.removeEventListener('scroll', computePos, true)
    }
  }, [visible, index, step])

  if (!visible || !steps || steps.length === 0) return null

  const next = () => {
    if (index < steps.length - 1) setIndex(i => i + 1)
    else finish()
  }
  const prev = () => { if (index > 0) setIndex(i => i - 1) }
  const finish = () => { onClose(); setIndex(0) }

  // Positioning
  const style = pos ? {
    position: 'absolute',
    top: pos.top + pos.height + 8,
    left: Math.max(8, pos.left),
    zIndex: 9999,
    minWidth: 220,
    maxWidth: 320
  } : { position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, minWidth: 260 }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={finish} />
      <div style={style} className="glass-card rounded-xl p-4 z-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1">Step {index + 1} of {steps.length}</div>
            <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
            <p className="text-sm text-gray-600">{step.body}</p>
          </div>
          <div className="ml-3 flex flex-col items-end gap-2">
            <button onClick={finish} className="text-xs text-gray-500">Skip</button>
            <div className="flex gap-2">
              {index > 0 && <button onClick={prev} className="px-2 py-1 text-xs bg-gray-100 rounded">Back</button>}
              <button onClick={next} className="px-3 py-1 text-xs bg-brand-600 text-white rounded">{index === steps.length - 1 ? 'Done' : 'Next'}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
