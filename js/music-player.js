(function () {
  const STORAGE_KEY = 'hs-blog-music-state'
  let isPjaxNavigating = false
  let isRestoringPlayback = false
  let shouldResumeAfterPjax = false

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

    if (container.parentElement !== document.body) {
      document.body.appendChild(container)
    }

    return container
  }

  function hideResumePrompt () {
    const prompt = document.getElementById('hs-music-resume')
    if (prompt) prompt.classList.remove('is-show')
  }

  function showResumePrompt () {
    let prompt = document.getElementById('hs-music-resume')

    if (!prompt) {
      prompt = document.createElement('button')
      prompt.id = 'hs-music-resume'
      prompt.type = 'button'
      prompt.textContent = '继续播放'
      prompt.addEventListener('click', () => {
        const player = window.hsBlogAPlayer
        if (!player) return

        restorePlayerState(false)
        requestPlayback(player, true)
      })
      document.body.appendChild(prompt)
    }

    prompt.classList.add('is-show')
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
    })

    player.on('pause', () => {
      if (!isPjaxNavigating && !isRestoringPlayback) savePlayerState({ playing: false })
    })

    player.on('timeupdate', () => {
      savePlayerState({ playing: !player.audio.paused })
    })

    player.on('listswitch', () => savePlayerState({
      index: player.list.index,
      currentTime: 0
    }))
  }

  function initMusicPlayer () {
    if (!window.APlayer) return

    const container = getMusicContainer()

    if (window.hsBlogAPlayer) {
      restorePlayerState(shouldResumeAfterPjax)
      shouldResumeAfterPjax = false
      return
    }

    window.hsBlogAPlayer = new APlayer({
      container,
      fixed: true,
      mini: true,
      autoplay: false,
      theme: '#12B7F5',
      loop: 'all',
      order: 'random',
      preload: 'metadata',
      volume: 0.45,
      mutex: true,
      listFolded: true,
      listMaxHeight: 280,
      audio: [
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
    })

    bindPlayerEvents(window.hsBlogAPlayer)
    restorePlayerState(readState().playing)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMusicPlayer)
  } else {
    initMusicPlayer()
  }

  document.addEventListener('pjax:send', () => {
    shouldResumeAfterPjax = !!(window.hsBlogAPlayer && window.hsBlogAPlayer.audio && !window.hsBlogAPlayer.audio.paused)
    isPjaxNavigating = true
    savePlayerState({ playing: shouldResumeAfterPjax })
  })

  document.addEventListener('pjax:complete', () => {
    initMusicPlayer()
    restorePlayerState(shouldResumeAfterPjax)
    isPjaxNavigating = false
    shouldResumeAfterPjax = false
  })

  window.addEventListener('beforeunload', () => savePlayerState())
  window.addEventListener('pageshow', () => restorePlayerState(readState().playing))
})()
