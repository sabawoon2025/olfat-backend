/**
 * App shell: header, grouped sidebar, mobile offcanvas, compact bottom nav.
 */
(function (global) {
  'use strict';

  function asset(path) {
    return global.MBMS_NAV ? global.MBMS_NAV.asset(path) : path;
  }

  function icon(name) {
    // Bootstrap Icons class map (loaded via vendor CSS).
    var icons = {
      home: 'bi-house',
      leaf: 'bi-cup-hot',
      bag: 'bi-bag',
      box: 'bi-box-seam',
      cart: 'bi-cart3',
      truck: 'bi-truck',
      layers: 'bi-layers',
      undo: 'bi-arrow-counterclockwise',
      alert: 'bi-exclamation-triangle',
      users: 'bi-people',
      building: 'bi-building',
      user: 'bi-person',
      card: 'bi-credit-card',
      scale: 'bi-bank',
      chart: 'bi-bar-chart',
      factory: 'bi-gear-wide-connected',
      file: 'bi-file-earmark-text',
      settings: 'bi-gear',
      more: 'bi-three-dots',
      menu: 'bi-list',
      grid: 'bi-grid'
    };
    var cls = icons[name] || icons.box;
    return '<i class="bi ' + cls + '" aria-hidden="true"></i>';
  }

  function logoSvg() {
    return (
      '<svg viewBox="0 0 32 32" aria-hidden="true">' +
      '<rect width="32" height="32" rx="8" fill="#1d4ed8"/>' +
      '<path d="M8 21V11h3.1l4.9 7.2L20.9 11H24v10h-2.3v-6.4L17.1 21h-2.2l-4.6-6.4V21H8z" fill="#fff"/>' +
      '</svg>'
    );
  }

  function renderLink(item, activeId, extraClass) {
    var isActive = item.id === activeId;
    var active = isActive ? ' is-active' : '';
    var ariaCurrent = isActive ? ' aria-current="page"' : '';
    return (
      '<a class="' +
      extraClass +
      active +
      '" href="' +
      item.href +
      '"' +
      ariaCurrent +
      '>' +
      icon(item.icon) +
      '<span>' +
      item.label +
      '</span></a>'
    );
  }

  function renderGroupedNav(activeId, extraClass) {
    return (global.MBMS_NAV ? global.MBMS_NAV.groups() : [])
      .map(function (group) {
        var links = group.items
          .map(function (item) {
            return renderLink(item, activeId, extraClass);
          })
          .join('');
        return '<div class="app-nav-label">' + group.label + '</div>' + links;
      })
      .join('');
  }

  function renderBottomNav(activeId) {
    var items = global.MBMS_NAV ? global.MBMS_NAV.mobilePrimary(activeId) : [];
    return items
      .map(function (item) {
        if (item.type === 'more') {
          var moreActive = item.isActiveMore ? ' is-active' : '';
          return (
            '<button type="button" class="' +
            moreActive +
            '" data-bs-toggle="offcanvas" data-bs-target="#app-offcanvas" aria-controls="app-offcanvas">' +
            icon('more') +
            '<span>More</span></button>'
          );
        }
        return renderLink(item, activeId, '');
      })
      .join('');
  }

  function headerActions() {
    var signedIn = global.MBMS_AUTH && global.MBMS_AUTH.isSignedIn();
    if (signedIn) {
      return '<button type="button" class="btn btn-outline-secondary btn-sm" data-logout><i class="bi bi-box-arrow-right" aria-hidden="true"></i> Sign out</button>';
    }
    return '<a class="btn btn-outline-secondary btn-sm" href="' + asset('pages/login.html') + '"><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Sign in</a>';
  }

  var SIDEBAR_SCROLL_KEY = 'MBMS_SIDEBAR_SCROLL_TOP';

  function saveSidebarScroll(container) {
    if (!container) {
      return;
    }
    try {
      global.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(container.scrollTop || 0));
    } catch (err) {
      /* private mode */
    }
  }

  function readSidebarScroll() {
    try {
      var raw = global.sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
      var value = parseInt(raw || '0', 10);
      return isNaN(value) ? 0 : Math.max(0, value);
    } catch (err) {
      return 0;
    }
  }

  function restoreSidebarScroll() {
    var top = readSidebarScroll();
    var sidebar = document.querySelector('.app-sidebar');
    var offcanvasBody = document.querySelector('#app-offcanvas .offcanvas-body');
    if (sidebar) {
      sidebar.scrollTop = top;
    }
    if (offcanvasBody) {
      offcanvasBody.scrollTop = top;
    }
  }

  function bindSidebarScrollMemory() {
    function bind(container) {
      if (!container || container.getAttribute('data-scroll-memory') === '1') {
        return;
      }
      container.setAttribute('data-scroll-memory', '1');
      container.addEventListener(
        'click',
        function (event) {
          var link = event.target.closest('a[href]');
          if (!link || !container.contains(link)) {
            return;
          }
          // Keep the menu where the user clicked across full page navigations.
          saveSidebarScroll(container);
        },
        true
      );
    }

    bind(document.querySelector('.app-sidebar'));
    bind(document.querySelector('#app-offcanvas .offcanvas-body'));
  }

  function mount(options) {
    options = options || {};
    var page = document.getElementById('page-content');
    if (!page || document.body.getAttribute('data-layout') === 'auth') {
      return;
    }

    var activeId = options.active || document.body.getAttribute('data-page') || 'dashboard';
    var appName = (global.MBMS_CONFIG && global.MBMS_CONFIG.appName) || 'MBMS';
    var grouped = renderGroupedNav(activeId, 'app-nav-link');

    var pageTitle = options.title || '';
    var titleHtml = pageTitle
      ? '<span class="app-current-page d-md-none text-truncate">' + (global.MBMS_UTILS ? global.MBMS_UTILS.escapeHtml(pageTitle) : pageTitle) + '</span>'
      : '';
    var shell = document.createElement('div');
    shell.innerHTML =
      '<a class="skip-link" href="#app-main">Skip to content</a>' +
      '<header class="app-header d-flex align-items-center justify-content-between gap-2">' +
      '<div class="d-flex align-items-center gap-2 min-w-0">' +
      '<button class="btn btn-outline-secondary app-menu-btn" type="button" data-bs-toggle="offcanvas" data-bs-target="#app-offcanvas" aria-controls="app-offcanvas" aria-label="Open menu">' +
      icon('menu') +
      '</button>' +
      '<a class="app-brand" href="' +
      asset('index.html') +
      '">' +
      logoSvg() +
      '<span class="text-truncate">MBMS</span></a>' +
      titleHtml +
      '</div>' +
      '<div class="app-header-actions d-flex align-items-center gap-2">' +
      headerActions() +
      '</div>' +
      '</header>' +
      '<div class="app-shell">' +
      '<aside class="app-sidebar" aria-label="Primary">' +
      '<label class="visually-hidden" for="nav-search">Search modules</label>' +
      '<input class="form-control form-control-sm mb-3" id="nav-search" type="search" placeholder="Search modules">' +
      '<div id="sidebar-nav">' +
      grouped +
      '</div>' +
      '</aside>' +
      '<main class="app-main" id="app-main" tabindex="-1">' +
      '<div class="app-page" id="app-page"></div>' +
      '</main>' +
      '</div>' +
      '<nav class="app-bottom-nav" aria-label="Mobile">' +
      renderBottomNav(activeId) +
      '</nav>' +
      '<div class="offcanvas offcanvas-start app-offcanvas" tabindex="-1" id="app-offcanvas" aria-labelledby="app-offcanvas-label">' +
      '<div class="offcanvas-header">' +
      '<h2 class="offcanvas-title h5" id="app-offcanvas-label">Menu</h2>' +
      '<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>' +
      '</div>' +
      '<div class="offcanvas-body">' +
      grouped +
      '<div class="mt-3">' + headerActions() + '</div>' +
      '</div>' +
      '</div>';

    document.body.insertBefore(shell, page);
    document.getElementById('app-page').appendChild(page);
    page.removeAttribute('hidden');
    document.title = (options.title ? options.title + ' · ' : '') + appName;
    try {
      if (global.localStorage.getItem('MBMS_UI_DENSITY') === 'compact') {
        document.body.classList.add('mbms-compact');
      }
    } catch (err) {
      /* ignore */
    }

    bindSidebarSearch();
    bindLogout();
    bindSidebarScrollMemory();
    // Restore after layout paint so the sidebar does not jump back to the top.
    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(function () {
        restoreSidebarScroll();
        global.requestAnimationFrame(restoreSidebarScroll);
      });
    } else {
      restoreSidebarScroll();
    }
  }

  function bindSidebarSearch() {
    var input = document.getElementById('nav-search');
    var root = document.getElementById('sidebar-nav');
    if (!input || !root) {
      return;
    }
    input.addEventListener('input', function () {
      var query = input.value.toLowerCase().trim();
      var labels = root.querySelectorAll('.app-nav-label');
      Array.prototype.forEach.call(root.querySelectorAll('.app-nav-link'), function (link) {
        var match = !query || link.textContent.toLowerCase().indexOf(query) !== -1;
        link.hidden = !match;
      });
      Array.prototype.forEach.call(labels, function (label) {
        var next = label.nextElementSibling;
        var visible = false;
        while (next && !next.classList.contains('app-nav-label')) {
          if (next.classList.contains('app-nav-link') && !next.hidden) {
            visible = true;
          }
          next = next.nextElementSibling;
        }
        label.hidden = !visible;
      });
    });
  }

  function bindLogout() {
    document.querySelectorAll('[data-logout]').forEach(function (button) {
      button.addEventListener('click', function () {
        global.MBMS_UI && global.MBMS_UI.setButtonLoading(button, true);
        if (global.MBMS_AUTH) {
          global.MBMS_AUTH.logout();
        }
      });
    });
  }

  global.MBMS_LAYOUT = {
    mount: mount,
    asset: asset,
    icon: icon
  };
})(window);
