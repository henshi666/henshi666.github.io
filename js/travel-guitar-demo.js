(function () {
  const WORLD_MAP_URL = '/travel/data/world-land.geojson'
  const STRING_FREQUENCIES = [82.41, 110, 146.83, 196, 246.94, 329.63]
  let audioContext = null
  let soundEnabled = false

  function prefersReducedMotion () {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function equalEarthProject (longitude, latitude) {
    const radians = Math.PI / 180
    const lambda = longitude * radians
    const phi = Math.asin((Math.sqrt(3) / 2) * Math.sin(latitude * radians))
    const phiSquared = phi * phi
    const phiSixth = phiSquared * phiSquared * phiSquared
    const denominator = (Math.sqrt(3) / 2) * (
      1.340264 +
      (3 * -0.081106 * phiSquared) +
      (phiSixth * ((7 * 0.000893) + (9 * 0.003796 * phiSquared)))
    )

    return [
      (lambda * Math.cos(phi)) / denominator,
      phi * (
        1.340264 +
        (-0.081106 * phiSquared) +
        (phiSixth * (0.000893 + (0.003796 * phiSquared)))
      )
    ]
  }

  function forEachMapRing (geometry, callback) {
    if (!geometry) return

    if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach(callback)
      return
    }

    if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach(polygon => polygon.forEach(callback))
    }
  }

  function getMapBounds (features) {
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    }

    features.forEach(feature => {
      forEachMapRing(feature.geometry, ring => {
        ring.forEach(coordinate => {
          const point = equalEarthProject(coordinate[0], coordinate[1])
          bounds.minX = Math.min(bounds.minX, point[0])
          bounds.minY = Math.min(bounds.minY, point[1])
          bounds.maxX = Math.max(bounds.maxX, point[0])
          bounds.maxY = Math.max(bounds.maxY, point[1])
        })
      })
    })

    return bounds
  }

  function renderWorldMap (mapRoot, mapData) {
    const canvas = mapRoot.querySelector('#gtd-world-map')
    const marker = mapRoot.querySelector('[data-gtd-lon][data-gtd-lat]')
    if (!canvas || !document.documentElement.contains(canvas)) return

    const rectangle = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rectangle.width))
    const height = Math.max(1, Math.round(rectangle.height))
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    const context = canvas.getContext('2d')
    if (!context) return

    const bounds = mapData.__gtdBounds || getMapBounds(mapData.features)
    mapData.__gtdBounds = bounds
    const horizontalPadding = width * 0.055
    const verticalPadding = height * 0.12
    const scale = Math.min(
      (width - (horizontalPadding * 2)) / (bounds.maxX - bounds.minX),
      (height - (verticalPadding * 2)) / (bounds.maxY - bounds.minY)
    )
    const mapWidth = (bounds.maxX - bounds.minX) * scale
    const mapHeight = (bounds.maxY - bounds.minY) * scale
    const offsetX = (width - mapWidth) / 2
    const offsetY = (height - mapHeight) / 2

    function toCanvasPoint (coordinate) {
      const projected = equalEarthProject(coordinate[0], coordinate[1])
      return [
        offsetX + ((projected[0] - bounds.minX) * scale),
        offsetY + ((bounds.maxY - projected[1]) * scale)
      ]
    }

    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.fillStyle = 'rgba(218, 161, 83, 0.20)'
    context.strokeStyle = 'rgba(246, 221, 174, 0.44)'
    context.lineWidth = 0.72

    mapData.features.forEach(feature => {
      context.beginPath()

      forEachMapRing(feature.geometry, ring => {
        let previousLongitude = null

        ring.forEach((coordinate, index) => {
          const point = toCanvasPoint(coordinate)
          const crossedDateLine = previousLongitude !== null &&
            Math.abs(coordinate[0] - previousLongitude) > 180

          if (index === 0 || crossedDateLine) {
            context.moveTo(point[0], point[1])
          } else {
            context.lineTo(point[0], point[1])
          }

          previousLongitude = coordinate[0]
        })

        context.closePath()
      })

      context.fill('evenodd')
      context.stroke()
    })

    if (marker) {
      const point = toCanvasPoint([
        Number(marker.dataset.gtdLon),
        Number(marker.dataset.gtdLat)
      ])
      marker.style.left = `${canvas.offsetLeft + point[0]}px`
      marker.style.top = `${canvas.offsetTop + point[1]}px`
    }

    mapRoot.classList.add('is-ready')
  }

  function initializeMap (root) {
    const mapRoot = root.querySelector('[data-gtd-map-root]')
    if (!mapRoot || mapRoot.dataset.ready === 'true') return
    mapRoot.dataset.ready = 'true'

    fetch(WORLD_MAP_URL)
      .then(response => {
        if (!response.ok) throw new Error('Map unavailable')
        return response.json()
      })
      .then(mapData => {
        if (!document.documentElement.contains(mapRoot)) return
        let resizeFrame
        const draw = () => {
          window.cancelAnimationFrame(resizeFrame)
          resizeFrame = window.requestAnimationFrame(() => renderWorldMap(mapRoot, mapData))
        }

        draw()

        if ('ResizeObserver' in window) {
          const observer = new ResizeObserver(draw)
          observer.observe(mapRoot.querySelector('#gtd-world-map'))
        } else {
          window.addEventListener('resize', draw, { passive: true })
        }
      })
      .catch(() => {
        mapRoot.classList.add('has-error')
        const status = mapRoot.querySelector('[data-gtd-map-status]')
        if (status) status.textContent = '地图暂时没有出现，可从右侧专辑卡进入中国记录。'
      })

    const stage = mapRoot.querySelector('[data-gtd-map-stage]')
    if (stage && !prefersReducedMotion()) {
      stage.addEventListener('pointermove', event => {
        if (event.pointerType && event.pointerType !== 'mouse') return
        const rectangle = stage.getBoundingClientRect()
        const x = ((event.clientX - rectangle.left) / rectangle.width) * 100
        const y = ((event.clientY - rectangle.top) / rectangle.height) * 100
        stage.style.setProperty('--map-x', `${x.toFixed(1)}%`)
        stage.style.setProperty('--map-y', `${y.toFixed(1)}%`)
      })
    }
  }

  function getAudioContext () {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    if (!audioContext) audioContext = new AudioContextClass()
    if (audioContext.state === 'suspended') audioContext.resume()
    return audioContext
  }

  function playPluck (frequency, delay) {
    if (!soundEnabled) return
    const context = getAudioContext()
    if (!context) return

    const startAt = context.currentTime + (delay || 0)
    const oscillator = context.createOscillator()
    const overtone = context.createOscillator()
    const toneFilter = context.createBiquadFilter()
    const master = context.createGain()
    const overtoneGain = context.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(frequency, startAt)
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.997, startAt + 0.8)
    overtone.type = 'sine'
    overtone.frequency.setValueAtTime(frequency * 2.01, startAt)
    overtoneGain.gain.setValueAtTime(0.03, startAt)
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22)

    toneFilter.type = 'lowpass'
    toneFilter.frequency.setValueAtTime(2600, startAt)
    toneFilter.frequency.exponentialRampToValueAtTime(720, startAt + 0.9)
    toneFilter.Q.setValueAtTime(0.7, startAt)

    master.gain.setValueAtTime(0.0001, startAt)
    master.gain.exponentialRampToValueAtTime(0.11, startAt + 0.008)
    master.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.95)

    oscillator.connect(toneFilter)
    overtone.connect(overtoneGain)
    overtoneGain.connect(toneFilter)
    toneFilter.connect(master)
    master.connect(context.destination)

    oscillator.start(startAt)
    overtone.start(startAt)
    oscillator.stop(startAt + 1)
    overtone.stop(startAt + 0.35)
  }

  function animateString (string) {
    if (!string) return
    string.classList.remove('is-plucked')
    void string.offsetWidth
    string.classList.add('is-plucked')
    window.setTimeout(() => string.classList.remove('is-plucked'), 470)
  }

  function updateSoundButtons (root) {
    root.querySelectorAll('[data-gtd-sound]').forEach(button => {
      button.setAttribute('aria-pressed', String(soundEnabled))
      button.textContent = soundEnabled ? '声音：开' : '声音：关'
    })
  }

  function initializeStrings (root) {
    const strings = Array.from(root.querySelectorAll('[data-gtd-string]'))
    const chordButton = root.querySelector('[data-gtd-chord]')

    strings.forEach(string => {
      string.addEventListener('click', () => {
        animateString(string)
        playPluck(Number(string.dataset.gtdString))
      })
    })

    root.querySelectorAll('[data-gtd-sound]').forEach(button => {
      button.addEventListener('click', () => {
        soundEnabled = !soundEnabled
        if (soundEnabled) {
          getAudioContext()
          playPluck(164.81)
        }
        updateSoundButtons(root)
      })
    })

    if (chordButton) {
      chordButton.addEventListener('click', () => {
        soundEnabled = true
        getAudioContext()
        updateSoundButtons(root)
        strings.forEach((string, index) => {
          window.setTimeout(() => animateString(string), index * 34)
          playPluck(Number(string.dataset.gtdString), index * 0.034)
        })
      })
    }
  }

  function initializeTracks (root) {
    const tracks = Array.from(root.querySelectorAll('.gtd-track[data-city]'))
    const detail = root.querySelector('[data-gtd-track-detail]')
    if (!tracks.length || !detail) return

    const city = detail.querySelector('[data-gtd-track-city]')
    const region = detail.querySelector('[data-gtd-track-region]')
    const index = detail.querySelector('[data-gtd-track-index]')
    const copy = detail.querySelector('[data-gtd-track-copy]')

    tracks.forEach((track, trackIndex) => {
      track.addEventListener('click', () => {
        tracks.forEach(item => item.classList.remove('is-active'))
        track.classList.add('is-active')
        detail.classList.add('is-switching')

        window.setTimeout(() => {
          if (city) city.textContent = track.dataset.city
          if (region) region.textContent = track.dataset.region
          if (index) index.textContent = `${track.dataset.track} / 14`
          if (copy) {
            copy.textContent = `${track.dataset.city}的照片、日期和旅行感受已经留好位置。上传内容后，它会变成专属的一页旅行手记。`
          }
          detail.style.setProperty('--track-progress', `${((trackIndex + 1) / tracks.length) * 100}%`)
          detail.classList.remove('is-switching')
        }, 120)

        if (soundEnabled) {
          playPluck(STRING_FREQUENCIES[trackIndex % STRING_FREQUENCIES.length])
        }
      })
    })
  }

  function initializeHeroPointer (root) {
    const hero = root.querySelector('[data-gtd-hero]')
    if (!hero || prefersReducedMotion()) return

    hero.addEventListener('pointermove', event => {
      if (event.pointerType && event.pointerType !== 'mouse') return
      const rectangle = hero.getBoundingClientRect()
      const x = ((event.clientX - rectangle.left) / rectangle.width) * 100
      const y = ((event.clientY - rectangle.top) / rectangle.height) * 100
      hero.style.setProperty('--hero-x', `${x.toFixed(1)}%`)
      hero.style.setProperty('--hero-y', `${y.toFixed(1)}%`)
    })
  }

  function initializeReveal (root) {
    const items = root.querySelectorAll('.gtd-reveal')
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach(item => item.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -7% 0px'
    })

    items.forEach(item => observer.observe(item))
  }

  function updateGuitarTravelDemo () {
    const root = document.getElementById('guitar-travel-demo')
    document.documentElement.classList.toggle('hs-guitar-travel-demo', Boolean(root))
    if (!root || root.dataset.ready === 'true') return

    root.dataset.ready = 'true'
    root.classList.add('gtd-js')
    initializeMap(root)
    initializeStrings(root)
    initializeTracks(root)
    initializeHeroPointer(root)
    initializeReveal(root)
    updateSoundButtons(root)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateGuitarTravelDemo)
  } else {
    updateGuitarTravelDemo()
  }

  document.addEventListener('pjax:complete', updateGuitarTravelDemo)
})()
