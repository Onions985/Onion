import type { Ref } from 'vue'

export function useScrollReveal(root: Ref<HTMLElement | undefined>) {
  let observer: IntersectionObserver | undefined
  let motion: MediaQueryList | undefined
  let targets: HTMLElement[] = []
  const reveal = (element: HTMLElement, instant = false, delay = 0) => {
    if (element.dataset.revealState !== 'pending') return
    element.style.transitionDelay = instant ? '0ms' : `${delay}ms`
    element.dataset.revealState = instant ? 'instant' : 'visible'
    observer?.unobserve(element)
  }
  const revealAll = () => {
    targets.forEach((element) => reveal(element, true))
    observer?.disconnect()
  }
  const keyboardNavigation = (event: KeyboardEvent) => {
    if (['Tab', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key))
      revealAll()
  }
  const focused = (event: FocusEvent) => {
    if (event.target instanceof Element) {
      const target = event.target.closest<HTMLElement>('[data-reveal]')
      if (target) reveal(target, true)
    }
  }
  const motionChanged = () => {
    if (motion?.matches) revealAll()
  }
  onMounted(() => {
    if (!root.value || !('IntersectionObserver' in window)) return
    motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) return
    targets = [...root.value.querySelectorAll<HTMLElement>('[data-reveal]')]
    observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((entry) => entry.isIntersecting)
          .forEach((entry, index) => {
            reveal(entry.target as HTMLElement, false, Math.min(index, 2) * 50)
          })
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    )
    // SSR and visible content stay readable; only offscreen items wait for entry.
    for (const element of targets) {
      if (
        element.getBoundingClientRect().top < window.innerHeight ||
        element.contains(document.activeElement)
      )
        continue
      element.dataset.revealState = 'pending'
      observer.observe(element)
    }
    window.addEventListener('keydown', keyboardNavigation)
    root.value.addEventListener('focusin', focused)
    motion.addEventListener('change', motionChanged)
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    window.removeEventListener('keydown', keyboardNavigation)
    root.value?.removeEventListener('focusin', focused)
    motion?.removeEventListener('change', motionChanged)
  })
}
