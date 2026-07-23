(function () {
  const WORLD_MAP_URL = '/travel/data/world-land.geojson'
  const CHINA_MAP_URL = '/travel/data/china-provinces.geojson'
  const CHINA_CITIES_URL = '/travel/data/visited-cities.json'
  const CHINA_MAP_MIN_LATITUDE = 17.5

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
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const context = canvas.getContext('2d')
    const bounds = getMapBounds(mapData.features)
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

    const oceanGlow = context.createRadialGradient(
      width * 0.62,
      height * 0.48,
      0,
      width * 0.62,
      height * 0.48,
      width * 0.52
    )
    oceanGlow.addColorStop(0, 'rgba(77, 190, 211, 0.06)')
    oceanGlow.addColorStop(1, 'rgba(77, 190, 211, 0)')
    context.fillStyle = oceanGlow
    context.fillRect(0, 0, width, height)

    context.fillStyle = 'rgba(211, 237, 241, 0.24)'
    context.strokeStyle = 'rgba(214, 243, 247, 0.32)'
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
        if (!document.documentElement.contains(mapRoot)) return

        let resizeFrame
        const draw = () => {
          window.cancelAnimationFrame(resizeFrame)
          resizeFrame = window.requestAnimationFrame(() => renderWorldMap(mapRoot, mapData))
        }

        draw()

        if ('ResizeObserver' in window) {
          const resizeObserver = new ResizeObserver(draw)
          resizeObserver.observe(mapRoot.querySelector('#travel-world-map'))
        } else {
          window.addEventListener('resize', draw, { passive: true })
        }
      })
      .catch(() => {
        mapRoot.classList.add('has-error')
        const status = mapRoot.querySelector('[data-map-status]')
        if (status) status.textContent = '地图暂时没有浮现，可从右侧列表进入。'
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

  function renderChinaMap (mapRoot, mapData, cities, activeProvinceCode) {
    const canvas = mapRoot.querySelector('#travel-china-map')
    const markerLayer = mapRoot.querySelector('[data-china-marker-layer]')
    if (!canvas || !document.documentElement.contains(canvas)) return false

    const context = canvas.getContext('2d')
    if (!context) return false

    const features = mapData.features.filter(feature => {
      return feature.properties && feature.properties.level === 'province'
    })
    if (!features.length) return false

    const rectangle = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rectangle.width))
    const height = Math.max(1, Math.round(rectangle.height))
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const bounds = getChinaMapBounds(features)
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

    function toCanvasPoint (coordinate) {
      return [
        offsetX + ((coordinate[0] - bounds.minX) * scale),
        offsetY + ((bounds.maxY - coordinate[1]) * scale)
      ]
    }

    canvas.width = Math.round(width * pixelRatio)
    canvas.height = Math.round(height * pixelRatio)
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.lineJoin = 'round'
    context.lineCap = 'round'

    const mapGlow = context.createRadialGradient(
      width * 0.68,
      height * 0.58,
      0,
      width * 0.68,
      height * 0.58,
      width * 0.58
    )
    mapGlow.addColorStop(0, 'rgba(71, 190, 202, 0.08)')
    mapGlow.addColorStop(1, 'rgba(71, 190, 202, 0)')
    context.fillStyle = mapGlow
    context.fillRect(0, 0, width, height)

    context.save()
    context.beginPath()
    context.rect(offsetX, offsetY, mapWidth, mapHeight)
    context.clip()

    features.forEach(feature => {
      const provinceCode = String(feature.properties.adcode)
      if (provinceCode === activeProvinceCode) return

      context.fillStyle = visitedProvinceCodes.has(provinceCode)
        ? 'rgba(159, 221, 226, 0.24)'
        : 'rgba(206, 236, 239, 0.14)'
      context.strokeStyle = 'rgba(211, 242, 244, 0.34)'
      context.lineWidth = 0.75
      drawChinaFeature(context, feature, toCanvasPoint)
    })

    const activeFeature = features.find(feature => {
      return String(feature.properties.adcode) === activeProvinceCode
    })

    if (activeFeature) {
      context.save()
      context.fillStyle = 'rgba(76, 199, 207, 0.52)'
      context.strokeStyle = 'rgba(207, 249, 247, 0.92)'
      context.lineWidth = 1.35
      context.shadowColor = 'rgba(75, 212, 218, 0.44)'
      context.shadowBlur = 13
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
        copy: copyByCity.get(id) || `${name}的坐标已经点亮，旅行记录还在慢慢整理。`,
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
      link.setAttribute('aria-label', `${activeCity.name}旅行记录待补充`)
      link.textContent = '旅行记录待补充'
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
        if (!document.documentElement.contains(mapRoot)) return
        if (!mapData || !Array.isArray(mapData.features)) {
          throw new Error('Invalid China map data')
        }

        const cities = normalizeChinaCities(cityData, copyByCity)
        if (!cities.length) throw new Error('Invalid China city data')

        const controls = buildChinaCityControls(mapRoot, cities)
        if (!controls.length) throw new Error('China city controls unavailable')

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
            }
          })
        }

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

          updateChinaCityDetail(mapRoot, cities, activeCity)
          draw()
        }

        controls.forEach(control => {
          control.addEventListener('click', () => selectCity(control.dataset.cityId))
        })

        selectCity(cities[0].id)
        mapRoot.classList.remove('has-error')
        mapRoot.setAttribute('aria-busy', 'false')
        if (status) status.textContent = `中国旅行地图已加载，可选择${cities.length}座城市。`

        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(draw)
          resizeObserver.observe(canvas)
        } else {
          window.addEventListener('resize', draw, { passive: true })
        }
      })
      .catch(() => showChinaMapError(mapRoot))
  }

  function initializeTravelCounters (root) {
    const counters = Array.from(root.querySelectorAll('[data-travel-count]'))
    if (!counters.length) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const setCounterValue = (counter, value) => {
      const padding = Math.max(0, Number(counter.dataset.travelCountPad) || 0)
      counter.textContent = String(value).padStart(padding, '0')
    }

    const animateCounter = counter => {
      if (counter.dataset.countReady === 'true') return

      const target = Math.max(0, Number(counter.dataset.travelCount) || 0)
      counter.dataset.countReady = 'true'

      if (reducedMotion) {
        setCounterValue(counter, target)
        return
      }

      const duration = 1050
      const startedAt = window.performance.now()
      setCounterValue(counter, 0)

      const update = now => {
        if (!document.documentElement.contains(counter)) return

        const progress = Math.min(1, (now - startedAt) / duration)
        const easedProgress = 1 - Math.pow(1 - progress, 3)
        setCounterValue(counter, Math.round(target * easedProgress))

        if (progress < 1) window.requestAnimationFrame(update)
      }

      window.requestAnimationFrame(update)
    }

    if (reducedMotion || !('IntersectionObserver' in window)) {
      counters.forEach(animateCounter)
      return
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        animateCounter(entry.target)
        observer.unobserve(entry.target)
      })
    }, {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.35
    })

    counters.forEach(counter => observer.observe(counter))
  }

  function initializeTravelRouteTicker (root) {
    const ticker = root.querySelector('.travel-route-ticker')
    const toggle = ticker && ticker.querySelector('[data-route-ticker-toggle]')
    if (!ticker || !toggle || ticker.dataset.tickerReady === 'true') return

    const label = toggle.querySelector('[data-route-ticker-toggle-label]')
    ticker.dataset.tickerReady = 'true'

    toggle.addEventListener('click', () => {
      const isPaused = !ticker.classList.contains('is-paused')

      ticker.classList.toggle('is-paused', isPaused)
      toggle.setAttribute('aria-pressed', String(isPaused))
      toggle.setAttribute('aria-label', isPaused ? '继续城市航海日志滚动' : '暂停城市航海日志滚动')
      if (label) label.textContent = isPaused ? '继续' : '暂停'
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
    initializeTravelRouteTicker(root)

    const revealItems = root.querySelectorAll('.travel-reveal')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
    }

    root.querySelectorAll('[data-travel-target]').forEach(link => {
      link.addEventListener('click', () => {
        const story = document.getElementById(link.dataset.travelTarget)
        if (!story) return

        root.querySelectorAll('.ocean-place').forEach(place => place.classList.remove('is-active'))
        root.querySelectorAll('.ocean-story').forEach(item => item.classList.remove('is-highlighted'))
        link.classList.add('is-active')
        story.classList.add('is-highlighted')

        window.setTimeout(() => story.classList.remove('is-highlighted'), 1800)
      })
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateTravelPage)
  } else {
    updateTravelPage()
  }

  document.addEventListener('pjax:complete', updateTravelPage)
})()
