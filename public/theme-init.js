(() => {
  try {
    const stored = JSON.parse(localStorage.getItem('quiet-signal-review-settings') || '{}')
    const theme =
      stored.theme === 'dark' || stored.theme === 'light'
        ? stored.theme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    if (theme === 'dark') {
      document.documentElement.classList.add('theme-dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#141312')
    }
  } catch {
    // Keep the light theme if local settings cannot be read.
  }
})()
