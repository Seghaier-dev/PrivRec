export function consumeReturnTo() {
  try {
    const to = sessionStorage.getItem('privrec_return_to')
    // Accept only genuine relative paths: must start with / but not //
    // (// is a protocol-relative URL that the browser treats as absolute).
    if (to && to.startsWith('/') && !to.startsWith('//')) {
      sessionStorage.removeItem('privrec_return_to')
      return to
    } else if (to) {
      sessionStorage.removeItem('privrec_return_to')
    }
  } catch { /* sessionStorage unavailable */ }
  return null
}
