/** RN’de livekit-client yüklenmeden önce DOMException gerekir. */
declare const global: typeof globalThis & { DOMException?: typeof DOMException };

if (typeof global.DOMException === 'undefined') {
  class PolyfillDOMException extends Error {
    code = 0;
    constructor(message = '', name?: string) {
      super(message);
      this.message = message;
      this.name = name ?? 'Error';
      Object.setPrototypeOf(this, PolyfillDOMException.prototype);
    }
  }
  global.DOMException = PolyfillDOMException as unknown as typeof DOMException;
}
