/**
 * Reusable report / P&L filter bar.
 * Collects filter values and fills lookups. Does not calculate results.
 */
(function (global) {
  'use strict';

  function products() {
    var catalog = global.MBMS_CATALOG;
    if (!catalog) {
      return [];
    }
    var categories = ['tea', 'rice', 'detergents', 'raw-materials', 'factory-materials'];
    var seen = {};
    return categories.reduce(function (list, category) {
      return list.concat((catalog.products(category) || []).map(function (row) {
        var id = String(row.id);
        if (seen[id]) {
          return null;
        }
        seen[id] = true;
        return { id: row.id, label: row.name, category: category };
      }).filter(Boolean));
    }, []);
  }

  function selectedValue(el) {
    return el ? String(el.value || '') : '';
  }

  function fill(root) {
    if (!root || !global.MBMS_RECORDS) {
      return;
    }
    var locationEl = root.querySelector('[name="location"]');
    var categoryEl = root.querySelector('[name="category"]');
    var productEl = root.querySelector('[name="product"]');
    var moduleEl = root.querySelector('[name="module"]');
    var customerEl = root.querySelector('[name="customer"]');
    var supplierEl = root.querySelector('[name="supplier"]');

    global.MBMS_RECORDS.fillSelect(
      locationEl,
      global.MBMS_RECORDS.locations(),
      function (row) { return row.id; },
      function (row) { return row.name; },
      selectedValue(locationEl),
      'All locations'
    );
    global.MBMS_RECORDS.fillSelect(
      categoryEl,
      global.MBMS_CATALOG ? global.MBMS_CATALOG.purchaseCategories() : [],
      function (row) { return row.id; },
      function (row) { return row.label; },
      selectedValue(categoryEl),
      'All categories'
    );
    global.MBMS_RECORDS.fillSelect(
      productEl,
      products(),
      function (row) { return row.id; },
      function (row) { return row.label; },
      selectedValue(productEl),
      'All products'
    );
    global.MBMS_RECORDS.fillSelect(
      moduleEl,
      [
        { id: 'tea', label: 'Tea' },
        { id: 'rice', label: 'Rice' },
        { id: 'detergents', label: 'Detergents' },
        { id: 'raw-materials', label: 'Raw Materials' },
        { id: 'factory-materials', label: 'Factory Materials' }
      ],
      function (row) { return row.id; },
      function (row) { return row.label; },
      selectedValue(moduleEl),
      'All modules'
    );
    global.MBMS_RECORDS.fillSelect(
      customerEl,
      global.MBMS_CATALOG ? global.MBMS_CATALOG.customers() : [],
      function (row) { return row.id; },
      function (row) { return row.name; },
      selectedValue(customerEl),
      'All customers'
    );
    global.MBMS_RECORDS.fillSelect(
      supplierEl,
      global.MBMS_CATALOG ? global.MBMS_CATALOG.suppliers() : [],
      function (row) { return row.id; },
      function (row) { return row.name; },
      selectedValue(supplierEl),
      'All suppliers'
    );
  }

  function ensureLookups() {
    var tasks = [];
    if (global.MBMS_API && typeof global.MBMS_API.ensureLocations === 'function') {
      tasks.push(global.MBMS_API.ensureLocations().catch(function () { return []; }));
    }
    if (global.MBMS_RECORDS && typeof global.MBMS_RECORDS.fetchOrMock === 'function') {
      var emptyCatalog = function () {
        return { types: [], products: [], variants: [], sizes: [] };
      };
      ['tea', 'rice', 'detergents'].forEach(function (path) {
        tasks.push(
          global.MBMS_RECORDS.fetchOrMock(path, emptyCatalog).catch(function () {
            return null;
          })
        );
      });
      tasks.push(
        global.MBMS_RECORDS.fetchOrMock('customers', function () { return []; }).catch(function () {
          return null;
        })
      );
      tasks.push(
        global.MBMS_RECORDS.fetchOrMock('suppliers', function () { return []; }).catch(function () {
          return null;
        })
      );
    }
    return Promise.all(tasks);
  }

  function warm(root) {
    return ensureLookups().then(function () {
      fill(root);
      return root;
    });
  }

  function values(root) {
    var data = {};
    if (!root) {
      return data;
    }
    Array.prototype.forEach.call(root.querySelectorAll('[name]'), function (el) {
      data[el.name] = el.value || '';
    });
    return data;
  }

  function params(root) {
    var raw = values(root);
    return {
      search: raw.search || '',
      date_from: raw.date_from || '',
      date_to: raw.date_to || '',
      category: raw.category || '',
      product_id: raw.product || '',
      customer_id: raw.customer || '',
      supplier_id: raw.supplier || '',
      location_id: raw.location || '',
      module: raw.module || '',
      transaction_type: raw.transaction_type || ''
    };
  }

  function visibilityTarget(el) {
    if (!el) {
      return null;
    }
    var wrap = el.closest ? el.closest('.mbms-ac-wrap') : null;
    if (wrap) {
      return wrap;
    }
    if (el.parentNode && el.parentNode !== el.closest('.mbms-toolbar') && el.parentNode.children.length === 1) {
      return el.parentNode;
    }
    return el;
  }

  function show(root, names) {
    if (!root) {
      return;
    }
    Array.prototype.forEach.call(root.querySelectorAll('[name]'), function (el) {
      var visible = !names || names.indexOf(el.name) !== -1;
      el.hidden = !visible;
      var target = visibilityTarget(el);
      if (target && target !== el) {
        target.hidden = !visible;
      }
    });
  }

  function locationLabel(id) {
    if (id == null || id === '') {
      return '';
    }
    var needle = String(id);
    var match = (global.MBMS_RECORDS.locations() || []).filter(function (row) {
      return String(row.id) === needle || String(row.name) === needle;
    })[0];
    return match ? match.name : needle;
  }

  function personLabel(kind, id) {
    if (id == null || id === '') {
      return '';
    }
    var needle = String(id);
    var list = global.MBMS_CATALOG && kind === 'supplier'
      ? global.MBMS_CATALOG.suppliers()
      : (global.MBMS_CATALOG ? global.MBMS_CATALOG.customers() : []);
    var match = (list || []).filter(function (row) {
      return String(row.id) === needle || String(row.name) === needle;
    })[0];
    return match ? match.name : needle;
  }

  function productLabel(id) {
    if (id == null || id === '') {
      return '';
    }
    var needle = String(id);
    var match = (products() || []).filter(function (row) {
      return String(row.id) === needle;
    })[0];
    return match ? String(match.label || '') : '';
  }

  function bind(root, onChange) {
    if (!root) {
      return Promise.resolve();
    }
    fill(root);
    Array.prototype.forEach.call(root.querySelectorAll('input, select'), function (el) {
      if (el.dataset.filterBound === '1') {
        return;
      }
      el.dataset.filterBound = '1';
      el.addEventListener('change', function () {
        if (typeof onChange === 'function') {
          onChange(values(root));
        }
      });
      if (el.type === 'search' || el.type === 'text') {
        el.addEventListener('input', global.MBMS_UTILS.debounce(function () {
          if (typeof onChange === 'function') {
            onChange(values(root));
          }
        }, 250));
      }
    });
    return warm(root);
  }

  global.MBMS_FILTERS = {
    fill: fill,
    warm: warm,
    ensureLookups: ensureLookups,
    values: values,
    params: params,
    show: show,
    bind: bind,
    products: products,
    locationLabel: locationLabel,
    personLabel: personLabel,
    productLabel: productLabel
  };
})(window);
