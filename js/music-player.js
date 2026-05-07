(function () {
  function initMusicPlayer () {
    if (!window.APlayer || window.hsBlogAPlayer) return

    const container = document.getElementById('hs-music-player')
    if (!container) return

    window.hsBlogAPlayer = new APlayer({
      container,
      fixed: true,
      mini: true,
      autoplay: false,
      theme: '#12B7F5',
      loop: 'all',
      order: 'list',
      preload: 'none',
      volume: 0.45,
      mutex: true,
      audio: [
        {
          name: 'SoundHelix Song 3',
          artist: 'SoundHelix',
          url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
          cover: '/img/headImage.jpg'
        }
      ]
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMusicPlayer)
  } else {
    initMusicPlayer()
  }

  document.addEventListener('pjax:complete', initMusicPlayer)
})()
