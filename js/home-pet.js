(() => {
  'use strict'

  if (window.hsHomePetLoaded) return
  window.hsHomePetLoaded = true

  const root = document.currentScript?.dataset.petRoot || '/'
  const asset = name => `${root}img/pet/${name}`
  const frameWidth = 512
  const frameHeight = 256
  const frameCount = 13
  const columns = 4
  const duration = 440
  let destroy = () => {}
  let atlasPromise

  const loadAtlas = () => {
    if (!atlasPromise) {
      atlasPromise = new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Pet animation unavailable'))
        image.src = asset('taitai-turn-v1.webp')
      }).catch(error => {
        atlasPromise = null
        throw error
      })
    }
    return atlasPromise
  }

  const mount = () => {
    destroy()
    destroy = () => {}

    const path = window.location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/'
    const home = root.replace(/\/+$/, '') || '/'
    const header = document.querySelector('#page-header.full_page')
    if (path !== home || !header || !document.getElementById('recent-posts')) return

    const button = document.createElement('button')
    button.id = 'hs-home-pet'
    button.type = 'button'
    button.setAttribute('aria-label', '和泰泰打个招呼')
    button.setAttribute('aria-pressed', 'false')
    button.dataset.frame = '0'

    const idle = document.createElement('img')
    idle.alt = '侧着趴在沙滩上的泰泰'
    idle.width = frameWidth
    idle.height = frameHeight
    idle.decoding = 'async'
    idle.draggable = false

    const canvas = document.createElement('canvas')
    canvas.width = frameWidth
    canvas.height = frameHeight
    canvas.setAttribute('aria-hidden', 'true')
    const context = canvas.getContext('2d')
    button.append(idle, canvas)
    header.appendChild(button)

    const events = new AbortController()
    const listen = (target, name, callback) => target.addEventListener(name, callback, { signal: events.signal })
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let alive = true
    let visible = true
    let atlas
    let loading = false
    let position = 0
    let destination = 0
    let request = 0
    let previousTime = 0
    let lastFrame = -1
    let hovering = false
    let keyboardFocus = false
    let touchSelected = false
    let lastPointer = 'mouse'

    const draw = () => {
      if (!atlas || !context) return
      const frame = Math.round(position * (frameCount - 1))
      if (frame === lastFrame) return
      context.clearRect(0, 0, frameWidth, frameHeight)
      context.drawImage(atlas, (frame % columns) * frameWidth, Math.floor(frame / columns) * frameHeight,
        frameWidth, frameHeight, 0, 0, frameWidth, frameHeight)
      button.dataset.frame = String(frame)
      lastFrame = frame
    }

    const stop = () => {
      cancelAnimationFrame(request)
      request = 0
      previousTime = 0
    }

    const tick = time => {
      request = 0
      if (!alive || !visible || document.hidden) return
      const elapsed = previousTime ? time - previousTime : 16
      previousTime = time
      const step = Math.min(elapsed, 48) / duration
      position += Math.sign(destination - position) * Math.min(step, Math.abs(destination - position))
      draw()
      if (position !== destination) request = requestAnimationFrame(tick)
      else previousTime = 0
    }

    const play = () => {
      if (!alive || !atlas || !visible || document.hidden) return
      if (reduced.matches) {
        stop()
        position = destination
        draw()
      } else if (!request && position !== destination) {
        previousTime = 0
        request = requestAnimationFrame(tick)
      }
    }

    const prepare = () => {
      if (loading || atlas || !context) return
      loading = true
      loadAtlas().then(image => {
        if (!alive) return
        atlas = image
        draw()
        button.classList.add('has-frames')
        play()
      }).catch(() => {
        // Leave the approved idle photo visible when animation cannot load.
      }).finally(() => { loading = false })
    }

    const update = () => {
      destination = hovering || keyboardFocus || touchSelected ? 1 : 0
      button.setAttribute('aria-pressed', String(!!destination))
      prepare()
      play()
    }

    listen(idle, 'load', () => {
      button.classList.add('is-ready')
      if (visible) prepare()
    })
    listen(idle, 'error', () => {
      alive = false
      stop()
      events.abort()
      observer?.disconnect()
      button.remove()
    })
    listen(button, 'pointerdown', event => { lastPointer = event.pointerType })
    listen(button, 'pointerenter', event => {
      if (event.pointerType === 'touch') return
      hovering = true
      update()
    })
    listen(button, 'pointerleave', event => {
      if (event.pointerType === 'touch') return
      hovering = false
      update()
    })
    listen(button, 'focus', () => {
      keyboardFocus = button.matches(':focus-visible')
      update()
    })
    listen(button, 'blur', () => {
      keyboardFocus = false
      if (lastPointer !== 'touch') touchSelected = false
      update()
    })
    listen(button, 'click', event => {
      if (lastPointer === 'touch' || event.detail === 0) {
        if (event.detail === 0) keyboardFocus = false
        touchSelected = !touchSelected
        update()
      }
    })
    listen(button, 'keydown', event => {
      if (event.key !== 'Escape') return
      hovering = keyboardFocus = touchSelected = false
      button.blur()
      update()
    })
    listen(document, 'visibilitychange', () => { if (document.hidden) stop(); else play() })
    listen(reduced, 'change', play)

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting
        if (visible) { prepare(); play() } else stop()
      })
      : null
    observer?.observe(button)
    idle.src = asset('taitai-idle-v1.webp')

    destroy = () => {
      alive = false
      stop()
      events.abort()
      observer?.disconnect()
      button.remove()
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true })
  else mount()
  document.addEventListener('pjax:send', () => { destroy(); destroy = () => {} })
  document.addEventListener('pjax:complete', mount)
  document.addEventListener('pjax:error', mount)
  window.addEventListener('pageshow', event => { if (event.persisted) mount() })
})()
