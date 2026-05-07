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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMusicPlayer)
  } else {
    initMusicPlayer()
  }

  document.addEventListener('pjax:complete', initMusicPlayer)
})()
