/**
 * Global application bootstrap. No business logic.
 */
(function (global) {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function bootstrapReady() {
    return !!(global.bootstrap && global.bootstrap.Modal);
  }

  /**
   * Run non-critical shell work only after the current page's API traffic is quiet.
   * Prevents locations/auth warmup from queueing behind (and delaying) page data
   * on single-threaded PHP servers.
   */
  function scheduleBackground(fn) {
    var started = Date.now();
    var maxWaitMs = 8000;

    function inflight() {
      return global.MBMS_API && typeof global.MBMS_API.getInflightCount === 'function'
        ? global.MBMS_API.getInflightCount()
        : 0;
    }

    function tryRun() {
      if (inflight() > 0 && (Date.now() - started) < maxWaitMs) {
        if (typeof global.requestIdleCallback === 'function') {
          global.requestIdleCallback(tryRun, { timeout: 400 });
        } else {
          global.setTimeout(tryRun, 50);
        }
        return;
      }
      fn();
    }

    if (typeof global.requestIdleCallback === 'function') {
      global.requestIdleCallback(tryRun, { timeout: 2500 });
      return;
    }
    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(tryRun);
      });
      return;
    }
    Promise.resolve().then(tryRun);
  }

  function boot() {
    // Guest auth screens (login / forgot password). Sale bill also uses a bare
    // layout, and signed-in users must be able to open it.
    var page = document.body.getAttribute('data-page') || '';
    var authLayout = document.body.getAttribute('data-layout') === 'auth';
    // data-page="login" on the reset screen lets an older cached app.js leave guests here.
    var resetPage = document.body.getAttribute('data-auth') === 'reset' || page === 'forgot-password';
    var guestAuthPage = authLayout || page === 'login' || resetPage;
    var signedIn = global.MBMS_AUTH && global.MBMS_AUTH.isSignedIn();
    if (page === 'login' && !resetPage && signedIn) {
      global.location.href = (global.MBMS_NAV && global.MBMS_NAV.asset)
        ? global.MBMS_NAV.asset('index.html')
        : '../index.html';
      return;
    }
    if (!guestAuthPage && !signedIn) {
      global.location.href = (global.MBMS_NAV && global.MBMS_NAV.asset)
        ? global.MBMS_NAV.asset('pages/login.html')
        : 'pages/login.html';
      return;
    }

    // 1–4: auth gate above, then page init + page API + render.
    // 5: background prefetch only after the page has started (idle).
    init();
    if (!guestAuthPage && global.MBMS_API && typeof global.MBMS_API.prefetch === 'function') {
      scheduleBackground(function () {
        global.MBMS_API.prefetch({
          background: true,
          page: global.MBMS_PAGE || {}
        });
      });
    }
  }

  function ensureScrollableModals() {
    Array.prototype.forEach.call(document.querySelectorAll('.modal .modal-dialog'), function (dialog) {
      dialog.classList.add('modal-dialog-scrollable');
    });
  }

  function init() {
    var pageOptions = global.MBMS_PAGE || {};
    var skipLayout = document.body.getAttribute('data-layout') === 'auth';
    if (global.MBMS_LAYOUT && !skipLayout) {
      global.MBMS_LAYOUT.mount(pageOptions);
    }

    ensureScrollableModals();
    if (global.MBMS_AUTOCOMPLETE && typeof global.MBMS_AUTOCOMPLETE.enhanceAll === 'function') {
      global.MBMS_AUTOCOMPLETE.enhanceAll(document);
    }
    document.body.classList.add('mbms-ready');
    document.documentElement.dataset.bootstrap = bootstrapReady() ? 'ready' : 'missing';
    document.documentElement.dataset.apiBase = (global.MBMS_CONFIG && global.MBMS_CONFIG.apiBaseUrl) || '';

    if (typeof pageOptions.onReady === 'function') {
      pageOptions.onReady({
        config: global.MBMS_CONFIG,
        api: global.MBMS_API,
        ui: global.MBMS_UI,
        utils: global.MBMS_UTILS,
        bootstrapReady: bootstrapReady()
      });
    }
  }

  global.MBMS = {
    config: global.MBMS_CONFIG,
    api: global.MBMS_API,
    ui: global.MBMS_UI,
    utils: global.MBMS_UTILS,
    layout: global.MBMS_LAYOUT,
    nav: global.MBMS_NAV,
    auth: global.MBMS_AUTH,
    ready: ready
  };

  ready(boot);
})(window);
