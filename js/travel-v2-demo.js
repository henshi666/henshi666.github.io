(() => {
  const INSTANCE_KEY = '__travelV2Demo'
  const WORLD_MAP_URL = '/travel/data/world-land.geojson'
  const CHINA_MAP_URL = '/travel/data/china-provinces.geojson'

  const ROUTE_CITIES = {
    northeast: ['harbin', 'changchun', 'shenyang', 'dalian'],
    north: ['beijing', 'tianjin', 'tangshan', 'shijiazhuang'],
    coast: ['qingdao', 'zhengzhou', 'luoyang'],
    yunnan: ['kunming', 'dali', 'lijiang']
  }

  const CITY_POINTS = [
    { id: 'harbin', longitude: 126.642464, latitude: 45.756967 },
    { id: 'changchun', longitude: 125.3245, latitude: 43.886841 },
    { id: 'shenyang', longitude: 123.429096, latitude: 41.796767 },
    { id: 'dalian', longitude: 121.618622, latitude: 38.91459 },
    { id: 'shijiazhuang', longitude: 114.502461, latitude: 38.045474 },
    { id: 'tangshan', longitude: 118.175393, latitude: 39.635113 },
    { id: 'qingdao', longitude: 120.355173, latitude: 36.082982 },
    { id: 'beijing', longitude: 116.405285, latitude: 39.904989 },
    { id: 'tianjin', longitude: 117.190182, latitude: 39.125596 },
    { id: 'luoyang', longitude: 112.434468, latitude: 34.663041 },
    { id: 'zhengzhou', longitude: 113.665412, latitude: 34.757975 },
    { id: 'dali', longitude: 100.225668, latitude: 25.589449 },
    { id: 'lijiang', longitude: 100.233026, latitude: 26.872108 },
    { id: 'kunming', longitude: 102.712251, latitude: 25.040609 }
  ]

  if (window[INSTANCE_KEY] && typeof window[INSTANCE_KEY].destroy === 'function') {
    window[INSTANCE_KEY].destroy()
  }

  const root = document.getElementById('travel-v2-demo')
  const html = document.documentElement

  if (!root) {
    html.classList.remove('hs-travel-v2-demo')
    return
  }

  const controller = new AbortController()
  const cleanups = []
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let destroyed = false

  html.classList.add('hs-travel-v2-demo')
  root.classList.add('is-js')

  function destroy () {
    if (destroyed) return
    destroyed = true

    controller.abort()
    cleanups.splice(0).forEach(cleanup => cleanup())
    html.classList.remove('hs-travel-v2-demo')
    root.classList.remove('is-js')

    if (window[INSTANCE_KEY] && window[INSTANCE_KEY].destroy === destroy) {
      delete window[INSTANCE_KEY]
    }
  }

  window[INSTANCE_KEY] = { destroy }

  document.addEventListener('pjax:send', destroy, {
    once: true,
    signal: controller.signal
  })

  function startWhenNear (element, callback, rootMargin = '260px 0px') {
    if (!('IntersectionObserver' in window)) {
      callback()
      return
    }

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      callback()
    }, { rootMargin, threshold: 0 })

    observer.observe(element)
    cleanups.push(() => observer.disconnect())
  }

  function initializeReveals () {
    const elements = [...root.querySelectorAll('[data-tv2-reveal]')]

    if (reducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, {
      rootMargin: '0px 0px -9% 0px',
      threshold: 0.12
    })

    elements.forEach(element => observer.observe(element))
    cleanups.push(() => observer.disconnect())
  }

  function initializeSceneProgress () {
    const scenes = [...root.querySelectorAll('[data-tv2-scene]')]
    const navigationItems = [...root.querySelectorAll('[data-tv2-nav]')]
    let frame = 0
    let currentScene = ''

    const update = () => {
      frame = 0
      const focusLine = window.innerHeight * 0.48
      let closest = null

      scenes.forEach((scene, index) => {
        const rectangle = scene.getBoundingClientRect()
        const containsFocusLine = rectangle.top <= focusLine && rectangle.bottom >= focusLine
        const distance = containsFocusLine
          ? -1
          : Math.min(Math.abs(rectangle.top - focusLine), Math.abs(rectangle.bottom - focusLine))

        if (!closest || distance < closest.distance) {
          closest = {
            scene: scene.dataset.tv2Scene,
            distance,
            index
          }
        }
      })

      if (!closest || closest.scene === currentScene) return
      currentScene = closest.scene
      root.dataset.activeScene = currentScene

      navigationItems.forEach(item => {
        if (item.dataset.tv2Nav === currentScene) {
          item.setAttribute('aria-current', 'true')
        } else {
          item.removeAttribute('aria-current')
        }
      })
    }

    const scheduleUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    window.addEventListener('scroll', scheduleUpdate, {
      passive: true,
      signal: controller.signal
    })
    window.addEventListener('resize', scheduleUpdate, {
      passive: true,
      signal: controller.signal
    })

    update()
    cleanups.push(() => window.cancelAnimationFrame(frame))
  }

  function initializeRouteIndex () {
    const rows = [...root.querySelectorAll('[data-route]')]

    function setActiveRoute (route) {
      if (!ROUTE_CITIES[route]) return
      root.dataset.activeRoute = route

      rows.forEach(row => {
        const isActive = row.dataset.route === route
        const control = row.querySelector('[data-route-control]')
        row.classList.toggle('is-active', isActive)
        if (control) control.setAttribute('aria-pressed', String(isActive))
      })

      const activeCities = new Set(ROUTE_CITIES[route])
      root.querySelectorAll('.tv2-city-dot').forEach(marker => {
        marker.classList.toggle('is-active', activeCities.has(marker.dataset.city))
      })
    }

    rows.forEach(row => {
      const route = row.dataset.route
      const control = row.querySelector('[data-route-control]')

      row.addEventListener('pointerenter', () => setActiveRoute(route), {
        signal: controller.signal
      })
      row.addEventListener('focusin', () => setActiveRoute(route), {
        signal: controller.signal
      })

      if (control) {
        control.addEventListener('click', () => setActiveRoute(route), {
          signal: controller.signal
        })
      }
    })

    setActiveRoute(root.dataset.activeRoute || 'northeast')
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

  function getProjectedBounds (features, projector) {
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    }

    features.forEach(feature => {
      forEachMapRing(feature.geometry, ring => {
        ring.forEach(coordinate => {
          const point = projector(coordinate[0], coordinate[1])
          bounds.minX = Math.min(bounds.minX, point[0])
          bounds.minY = Math.min(bounds.minY, point[1])
          bounds.maxX = Math.max(bounds.maxX, point[0])
          bounds.maxY = Math.max(bounds.maxY, point[1])
        })
      })
    })

    return bounds
  }

  function initializeWorldMap () {
    const mapRoot = root.querySelector('[data-world-map-root]')
    const canvas = mapRoot && mapRoot.querySelector('#tv2-world-canvas')
    const marker = mapRoot && mapRoot.querySelector('[data-map-lon][data-map-lat]')
    const status = mapRoot && mapRoot.querySelector('[data-world-map-status]')

    if (!mapRoot || !canvas) return

    startWhenNear(mapRoot, async () => {
      if (status) status.textContent = '正在展开世界地图…'
      mapRoot.setAttribute('aria-busy', 'true')

      try {
        const response = await fetch(WORLD_MAP_URL, { signal: controller.signal })
        if (!response.ok) throw new Error('World map data unavailable')
        const mapData = await response.json()
        if (destroyed) return

        const bounds = getProjectedBounds(mapData.features, equalEarthProject)
        let frame = 0

        const render = () => {
          frame = 0
          if (destroyed || !document.documentElement.contains(canvas)) return

          const context = canvas.getContext('2d')
          const rectangle = canvas.getBoundingClientRect()
          const width = Math.max(1, Math.round(rectangle.width))
          const height = Math.max(1, Math.round(rectangle.height))
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
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

          const toCanvasPoint = coordinate => {
            const point = equalEarthProject(coordinate[0], coordinate[1])
            return [
              offsetX + ((point[0] - bounds.minX) * scale),
              offsetY + ((bounds.maxY - point[1]) * scale)
            ]
          }

          canvas.width = Math.round(width * pixelRatio)
          canvas.height = Math.round(height * pixelRatio)
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
          context.clearRect(0, 0, width, height)
          context.lineJoin = 'round'
          context.lineCap = 'round'
          context.fillStyle = 'rgba(215, 209, 196, 0.72)'
          context.strokeStyle = 'rgba(244, 240, 232, 0.34)'
          context.lineWidth = 0.7

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
            const markerPoint = toCanvasPoint([
              Number(marker.dataset.mapLon),
              Number(marker.dataset.mapLat)
            ])
            marker.style.left = `${(markerPoint[0] / width) * 100}%`
            marker.style.top = `${(markerPoint[1] / height) * 100}%`
          }

          if (status) status.textContent = '世界地图已展开，中国位置已标记。'
          mapRoot.setAttribute('aria-busy', 'false')
          mapRoot.classList.add('is-ready')
        }

        const scheduleRender = () => {
          window.cancelAnimationFrame(frame)
          frame = window.requestAnimationFrame(render)
        }

        scheduleRender()

        if ('ResizeObserver' in window) {
          const observer = new ResizeObserver(scheduleRender)
          observer.observe(canvas)
          cleanups.push(() => observer.disconnect())
        } else {
          window.addEventListener('resize', scheduleRender, {
            passive: true,
            signal: controller.signal
          })
        }

        cleanups.push(() => window.cancelAnimationFrame(frame))
      } catch (error) {
        if (error && error.name === 'AbortError') return
        mapRoot.setAttribute('aria-busy', 'false')
        mapRoot.classList.add('has-error')
        if (status) status.textContent = '地图暂未展开，仍可继续浏览文字路线。'
      }
    })
  }

  function initializeChinaMap () {
    const mapRoot = root.querySelector('[data-china-map-root]')
    const canvas = mapRoot && mapRoot.querySelector('#tv2-china-canvas')
    const markerLayer = mapRoot && mapRoot.querySelector('[data-china-marker-layer]')
    const status = mapRoot && mapRoot.querySelector('[data-china-map-status]')

    if (!mapRoot || !canvas || !markerLayer) return

    startWhenNear(mapRoot, async () => {
      if (status) status.textContent = '正在标记十四座城市…'
      mapRoot.setAttribute('aria-busy', 'true')

      try {
        const response = await fetch(CHINA_MAP_URL, { signal: controller.signal })
        if (!response.ok) throw new Error('China map data unavailable')
        const mapData = await response.json()
        if (destroyed) return

        const features = mapData.features.filter(feature => {
          return !feature.properties || !feature.properties.level || feature.properties.level === 'province'
        })
        const bounds = getProjectedBounds(features, (longitude, latitude) => [longitude, latitude])
        bounds.minY = Math.max(bounds.minY, 17.5)
        let frame = 0

        markerLayer.replaceChildren(...CITY_POINTS.map(city => {
          const marker = document.createElement('span')
          marker.className = 'tv2-city-dot'
          marker.dataset.city = city.id
          return marker
        }))

        const render = () => {
          frame = 0
          if (destroyed || !document.documentElement.contains(canvas)) return

          const context = canvas.getContext('2d')
          const rectangle = canvas.getBoundingClientRect()
          const width = Math.max(1, Math.round(rectangle.width))
          const height = Math.max(1, Math.round(rectangle.height))
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
          const horizontalPadding = width * 0.09
          const verticalPadding = height * 0.08
          const scale = Math.min(
            (width - (horizontalPadding * 2)) / (bounds.maxX - bounds.minX),
            (height - (verticalPadding * 2)) / (bounds.maxY - bounds.minY)
          )
          const mapWidth = (bounds.maxX - bounds.minX) * scale
          const mapHeight = (bounds.maxY - bounds.minY) * scale
          const offsetX = (width - mapWidth) / 2
          const offsetY = (height - mapHeight) / 2

          const toCanvasPoint = coordinate => [
            offsetX + ((coordinate[0] - bounds.minX) * scale),
            offsetY + ((bounds.maxY - coordinate[1]) * scale)
          ]

          canvas.width = Math.round(width * pixelRatio)
          canvas.height = Math.round(height * pixelRatio)
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
          context.clearRect(0, 0, width, height)
          context.lineJoin = 'round'
          context.lineCap = 'round'
          context.fillStyle = 'rgba(80, 124, 139, 0.13)'
          context.strokeStyle = 'rgba(80, 124, 139, 0.58)'
          context.lineWidth = 0.72

          features.forEach(feature => {
            context.beginPath()

            forEachMapRing(feature.geometry, ring => {
              ring.forEach((coordinate, index) => {
                const point = toCanvasPoint(coordinate)
                if (index === 0) {
                  context.moveTo(point[0], point[1])
                } else {
                  context.lineTo(point[0], point[1])
                }
              })
              context.closePath()
            })

            context.fill('evenodd')
            context.stroke()
          })

          CITY_POINTS.forEach(city => {
            const point = toCanvasPoint([city.longitude, city.latitude])
            const marker = markerLayer.querySelector(`[data-city="${city.id}"]`)
            if (!marker) return
            marker.style.left = `${(point[0] / width) * 100}%`
            marker.style.top = `${(point[1] / height) * 100}%`
          })

          const activeCities = new Set(ROUTE_CITIES[root.dataset.activeRoute] || [])
          markerLayer.querySelectorAll('.tv2-city-dot').forEach(marker => {
            marker.classList.toggle('is-active', activeCities.has(marker.dataset.city))
          })

          if (status) status.textContent = '中国地图已展开，十四座城市已标记。'
          mapRoot.setAttribute('aria-busy', 'false')
          mapRoot.classList.add('is-ready')
        }

        const scheduleRender = () => {
          window.cancelAnimationFrame(frame)
          frame = window.requestAnimationFrame(render)
        }

        scheduleRender()

        if ('ResizeObserver' in window) {
          const observer = new ResizeObserver(scheduleRender)
          observer.observe(canvas)
          cleanups.push(() => observer.disconnect())
        } else {
          window.addEventListener('resize', scheduleRender, {
            passive: true,
            signal: controller.signal
          })
        }

        cleanups.push(() => window.cancelAnimationFrame(frame))
      } catch (error) {
        if (error && error.name === 'AbortError') return
        mapRoot.setAttribute('aria-busy', 'false')
        mapRoot.classList.add('has-error')
        if (status) status.textContent = '中国地图暂未展开，城市清单仍可正常浏览。'
      }
    }, '800px 0px')
  }

  initializeReveals()
  initializeSceneProgress()
  initializeRouteIndex()
  initializeWorldMap()
  initializeChinaMap()
})()
