/**
 * Copy text to the clipboard, as reliably as the browser allows.
 *
 * `navigator.clipboard` is not guaranteed: it requires a secure context, so it
 * is absent over plain http on a LAN address, and it can reject when the
 * document is not focused. Falling back through execCommand means the operator
 * can still get the link when the modern API is unavailable — which matters
 * more than the copy being one click.
 *
 * Shared by the archive row and the admin sidebar so the two cannot drift.
 */
export async function copyText(text: string): Promise<'copied' | 'failed'> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return 'copied'
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const scratch = document.createElement('textarea')
    scratch.value = text
    // Off-screen rather than hidden: a display:none element cannot be selected.
    scratch.style.position = 'fixed'
    scratch.style.top = '-1000px'
    scratch.setAttribute('readonly', '')
    document.body.appendChild(scratch)
    scratch.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(scratch)
    if (ok) return 'copied'
  } catch {
    // fall through
  }

  return 'failed'
}

/**
 * The client-facing link for a share token.
 *
 * Built from the live origin so it always matches the host in use — staging,
 * production or localhost — rather than depending on NEXT_PUBLIC_SERVER_URL
 * being set correctly on each of them. Getting that wrong would hand a client a
 * link pointing at the wrong environment.
 */
export function shareUrl(token: string): string {
  return `${window.location.origin}/i/${token}`
}
