(function () {
  function initTaoColumn () {
    const root = document.querySelector('[data-tao-column]')
    if (!root || root.dataset.taoReady === 'true') return

    root.dataset.taoReady = 'true'
    const items = Array.from(root.querySelectorAll('.tao-reveal'))
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(item => item.classList.add('is-visible'))
      return
    }

    root.classList.add('tao-motion-ready')
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.08
    })

    items.forEach(item => observer.observe(item))
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTaoColumn)
  } else {
    initTaoColumn()
  }

  document.addEventListener('pjax:complete', initTaoColumn)
})()

