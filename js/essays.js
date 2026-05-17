(function () {
  const START_DATE = new Date(2006, 8, 18)
  const ESSAY_PATH = '/tags/随笔/'

  function getEssayDays () {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return Math.floor((today - START_DATE) / 86400000) + 1
  }

  function isEssayPage () {
    const path = decodeURIComponent(window.location.pathname).replace(/index\.html$/, '')
    return path === ESSAY_PATH
  }

  function updateEssayPage () {
    const essayPage = isEssayPage()
    document.documentElement.classList.toggle('hs-essay-page', essayPage)

    const oldIntro = document.querySelector('.hs-essay-intro')
    if (oldIntro && !essayPage) oldIntro.remove()
    if (!essayPage) return

    const days = getEssayDays()
    const heroTitle = document.querySelector('#page-header #site-title')
    if (heroTitle) {
      heroTitle.innerHTML = `
        <span>带着好奇心和未知</span>
        <span>感受世界的第 ${days} 天</span>
      `
    }

    let intro = document.querySelector('.hs-essay-intro')
    const tagContainer = document.querySelector('#tag')
    const postList = document.querySelector('#recent-posts')
    if (!intro && tagContainer) {
      intro = document.createElement('section')
      intro.className = 'hs-essay-intro'
      tagContainer.insertBefore(intro, tagContainer.firstChild)
    } else if (!intro && postList) {
      intro = document.createElement('section')
      intro.className = 'hs-essay-intro'
      postList.parentElement.insertBefore(intro, postList)
    }

    if (intro) {
      intro.innerHTML = `
        <p class="hs-essay-kicker">ESSAYS</p>
        <h2>第 <span>${days}</span> 天，继续记录。</h2>
        <p>把学习、跑步、生活里一闪而过的想法留下来。答案不急，先带着好奇心靠近世界。</p>
      `
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateEssayPage)
  } else {
    updateEssayPage()
  }

  document.addEventListener('pjax:complete', updateEssayPage)
})()
