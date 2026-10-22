// Camera check before identity verification: friendly messages for the
// errors getUserMedia reports. Nothing is captured or uploaded.

export type CameraFacing = 'environment' | 'user'

export function cameraErrorMessage(error: unknown): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access is blocked. Allow the camera for this site in your browser settings (the camera icon in the address bar), then try again.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device. You can still start verification: Stripe will show a code to continue on your phone.'
    case 'NotReadableError':
    case 'AbortError':
      return 'Your camera is being used by another app. Close other apps that use the camera, then try again.'
    default:
      return 'The camera could not be started. Try again, use another browser or device, or request in-person verification.'
  }
}

/** True when this browser can ask for the camera at all (secure page, modern browser). */
export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && (typeof window === 'undefined' || window.isSecureContext !== false)
}
