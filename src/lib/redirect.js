export function consumeReturnTo() {
  try {
    const to = sessionStorage.getItem('privrec_return_to')
    // Accept only genuine relative paths: a single leading / not followed by
    // another / or a \. // is a protocol-relative URL, and browsers normalize
    // a leading /\ to // too — both would send window.location.href off-origin.
    if (to && /^\/(?!\/|\\)/.test(to)) {
      sessionStorage.removeItem('privrec_return_to')
      return to
    } else if (to) {
      sessionStorage.removeItem('privrec_return_to')
    }
  } catch { /* sessionStorage unavailable */ }
  return null
}
