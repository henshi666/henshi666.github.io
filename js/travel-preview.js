(function () {
  const INSTANCE_KEY = '__travelPreviewInstance'
  const WORLD_MAP_URL = '/travel/data/world-land.geojson'
  const CHINA_MAP_URL = '/travel/data/china-provinces.geojson'
  const CHINA_CITIES_URL = '/travel/data/visited-cities.json'
  const CHINA_MAP_MIN_LATITUDE = 17.5

  const COLOR_SEA = '14, 118, 152'
  const COLOR_BRIGHT = '37, 168, 196'
  const COLOR_SAND = '226, 169, 95'
  const COLOR_FOAM = '255, 255, 255'

  if (window[INSTANCE_KEY] && typeof window[INSTANCE_KEY].destroy === 'function') {
    window[INSTANCE_KEY].destroy()
  }

  let destroyed = false
  const cleanupTasks = []

  function registerCleanup (task) {
    if (typeof task === 'function') cleanupTasks.push(task)
  }

  function destroyTravelPage () {
    if (destroyed) return
    destroyed = true
    while (cleanupTasks.length) {
      try {
        cleanupTasks.pop()()
      } catch (_) {}
    }
    document.documentElement.classList.remove('hs-travel-page', 'hs-travel-map-landing')
  }

  window[INSTANCE_KEY] = { destroy: destroyTravelPage }

  function getMapPalette (root) {
    const styles = window.getComputedStyle(root)
    const value = (name, fallback) => styles.getPropertyValue(name).trim() || fallback

    return {
      sea: value('--travel-map-sea', COLOR_SEA),
      bright: value('--travel-map-bright', COLOR_BRIGHT),
      land: value('--travel-map-land', COLOR_FOAM)
    }
  }

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
    const canvas = mapRoot.querySelector('#travel-world-map')
    const marker = mapRoot.querySelector('[data-map-lon][data-map-lat]')
    if (!canvas || !document.documentElement.contains(canvas)) return

    const rectangle = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rectangle.width))
    const height = Math.max(1, Math.round(rectangle.height))
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    const context = canvas.getContext('2d')
    const palette = getMapPalette(mapRoot)
    const bounds = mapData.__travelWorldBounds || getMapBounds(mapData.features)
    mapData.__travelWorldBounds = bounds
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

    context.fillStyle = `rgba(${palette.sea}, 0.13)`
    context.strokeStyle = `rgba(${palette.sea}, 0.38)`
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
      const longitude = Number(marker.dataset.mapLon)
      const latitude = Number(marker.dataset.mapLat)
      const markerPoint = toCanvasPoint([longitude, latitude])
      marker.style.left = `${(markerPoint[0] / width) * 100}%`
      marker.style.top = `${(markerPoint[1] / height) * 100}%`
    }

    mapRoot.classList.add('is-ready')
  }

  function initializeWorldMap (root) {
    const mapRoot = root.querySelector('[data-world-map-root]')
    if (!mapRoot || mapRoot.dataset.mapReady === 'true') return

    mapRoot.dataset.mapReady = 'true'

    fetch(WORLD_MAP_URL)
      .then(response => {
        if (!response.ok) throw new Error('World map data unavailable')
        return response.json()
      })
      .then(mapData => {
        if (destroyed || !document.documentElement.contains(mapRoot)) return

        let resizeFrame
        const draw = () => {
          window.cancelAnimationFrame(resizeFrame)
          resizeFrame = window.requestAnimationFrame(() => renderWorldMap(mapRoot, mapData))
        }
        mapRoot.__travelRedraw = draw
        registerCleanup(() => { mapRoot.__travelRedraw = null })

        draw()

        if ('ResizeObserver' in window) {
          const resizeObserver = new ResizeObserver(draw)
          resizeObserver.observe(mapRoot.querySelector('#travel-world-map'))
          registerCleanup(() => resizeObserver.disconnect())
        } else {
          window.addEventListener('resize', draw, { passive: true })
          registerCleanup(() => window.removeEventListener('resize', draw))
        }
        registerCleanup(() => window.cancelAnimationFrame(resizeFrame))
      })
      .catch(() => {
        if (destroyed || !document.documentElement.contains(mapRoot)) return
        mapRoot.classList.add('has-error')
        const status = mapRoot.querySelector('[data-map-status]')
        if (status) status.textContent = '海图暂时没有展开，可从右侧列表进入。'
      })
  }

  function getChinaProvinceCode (adcode) {
    const match = String(adcode || '').match(/^(\d{2})/)
    return match ? `${match[1]}0000` : ''
  }

  function getChinaMapBounds (features) {
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    }

    features.forEach(feature => {
      forEachMapRing(feature.geometry, ring => {
        ring.forEach(coordinate => {
          bounds.minX = Math.min(bounds.minX, coordinate[0])
          bounds.minY = Math.min(bounds.minY, coordinate[1])
          bounds.maxX = Math.max(bounds.maxX, coordinate[0])
          bounds.maxY = Math.max(bounds.maxY, coordinate[1])
        })
      })
    })

    bounds.minY = Math.max(bounds.minY, CHINA_MAP_MIN_LATITUDE)
    return bounds
  }

  function drawChinaFeature (context, feature, toCanvasPoint) {
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
  }

  function projectChinaPoint (coordinate, projection) {
    return [
      projection.offsetX + ((coordinate[0] - projection.bounds.minX) * projection.scale),
      projection.offsetY + ((projection.bounds.maxY - coordinate[1]) * projection.scale)
    ]
  }

  function renderChinaMap (mapRoot, mapData, cities, activeProvinceCode) {
    const canvas = mapRoot.querySelector('#travel-china-map')
    const markerLayer = mapRoot.querySelector('[data-china-marker-layer]')
    if (!canvas || !document.documentElement.contains(canvas)) return false

    const context = canvas.getContext('2d')
    if (!context) return false
    const palette = getMapPalette(mapRoot)

    const features = mapData.__travelProvinceFeatures || mapData.features.filter(feature => {
      return feature.properties && feature.properties.level === 'province'
    })
    mapData.__travelProvinceFeatures = features
    if (!features.length) return false

    const rectangle = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rectangle.width))
    const height = Math.max(1, Math.round(rectangle.height))
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    const bounds = mapData.__travelProvinceBounds || getChinaMapBounds(features)
    mapData.__travelProvinceBounds = bounds
    const horizontalPadding = width * 0.065
    const verticalPadding = height * 0.065
    const scale = Math.min(
      (width - (horizontalPadding * 2)) / (bounds.maxX - bounds.minX),
      (height - (verticalPadding * 2)) / (bounds.maxY - bounds.minY)
    )
    const mapWidth = (bounds.maxX - bounds.minX) * scale
    const mapHeight = (bounds.maxY - bounds.minY) * scale
    const offsetX = (width - mapWidth) / 2
    const offsetY = (height - mapHeight) / 2
    const visitedProvinceCodes = new Set(cities.map(city => city.provinceCode))
    const projection = { offsetX, offsetY, scale, bounds, width, height }

    mapRoot.__chinaProjection = projection

    function toCanvasPoint (coordinate) {
      return projectChinaPoint(coordinate, projection)
    }

    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.lineJoin = 'round'
    context.lineCap = 'round'

    context.save()
    context.beginPath()
    context.rect(offsetX - 2, offsetY - 2, mapWidth + 4, mapHeight + 4)
    context.clip()

    features.forEach(feature => {
      const provinceCode = String(feature.properties.adcode)
      if (provinceCode === activeProvinceCode) return

      context.fillStyle = visitedProvinceCodes.has(provinceCode)
        ? `rgba(${palette.bright}, 0.2)`
        : `rgba(${palette.sea}, 0.07)`
      context.strokeStyle = `rgba(${palette.sea}, 0.3)`
      context.lineWidth = 0.75
      drawChinaFeature(context, feature, toCanvasPoint)
    })

    const activeFeature = features.find(feature => {
      return String(feature.properties.adcode) === activeProvinceCode
    })

    if (activeFeature) {
      context.save()
      context.fillStyle = `rgba(${palette.bright}, 0.45)`
      context.strokeStyle = 'rgba(255, 255, 255, 0.95)'
      context.lineWidth = 1.3
      context.shadowColor = `rgba(${palette.bright}, 0.55)`
      context.shadowBlur = 14
      drawChinaFeature(context, activeFeature, toCanvasPoint)
      context.restore()
    }

    context.restore()

    if (markerLayer) {
      cities.forEach(city => {
        const marker = markerLayer.querySelector(`[data-city-id="${city.id}"]`)
        if (!marker) return

        const point = toCanvasPoint([city.longitude, city.latitude])
        marker.style.left = `${(point[0] / width) * 100}%`
        marker.style.top = `${(point[1] / height) * 100}%`
        marker.style.setProperty('--label-offset-x', `${city.labelOffsetX}px`)
        marker.style.setProperty('--label-offset-y', `${city.labelOffsetY}px`)
      })
    }

    canvas.setAttribute(
      'aria-label',
      `中国旅行地图，共标出${cities.length}座城市，当前选择${mapRoot.dataset.activeCityName || '城市'}，${mapRoot.dataset.activeProvinceName || '对应省份'}已高亮`
    )
    mapRoot.classList.add('is-ready')
    return true
  }

  /* A quiet, static route keeps the map readable without a permanent animation. */
  function initializeChinaRoute (mapRoot, cities) {
    const routeCanvas = mapRoot.querySelector('[data-china-route-canvas]')
    if (!routeCanvas || cities.length < 2) return

    const context = routeCanvas.getContext('2d')
    if (!context) return

    let frame

    function drawRoute () {
      const projection = mapRoot.__chinaProjection
      if (!projection) return false
      const palette = getMapPalette(mapRoot)

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = projection.width
      const height = projection.height

      if (routeCanvas.width !== Math.round(width * pixelRatio) ||
          routeCanvas.height !== Math.round(height * pixelRatio)) {
        routeCanvas.width = Math.round(width * pixelRatio)
        routeCanvas.height = Math.round(height * pixelRatio)
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)
      context.lineJoin = 'round'
      context.lineCap = 'round'

      const points = cities.map(city => projectChinaPoint([city.longitude, city.latitude], projection))

      context.beginPath()
      points.forEach((point, index) => {
        if (index === 0) {
          context.moveTo(point[0], point[1])
        } else {
          context.lineTo(point[0], point[1])
        }
      })
      context.strokeStyle = `rgba(${palette.sea}, 0.48)`
      context.lineWidth = 1.3
      context.setLineDash([6, 9])
      context.lineDashOffset = 0
      context.stroke()
      context.setLineDash([])

      return true
    }

    mapRoot.__travelRouteRedraw = drawRoute
    registerCleanup(() => { mapRoot.__travelRouteRedraw = null })

    const waitForProjection = () => {
      if (destroyed || !document.documentElement.contains(routeCanvas)) return
      if (!drawRoute()) frame = window.requestAnimationFrame(waitForProjection)
    }
    waitForProjection()
    registerCleanup(() => window.cancelAnimationFrame(frame))
  }

  function readChinaCityCopy (mapRoot) {
    const copyByCity = new Map()

    mapRoot.querySelectorAll('[data-city-select][data-city-id]').forEach(item => {
      if (!copyByCity.has(item.dataset.cityId) && item.dataset.cityCopy) {
        copyByCity.set(item.dataset.cityId, item.dataset.cityCopy)
      }
    })

    return copyByCity
  }

  function normalizeChinaCities (cityData, copyByCity) {
    if (!Array.isArray(cityData)) return []

    return cityData.map((city, index) => {
      const longitude = Number(city.longitude)
      const latitude = Number(city.latitude)
      const id = String(city.id || '')
      const name = String(city.name || '')

      if (!id || !name || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
      }

      return {
        id,
        name,
        province: String(city.province || ''),
        region: String(city.region || ''),
        adcode: String(city.adcode || ''),
        provinceCode: getChinaProvinceCode(city.adcode),
        longitude,
        latitude,
        labelOffsetX: Number(city.labelOffsetX) || 0,
        labelOffsetY: Number(city.labelOffsetY) || 0,
        href: typeof city.href === 'string' ? city.href.trim() : '',
        copy: copyByCity.get(id) || `${name}的手记还在整理，坐标先亮着。`,
        index
      }
    }).filter(Boolean)
  }

  function createChinaCityMarker (city) {
    const marker = document.createElement('button')
    const dot = document.createElement('span')
    const label = document.createElement('span')

    marker.className = 'china-city-marker'
    marker.type = 'button'
    marker.dataset.citySelect = ''
    marker.dataset.cityId = city.id
    marker.dataset.cityName = city.name
    marker.dataset.cityProvince = city.province
    marker.dataset.provinceId = city.provinceCode
    marker.dataset.mapLon = String(city.longitude)
    marker.dataset.mapLat = String(city.latitude)
    marker.dataset.cityCopy = city.copy
    marker.dataset.cityHref = city.href
    marker.setAttribute('aria-label', `选择${city.name}，${city.province}`)
    marker.setAttribute('aria-pressed', 'false')

    dot.className = 'china-city-marker__dot'
    dot.setAttribute('aria-hidden', 'true')
    label.className = 'china-city-marker__label'
    label.textContent = city.name
    marker.append(dot, label)

    return marker
  }

  function createChinaCityListItem (city, total) {
    const item = document.createElement('li')
    const button = document.createElement('button')
    const index = document.createElement('span')
    const name = document.createElement('span')
    const province = document.createElement('span')

    button.className = 'china-city-list__item'
    button.type = 'button'
    button.dataset.citySelect = ''
    button.dataset.cityId = city.id
    button.dataset.cityName = city.name
    button.dataset.cityProvince = city.province
    button.dataset.provinceId = city.provinceCode
    button.dataset.mapLon = String(city.longitude)
    button.dataset.mapLat = String(city.latitude)
    button.dataset.cityCopy = city.copy
    button.dataset.cityHref = city.href
    button.setAttribute('aria-label', `选择${city.name}，${city.province}，第${city.index + 1}个，共${total}个`)
    button.setAttribute('aria-pressed', 'false')

    index.className = 'china-city-list__index'
    index.textContent = String(city.index + 1).padStart(2, '0')
    name.className = 'china-city-list__name'
    name.textContent = city.name
    province.className = 'china-city-list__province'
    province.textContent = city.province
    button.append(index, name, province)
    item.append(button)

    return item
  }

  function buildChinaCityControls (mapRoot, cities) {
    const markerLayer = mapRoot.querySelector('[data-china-marker-layer]')
    const cityList = mapRoot.querySelector('[data-china-city-list]')

    if (!markerLayer || !cityList) return []

    const markerFragment = document.createDocumentFragment()
    const listFragment = document.createDocumentFragment()

    cities.forEach(city => {
      markerFragment.append(createChinaCityMarker(city))
      listFragment.append(createChinaCityListItem(city, cities.length))
    })

    markerLayer.replaceChildren(markerFragment)
    cityList.replaceChildren(listFragment)
    markerLayer.setAttribute('role', 'group')
    markerLayer.setAttribute('aria-label', `旅行城市地图标记，共${cities.length}座城市`)
    cityList.setAttribute('aria-label', `旅行城市列表，共${cities.length}座城市`)

    return Array.from(mapRoot.querySelectorAll('[data-city-select][data-city-id]'))
  }

  function createChinaJournalRow (city, total) {
    const item = document.createElement('li')
    const button = document.createElement('button')
    const index = document.createElement('span')
    const cityCell = document.createElement('span')
    const cityName = document.createElement('strong')
    const cityMeta = document.createElement('em')
    const note = document.createElement('span')
    const coordinate = document.createElement('span')
    const arrow = document.createElement('span')

    button.className = 'log-journal__row'
    button.type = 'button'
    button.dataset.journalCity = city.id
    button.setAttribute(
      'aria-label',
      `${city.name}，${city.province}，第${city.index + 1}个，共${total}个，在地图上查看`
    )

    index.className = 'log-journal__index'
    index.textContent = String(city.index + 1).padStart(2, '0')

    cityCell.className = 'log-journal__city'
    cityName.textContent = city.name
    cityMeta.textContent = city.region ? `${city.province} · ${city.region}` : city.province
    cityCell.append(cityName, cityMeta)

    note.className = 'log-journal__note'
    note.textContent = city.copy

    coordinate.className = 'log-journal__coord'
    coordinate.textContent = `${city.latitude.toFixed(2)}° N · ${city.longitude.toFixed(2)}° E`

    arrow.className = 'log-journal__go'
    arrow.setAttribute('aria-hidden', 'true')
    arrow.textContent = '→'

    button.append(index, cityCell, note, coordinate, arrow)
    item.append(button)

    return item
  }

  function updateChinaCityDetail (mapRoot, cities, activeCity) {
    const detail = mapRoot.querySelector('[data-city-detail]')
    if (!detail) return

    const index = detail.querySelector('[data-city-detail-index]')
    const name = detail.querySelector('[data-city-detail-name]')
    const province = detail.querySelector('[data-city-detail-province]')
    const coordinate = detail.querySelector('[data-city-detail-coordinate]')
    const copy = detail.querySelector('[data-city-detail-copy]')
    const link = detail.querySelector('[data-city-detail-link]')

    detail.setAttribute('aria-live', 'polite')
    if (index) index.textContent = `${String(activeCity.index + 1).padStart(2, '0')} / ${String(cities.length).padStart(2, '0')}`
    if (name) name.textContent = activeCity.name
    if (province) {
      province.textContent = activeCity.region
        ? `${activeCity.province} · ${activeCity.region}`
        : activeCity.province
    }
    if (coordinate) {
      coordinate.textContent = `${activeCity.latitude.toFixed(4)}° N · ${activeCity.longitude.toFixed(4)}° E`
    }
    if (copy) copy.textContent = activeCity.copy

    if (!link) return

    if (activeCity.href) {
      const arrow = document.createElement('span')
      arrow.setAttribute('aria-hidden', 'true')
      arrow.textContent = '→'
      link.href = activeCity.href
      link.classList.remove('is-disabled')
      link.removeAttribute('aria-disabled')
      link.setAttribute('aria-label', `进入${activeCity.name}旅行记录`)
      link.replaceChildren(document.createTextNode('读这座城市的手记 '), arrow)
    } else {
      link.removeAttribute('href')
      link.classList.add('is-disabled')
      link.setAttribute('aria-disabled', 'true')
      link.setAttribute('aria-label', `${activeCity.name}的手记还在整理`)
      link.textContent = '手记整理中'
    }
  }

  function showChinaMapError (mapRoot) {
    mapRoot.classList.remove('is-ready')
    mapRoot.classList.add('has-error')
    mapRoot.setAttribute('aria-busy', 'false')

    const status = mapRoot.querySelector('[data-china-map-status]')
    if (status) {
      status.setAttribute('role', 'status')
      status.setAttribute('aria-live', 'polite')
      status.textContent = '中国地图暂时无法加载，请稍后再试。'
    }
  }

  function initializeChinaMap (root) {
    const mapRoot = root.querySelector('[data-china-map-root]')
    if (!mapRoot || mapRoot.dataset.mapReady === 'true') return

    const canvas = mapRoot.querySelector('#travel-china-map')
    const status = mapRoot.querySelector('[data-china-map-status]')
    const copyByCity = readChinaCityCopy(mapRoot)

    if (!canvas) {
      showChinaMapError(mapRoot)
      return
    }

    mapRoot.dataset.mapReady = 'true'
    mapRoot.setAttribute('aria-busy', 'true')
    if (status) {
      status.setAttribute('role', 'status')
      status.setAttribute('aria-live', 'polite')
    }

    Promise.all([
      fetch(CHINA_MAP_URL).then(response => {
        if (!response.ok) throw new Error('China map data unavailable')
        return response.json()
      }),
      fetch(CHINA_CITIES_URL).then(response => {
        if (!response.ok) throw new Error('China city data unavailable')
        return response.json()
      })
    ])
      .then(([mapData, cityData]) => {
        if (destroyed || !document.documentElement.contains(mapRoot)) return
        if (!mapData || !Array.isArray(mapData.features)) {
          throw new Error('Invalid China map data')
        }

        const cities = normalizeChinaCities(cityData, copyByCity)
        if (!cities.length) throw new Error('Invalid China city data')

        const controls = buildChinaCityControls(mapRoot, cities)
        if (!controls.length) throw new Error('China city controls unavailable')

        let journalRows = []
        let activeProvinceCode = ''
        let resizeFrame
        let resizeObserver

        const draw = () => {
          window.cancelAnimationFrame(resizeFrame)
          resizeFrame = window.requestAnimationFrame(() => {
            if (!document.documentElement.contains(mapRoot)) {
              if (resizeObserver) resizeObserver.disconnect()
              window.removeEventListener('resize', draw)
              return
            }

            if (!renderChinaMap(mapRoot, mapData, cities, activeProvinceCode)) {
              showChinaMapError(mapRoot)
            } else if (typeof mapRoot.__travelRouteRedraw === 'function') {
              mapRoot.__travelRouteRedraw()
            }
          })
        }
        mapRoot.__travelRedraw = draw
        registerCleanup(() => { mapRoot.__travelRedraw = null })

        const selectCity = cityId => {
          const activeCity = cities.find(city => city.id === cityId)
          if (!activeCity) return

          activeProvinceCode = activeCity.provinceCode
          mapRoot.dataset.activeCity = activeCity.id
          mapRoot.dataset.activeCityName = activeCity.name
          mapRoot.dataset.activeProvinceName = activeCity.province

          controls.forEach(control => {
            const controlCity = cities.find(city => city.id === control.dataset.cityId)
            const isActive = control.dataset.cityId === activeCity.id
            const isSameProvince = controlCity &&
              controlCity.provinceCode === activeCity.provinceCode

            control.classList.toggle('is-active', isActive)
            control.classList.toggle('is-province-active', Boolean(isSameProvince))
            control.setAttribute('aria-pressed', String(isActive))
          })

          journalRows.forEach(row => {
            row.classList.toggle('is-active', row.dataset.journalCity === activeCity.id)
          })

          updateChinaCityDetail(mapRoot, cities, activeCity)
          draw()
        }

        controls.forEach(control => {
          control.addEventListener('click', () => selectCity(control.dataset.cityId))
        })

        const journal = document.querySelector('[data-china-journal]')
        if (journal) {
          const fragment = document.createDocumentFragment()
          cities.forEach(city => fragment.append(createChinaJournalRow(city, cities.length)))
          journal.replaceChildren(fragment)
          journalRows = Array.from(journal.querySelectorAll('[data-journal-city]'))

          journalRows.forEach(row => {
            row.addEventListener('click', () => {
              selectCity(row.dataset.journalCity)
              const mapCard = mapRoot.querySelector('.china-atlas__map-card')
              if (mapCard) mapCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
            })
          })
        }

        selectCity(cities[0].id)
        initializeChinaRoute(mapRoot, cities)
        mapRoot.classList.remove('has-error')
        mapRoot.setAttribute('aria-busy', 'false')
        if (status) status.textContent = `中国旅行地图已加载，可选择${cities.length}座城市。`

        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(draw)
          resizeObserver.observe(canvas)
          registerCleanup(() => resizeObserver.disconnect())
        } else {
          window.addEventListener('resize', draw, { passive: true })
          registerCleanup(() => window.removeEventListener('resize', draw))
        }
        registerCleanup(() => window.cancelAnimationFrame(resizeFrame))
      })
      .catch(() => {
        if (!destroyed && document.documentElement.contains(mapRoot)) showChinaMapError(mapRoot)
      })
  }

  function initializeTravelCounters (root) {
    const counters = Array.from(root.querySelectorAll('[data-travel-count]'))
    if (!counters.length) return

    const setCounterValue = (counter, value) => {
      const padding = Math.max(0, Number(counter.dataset.travelCountPad) || 0)
      counter.textContent = String(value).padStart(padding, '0')
    }

    counters.forEach(counter => {
      const target = Math.max(0, Number(counter.dataset.travelCount) || 0)
      counter.dataset.countReady = 'true'
      setCounterValue(counter, target)
    })
  }

  /* Compass needle follows the pointer inside the hero, then sways idly. */
  function initializeCompass (root) {
    if (prefersReducedMotion()) return

    root.querySelectorAll('[data-compass]').forEach(compass => {
      if (compass.dataset.compassReady === 'true') return

      const needle = compass.querySelector('[data-compass-needle]')
      const hero = compass.closest('[data-hero]')
      if (!needle || !hero) return

      compass.dataset.compassReady = 'true'
      compass.classList.add('is-idle')

      let idleTimer

      hero.addEventListener('pointermove', event => {
        if (event.pointerType && event.pointerType !== 'mouse') return

        const rectangle = compass.getBoundingClientRect()
        if (!rectangle.width) return

        const centerX = rectangle.left + (rectangle.width / 2)
        const centerY = rectangle.top + (rectangle.height / 2)
        const angle = Math.atan2(event.clientX - centerX, centerY - event.clientY) * (180 / Math.PI)

        compass.classList.remove('is-idle')
        needle.style.transform = `rotate(${angle.toFixed(1)}deg)`

        window.clearTimeout(idleTimer)
        idleTimer = window.setTimeout(() => {
          needle.style.transform = ''
          compass.classList.add('is-idle')
        }, 2600)
      })
    })
  }

  /* Drifting light specks in the hero, like plankton in dark water. */
  function initializeHeroParticles (root) {
    const reducedMotion = prefersReducedMotion()

    root.querySelectorAll('[data-log-particles]').forEach(canvas => {
      if (canvas.dataset.particlesReady === 'true') return
      canvas.dataset.particlesReady = 'true'

      const context = canvas.getContext('2d')
      if (!context) return

      let width = 0
      let height = 0
      let ratio = 1
      let particles = []
      let running = false
      let frame

      function createParticle (fromEdge) {
        return {
          x: Math.random() * width,
          y: fromEdge ? height + 6 : Math.random() * height,
          radius: 0.6 + (Math.random() * 1.2),
          driftX: 0.02 + (Math.random() * 0.09),
          driftY: -(0.015 + (Math.random() * 0.05)),
          phase: Math.random() * Math.PI * 2,
          amber: Math.random() < 0.22
        }
      }

      const resize = () => {
        const rectangle = canvas.getBoundingClientRect()
        width = Math.max(1, Math.round(rectangle.width))
        height = Math.max(1, Math.round(rectangle.height))
        ratio = Math.min(window.devicePixelRatio || 1, 1.5)
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)

        const count = Math.min(64, Math.max(20, Math.round((width * height) / 26000)))
        if (particles.length !== count) {
          particles = Array.from({ length: count }, () => createParticle(false))
        }
      }

      const drawFrame = time => {
        context.setTransform(ratio, 0, 0, ratio, 0, 0)
        context.clearRect(0, 0, width, height)

        particles.forEach(particle => {
          if (!reducedMotion) {
            particle.x += particle.driftX
            particle.y += particle.driftY

            if (particle.y < -8 || particle.x > width + 8) {
              Object.assign(particle, createParticle(true))
            }
          }

          const twinkle = 0.22 + (0.3 * ((1 + Math.sin(particle.phase + (time * 0.0011))) / 2))
          context.beginPath()
          context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
          context.fillStyle = particle.amber
            ? `rgba(${COLOR_SAND}, ${twinkle.toFixed(3)})`
            : `rgba(${COLOR_FOAM}, ${(twinkle * 0.9).toFixed(3)})`
          context.fill()
        })
      }

      const loop = time => {
        if (!running || !document.documentElement.contains(canvas)) return
        drawFrame(time)
        frame = window.requestAnimationFrame(loop)
      }

      const start = () => {
        if (running) return
        running = true
        frame = window.requestAnimationFrame(loop)
      }

      const stop = () => {
        running = false
        window.cancelAnimationFrame(frame)
      }

      resize()

      if ('ResizeObserver' in window) {
        const resizeObserver = new ResizeObserver(() => {
          resize()
          if (reducedMotion) drawFrame(0)
        })
        resizeObserver.observe(canvas)
      } else {
        window.addEventListener('resize', resize, { passive: true })
      }

      if (reducedMotion) {
        drawFrame(0)
        return
      }

      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              start()
            } else {
              stop()
            }
          })
        }, { threshold: 0.05 })
        observer.observe(canvas)
      } else {
        start()
      }

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          stop()
        } else if (canvas.getBoundingClientRect().height > 0) {
          start()
        }
      })
    })
  }

  /* Layered parallax: rose, rhumb lines and grid drift as the pointer moves. */
  function initializeHeroParallax (root) {
    if (prefersReducedMotion()) return

    root.querySelectorAll('[data-hero]').forEach(hero => {
      if (hero.dataset.parallaxReady === 'true') return
      hero.dataset.parallaxReady = 'true'

      hero.addEventListener('pointermove', event => {
        if (event.pointerType && event.pointerType !== 'mouse') return

        const rectangle = hero.getBoundingClientRect()
        if (!rectangle.width || !rectangle.height) return

        const normalizedX = ((event.clientX - rectangle.left) / rectangle.width) - 0.5
        const normalizedY = ((event.clientY - rectangle.top) / rectangle.height) - 0.5
        hero.style.setProperty('--parallax-x', `${(normalizedX * 22).toFixed(1)}px`)
        hero.style.setProperty('--parallax-y', `${(normalizedY * 16).toFixed(1)}px`)
      })

      hero.addEventListener('pointerleave', () => {
        hero.style.setProperty('--parallax-x', '0px')
        hero.style.setProperty('--parallax-y', '0px')
      })
    })
  }

  /* Warm searchlight that follows the pointer across the charts. */
  function initializeChartGlow (root) {
    root.querySelectorAll('[data-chart-glow]').forEach(shell => {
      if (shell.dataset.glowReady === 'true') return
      shell.dataset.glowReady = 'true'

      shell.querySelectorAll('.world-atlas__chart, .china-atlas__map').forEach(area => {
        area.addEventListener('pointermove', event => {
          if (event.pointerType && event.pointerType !== 'mouse') return

          const rectangle = area.getBoundingClientRect()
          if (!rectangle.width || !rectangle.height) return

          const x = ((event.clientX - rectangle.left) / rectangle.width) * 100
          const y = ((event.clientY - rectangle.top) / rectangle.height) * 100
          area.style.setProperty('--glow-x', `${x.toFixed(1)}%`)
          area.style.setProperty('--glow-y', `${y.toFixed(1)}%`)
          area.classList.add('is-glowing')
        })

        area.addEventListener('pointerleave', () => {
          area.classList.remove('is-glowing')
        })
      })
    })
  }

  function updateTravelPage () {
    const root = document.getElementById('travel-page')
    const pageActive = Boolean(root)
    const mapLandingActive = Boolean(root && root.classList.contains('travel-map-landing'))

    document.documentElement.classList.toggle('hs-travel-page', pageActive)
    document.documentElement.classList.toggle('hs-travel-map-landing', mapLandingActive)
    if (!root || root.dataset.ready === 'true') return

    root.dataset.ready = 'true'
    root.classList.add('travel-js')
    initializeWorldMap(root)
    initializeChinaMap(root)
    initializeTravelCounters(root)

    const revealItems = root.querySelectorAll('.travel-reveal')
    const reducedMotion = prefersReducedMotion()

    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach(item => item.classList.add('is-visible'))
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      }, {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.08
      })

      revealItems.forEach(item => observer.observe(item))
      registerCleanup(() => observer.disconnect())
    }

    if ('MutationObserver' in window) {
      const themeObserver = new MutationObserver(() => {
        const worldRoot = root.querySelector('[data-world-map-root]')
        const chinaRoot = root.querySelector('[data-china-map-root]')
        if (worldRoot && typeof worldRoot.__travelRedraw === 'function') worldRoot.__travelRedraw()
        if (chinaRoot && typeof chinaRoot.__travelRedraw === 'function') chinaRoot.__travelRedraw()
      })
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      registerCleanup(() => themeObserver.disconnect())
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateTravelPage)
    registerCleanup(() => document.removeEventListener('DOMContentLoaded', updateTravelPage))
  } else {
    updateTravelPage()
  }

  document.addEventListener('pjax:send', destroyTravelPage, { once: true })
  registerCleanup(() => document.removeEventListener('pjax:send', destroyTravelPage))
})()
