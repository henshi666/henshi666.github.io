(function () {
  const STORAGE_KEY = 'hs-blog-music-state'
  let isPjaxNavigating = false
  let isRestoringPlayback = false
  let shouldResumeAfterPjax = false
  let lastTimeUpdateAt = 0

  const TRACKS = [
    { name: '爱，很简单', artist: '陶喆', url: '/music/ai-hen-jiandan-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '爱我还是他', artist: '陶喆', url: '/music/ai-wo-haishi-ta-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '二十二', artist: '陶喆', url: '/music/ershier-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '飞机场的10点30', artist: '陶喆', url: '/music/jichang-10-30-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '蝴蝶', artist: '陶喆', url: '/music/hudie-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '寂寞的季节', artist: '陶喆', url: '/music/jimo-de-jijie-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '今天你要嫁给我', artist: '蔡依林 / 陶喆', url: '/music/jintian-ni-yao-jiageiwo-jolin-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '就是爱你', artist: '陶喆', url: '/music/jiushi-ai-ni-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '流沙', artist: '陶喆', url: '/music/liusha-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: 'Melody', artist: '陶喆', url: '/music/melody-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '那个女孩', artist: '陶喆 / 卢广仲', url: '/music/nage-nvhai-tao-zhe-lu-guangzhong.mp3', cover: '/img/headImage.jpg' },
    { name: '普通朋友', artist: '陶喆', url: '/music/putong-pengyou-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: 'Susan 说', artist: '陶喆', url: '/music/susan-shuo-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '讨厌红楼梦', artist: '陶喆', url: '/music/taoyan-hongloumeng-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '天天', artist: '陶喆', url: '/music/tiantian-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '小镇姑娘', artist: '陶喆', url: '/music/xiaozhen-guniang-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '心乱飞', artist: '陶喆', url: '/music/xin-luan-fei-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '月亮代表谁的心', artist: '陶喆', url: '/music/yueliang-daibiao-sheide-xin-tao-zhe.mp3', cover: '/img/headImage.jpg' },
    { name: '找自己', artist: '陶喆', url: '/music/zhao-ziji-tao-zhe.mp3', cover: '/img/headImage.jpg' }
  ]

  function isHomePage () {
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
    return path === '/' && !!document.getElementById('recent-posts')
  }

  function formatTime (seconds, fallback) {
    if (!Number.isFinite(seconds) || seconds < 0) return fallback

    const minutes = Math.floor(seconds / 60)
    const remainder = Math.floor(seconds % 60)
    return `${minutes}:${String(remainder).padStart(2, '0')}`
  }

  function syncMusicCard (player) {
    const card = document.getElementById('hs-music-card')
    if (!card || !player || !player.audio) return

    const index = player.list && Number.isFinite(player.list.index) ? player.list.index : 0
    const track = TRACKS[index] || TRACKS[0]
    const playing = !player.audio.paused
    const duration = player.audio.duration
    const currentTime = player.audio.currentTime || 0
    const progressValue = Number.isFinite(duration) && duration > 0
      ? Math.min(100, Math.max(0, currentTime / duration * 100))
      : 0

    const cover = card.querySelector('[data-hs-music-cover]')
    const title = card.querySelector('[data-hs-music-title]')
    const artist = card.querySelector('[data-hs-music-artist]')
    const position = card.querySelector('[data-hs-music-position]')
    const playButton = card.querySelector('[data-hs-music-play]')
    const playIcon = playButton && playButton.querySelector('i')
    const progress = card.querySelector('[data-hs-music-progress]')
    const elapsed = card.querySelector('[data-hs-music-elapsed]')
    const total = card.querySelector('[data-hs-music-duration]')

    card.classList.toggle('is-playing', playing)

    if (cover) {
      cover.src = track.cover
      cover.alt = `《${track.name}》封面`
    }
    if (title) title.textContent = track.name
    if (artist) artist.textContent = track.artist
    if (position) position.textContent = `${index + 1} / ${TRACKS.length}`
    if (playButton) {
      playButton.setAttribute('aria-label', `${playing ? '暂停' : '播放'}《${track.name}》`)
      playButton.setAttribute('aria-pressed', String(playing))
      playButton.title = playing ? '暂停' : '播放'
    }
    if (playIcon) playIcon.className = playing ? 'fas fa-pause' : 'fas fa-play'
    if (progress) {
      progress.value = String(progressValue)
      progress.style.setProperty('--hs-music-progress', `${progressValue}%`)
      progress.setAttribute('aria-valuetext', `${formatTime(currentTime, '0:00')} / ${formatTime(duration, '--:--')}`)
    }
    if (elapsed) elapsed.textContent = formatTime(currentTime, '0:00')
    if (total) total.textContent = formatTime(duration, '--:--')
  }

  function bindMusicCardControls (card) {
    if (!card || card.dataset.hsMusicBound === 'true') return
    card.dataset.hsMusicBound = 'true'

    const playButton = card.querySelector('[data-hs-music-play]')
    const nextButton = card.querySelector('[data-hs-music-next]')
    const progress = card.querySelector('[data-hs-music-progress]')

    if (playButton) {
      playButton.addEventListener('click', () => {
        const player = window.hsBlogAPlayer
        if (!player || !player.audio) return

        if (player.audio.paused) {
          requestPlayback(player, true)
        } else {
          player.pause()
        }
      })
    }

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        const player = window.hsBlogAPlayer
        if (!player || !player.audio || !player.list) return

        const keepPlaying = !player.audio.paused
        if (typeof player.skipForward === 'function') {
          player.skipForward()
        } else {
          player.list.switch((player.list.index + 1) % TRACKS.length)
        }

        window.setTimeout(() => {
          syncMusicCard(player)
          if (keepPlaying && player.audio.paused) requestPlayback(player, true)
        }, 80)
      })
    }

    if (progress) {
      progress.addEventListener('input', event => {
        const player = window.hsBlogAPlayer
        if (!player || !player.audio || !Number.isFinite(player.audio.duration)) return

        const value = Number(event.currentTarget.value)
        player.seek(player.audio.duration * value / 100)
        syncMusicCard(player)
      })
    }
  }

  function placeMusicCard (card, aside) {
    const useCompactLayout = window.matchMedia('(max-width: 900px)').matches
    const recentPosts = document.getElementById('recent-posts')
    const recentPostItems = recentPosts && recentPosts.querySelector('.recent-post-items')

    if (useCompactLayout && recentPosts && recentPostItems) {
      if (card.parentElement !== recentPosts || card.nextElementSibling !== recentPostItems) {
        recentPosts.insertBefore(card, recentPostItems)
      }
      return
    }

    const clockCard = document.getElementById('my-clock-card')
    const stickyLayout = aside.querySelector('.sticky_layout')
    if (clockCard && clockCard.parentElement === aside) {
      if (card.previousElementSibling !== clockCard) clockCard.insertAdjacentElement('afterend', card)
    } else if (stickyLayout) {
      if (card.parentElement !== aside || card.nextElementSibling !== stickyLayout) aside.insertBefore(card, stickyLayout)
    } else if (card.parentElement !== aside) {
      aside.appendChild(card)
    }
  }

  function mountMusicCard (player) {
    if (!isHomePage()) return

    const aside = document.getElementById('aside-content')
    if (!aside) return

    let card = document.getElementById('hs-music-card')
    if (!card) {
      card = document.createElement('section')
      card.id = 'hs-music-card'
      card.className = 'card-widget hs-music-card'
      card.setAttribute('aria-label', '音乐播放器')
      card.innerHTML = `
        <div class="hs-music-card__surface">
          <div class="hs-music-card__main">
            <div class="hs-music-card__artwork" aria-hidden="true">
              <img data-hs-music-cover src="${TRACKS[0].cover}" alt="">
              <span class="hs-music-card__equalizer"><i></i><i></i><i></i></span>
            </div>
            <div class="hs-music-card__copy">
              <div class="hs-music-card__eyebrow">
                <span>MUSIC</span>
                <b data-hs-music-position>1 / ${TRACKS.length}</b>
              </div>
              <p class="hs-music-card__title" data-hs-music-title aria-live="polite">${TRACKS[0].name}</p>
              <p class="hs-music-card__artist" data-hs-music-artist>${TRACKS[0].artist}</p>
            </div>
            <div class="hs-music-card__controls">
              <button class="hs-music-card__button hs-music-card__play" type="button" data-hs-music-play aria-label="播放《${TRACKS[0].name}》" aria-pressed="false" title="播放">
                <i class="fas fa-play" aria-hidden="true"></i>
              </button>
              <button class="hs-music-card__button hs-music-card__next" type="button" data-hs-music-next aria-label="下一首" title="下一首">
                <i class="fas fa-step-forward" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="hs-music-card__timeline">
            <input type="range" min="0" max="100" step="0.1" value="0" data-hs-music-progress aria-label="播放进度">
            <div class="hs-music-card__time" aria-hidden="true">
              <span data-hs-music-elapsed>0:00</span>
              <span data-hs-music-duration>--:--</span>
            </div>
          </div>
          <div class="hs-music-card__engine" aria-hidden="true"></div>
        </div>`
    }

    placeMusicCard(card, aside)

    const engine = card.querySelector('.hs-music-card__engine')
    const container = getMusicContainer()
    if (engine && container.parentElement !== engine) engine.appendChild(container)

    bindMusicCardControls(card)
    syncMusicCard(player)
  }

  function parkMusicPlayer () {
    const container = document.getElementById('hs-music-player')
    if (container && container.parentElement !== document.body) document.body.appendChild(container)
  }

  function readState () {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch (err) {
      return {}
    }
  }

  function writeState (state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...readState(),
        ...state,
        updatedAt: Date.now()
      }))
    } catch (err) {}
  }

  function getPlayerState () {
    const player = window.hsBlogAPlayer
    if (!player || !player.audio) return {}

    return {
      index: player.list ? player.list.index : 0,
      currentTime: player.audio.currentTime || 0,
      playing: !player.audio.paused,
      volume: player.audio.volume
    }
  }

  function savePlayerState (state) {
    writeState({
      ...getPlayerState(),
      ...state
    })
  }

  function getMusicContainer () {
    let container = document.getElementById('hs-music-player')

    if (!container) {
      container = document.createElement('div')
      container.id = 'hs-music-player'
    }

    if (!container.isConnected) document.body.appendChild(container)

    return container
  }

  function hideResumePrompt () {
    const card = document.getElementById('hs-music-card')
    const prompt = document.getElementById('hs-music-resume')
    if (card) card.classList.remove('is-awaiting-playback')
    if (prompt) prompt.classList.remove('is-show')
  }

  function showResumePrompt () {
    const card = document.getElementById('hs-music-card')
    if (card) card.classList.add('is-awaiting-playback')
  }

  function requestPlayback (player, fromUserAction) {
    if (!player || !player.audio) return

    const fail = () => {
      isRestoringPlayback = false
      if (!fromUserAction) showResumePrompt()
    }

    try {
      isRestoringPlayback = true
      const playResult = player.play()

      if (playResult && typeof playResult.then === 'function') {
        playResult
          .then(() => {
            isRestoringPlayback = false
            hideResumePrompt()
            savePlayerState({ playing: true })
          })
          .catch(fail)
      } else {
        window.setTimeout(() => {
          isRestoringPlayback = false
          if (player.audio.paused) {
            fail()
          } else {
            hideResumePrompt()
            savePlayerState({ playing: true })
          }
        }, 250)
      }
    } catch (err) {
      fail()
    }
  }

  function restorePlayerState (resume) {
    const player = window.hsBlogAPlayer
    if (!player || !player.audio) return

    const state = readState()
    const stateIsFresh = state.updatedAt && Date.now() - state.updatedAt < 10 * 60 * 1000

    if (typeof state.volume === 'number') {
      player.volume(state.volume)
    }

    if (stateIsFresh && typeof state.index === 'number' && player.list && player.list.index !== state.index) {
      player.list.switch(state.index)
    }

    if (stateIsFresh && typeof state.currentTime === 'number' && state.currentTime > 0) {
      const seekTime = Math.max(0, state.currentTime - 0.4)
      window.setTimeout(() => player.seek(seekTime), 120)
    }

    if (resume && state.playing) {
      window.setTimeout(() => {
        if (player.audio.paused) {
          requestPlayback(player, false)
        }
      }, 180)
    }
  }

  function bindPlayerEvents (player) {
    if (player.__hsStateBound) return
    player.__hsStateBound = true

    player.on('play', () => {
      hideResumePrompt()
      savePlayerState({ playing: true })
      syncMusicCard(player)
    })

    player.on('pause', () => {
      if (!isPjaxNavigating && !isRestoringPlayback) savePlayerState({ playing: false })
      syncMusicCard(player)
    })

    player.on('timeupdate', () => {
      syncMusicCard(player)
      const now = Date.now()
      if (now - lastTimeUpdateAt < 2000) return
      lastTimeUpdateAt = now
      savePlayerState({ playing: !player.audio.paused })
    })

    player.on('listswitch', () => {
      savePlayerState({
        index: player.list.index,
        currentTime: 0
      })
      syncMusicCard(player)
      window.setTimeout(() => syncMusicCard(player), 80)
    })

    player.audio.addEventListener('loadedmetadata', () => syncMusicCard(player))
    player.audio.addEventListener('durationchange', () => syncMusicCard(player))
  }

  function initMusicPlayer () {
    if (!window.APlayer) return

    const container = getMusicContainer()

    if (window.hsBlogAPlayer) {
      restorePlayerState(isHomePage() && shouldResumeAfterPjax)
      mountMusicCard(window.hsBlogAPlayer)
      shouldResumeAfterPjax = false
      return
    }

    window.hsBlogAPlayer = new APlayer({
      container,
      fixed: false,
      mini: false,
      autoplay: false,
      theme: '#12B7F5',
      loop: 'all',
      order: 'random',
      preload: 'none',
      volume: 0.45,
      mutex: true,
      listFolded: true,
      listMaxHeight: 280,
      audio: TRACKS
    })

    bindPlayerEvents(window.hsBlogAPlayer)
    restorePlayerState(isHomePage() && readState().playing)
    mountMusicCard(window.hsBlogAPlayer)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMusicPlayer)
  } else {
    initMusicPlayer()
  }

  const musicCardMedia = window.matchMedia('(max-width: 900px)')
  const handleMusicCardLayout = () => mountMusicCard(window.hsBlogAPlayer)
  if (typeof musicCardMedia.addEventListener === 'function') {
    musicCardMedia.addEventListener('change', handleMusicCardLayout)
  } else if (typeof musicCardMedia.addListener === 'function') {
    musicCardMedia.addListener(handleMusicCardLayout)
  }

  document.addEventListener('pjax:send', () => {
    shouldResumeAfterPjax = !!(window.hsBlogAPlayer && window.hsBlogAPlayer.audio && !window.hsBlogAPlayer.audio.paused)
    isPjaxNavigating = true
    savePlayerState({ playing: shouldResumeAfterPjax })
    parkMusicPlayer()
  })

  document.addEventListener('pjax:complete', () => {
    initMusicPlayer()

    const player = window.hsBlogAPlayer
    if (!isHomePage() && player && player.audio && !player.audio.paused) {
      player.pause()
      savePlayerState({ playing: false })
    }

    isPjaxNavigating = false
    shouldResumeAfterPjax = false
  })

  window.addEventListener('beforeunload', () => savePlayerState())
  window.addEventListener('pageshow', () => {
    if (!isHomePage()) return
    mountMusicCard(window.hsBlogAPlayer)
    restorePlayerState(readState().playing)
  })
})()
