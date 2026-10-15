/**
 * Shared record UI helpers and a replaceable mock/API interface.
 * Official stock, profit, and debt values are never calculated here.
 */
(function (global) {
  'use strict';

  var STORE_KEY = 'MBMS_PHASE3_STORE';

  function readStore() {
    try {
      return JSON.parse(global.localStorage.getItem(STORE_KEY) || '{}');
    } catch (err) {
      return {};
    }
  }

  function writeStore(data) {
    try {
      global.localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (err) {
      /* ignore */
    }
  }

  function storeList(key) {
    var store = readStore();
    return store[key] || [];
  }

  function storeSave(key, item) {
    var store = readStore();
    store[key] = store[key] || [];
    store[key].unshift(item);
    writeStore(store);
    return item;
  }

  function mergeList(key, seed) {
    var map = {};
    (seed || []).forEach(function (row) {
      if (row && row.id) {
        map[row.id] = row;
      }
    });
    storeList(key).forEach(function (row) {
      if (row && row.id) {
        map[row.id] = Object.assign({}, map[row.id] || {}, row);
      }
    });
    return Object.keys(map).map(function (id) {
      return map[id];
    });
  }

  function storeUpdate(key, id, values) {
    var store = readStore();
    store[key] = store[key] || [];
    var found = false;
    store[key] = store[key].map(function (row) {
      if (row.id === id) {
        found = true;
        return Object.assign({}, row, values, { id: id });
      }
      return row;
    });
    if (!found) {
      store[key].unshift(Object.assign({}, values, { id: id }));
    }
    writeStore(store);
    return store[key].filter(function (row) { return row.id === id; })[0] || values;
  }

  function queryParam(name) {
    return new URLSearchParams(global.location.search).get(name);
  }

  function setQuery(name, value) {
    var url = new URL(global.location.href);
    if (value) {
      url.searchParams.set(name, value);
    } else {
      url.searchParams.delete(name);
    }
    global.history.replaceState({}, '', url);
  }

  function showBanner(el, source, message) {
    if (!el) {
      return;
    }
    if (source === 'error') {
      el.hidden = false;
      el.textContent = message || 'Unable to load live data. Check your connection and try again.';
      return;
    }
    var isMock = source === 'mock';
    el.hidden = !isMock;
    if (isMock) {
      el.textContent = message || 'Sample data — not official. Laravel will provide live values.';
    }
  }

  function fillSelect(select, items, getValue, getLabel, selected, blankLabel) {
    if (!select) {
      return;
    }
    var current = selected || select.value;
    select.innerHTML = '<option value="">' + global.MBMS_UTILS.escapeHtml(blankLabel || 'Select') + '</option>' + (items || []).map(function (item) {
      var value = getValue(item);
      return '<option value="' + global.MBMS_UTILS.escapeHtml(value) + '"' + (String(value) === String(current) ? ' selected' : '') + '>' + global.MBMS_UTILS.escapeHtml(getLabel(item)) + '</option>';
    }).join('');
    if (global.MBMS_AUTOCOMPLETE && typeof global.MBMS_AUTOCOMPLETE.refresh === 'function') {
      global.MBMS_AUTOCOMPLETE.refresh(select);
    }
  }

  /** Locations the signed-in user may write to (their claimed province only). */
  function workLocations() {
    var all = ((global.MBMS_MOCK && global.MBMS_MOCK.locations) || []).slice();
    var id = global.MBMS_CONFIG && global.MBMS_CONFIG.getLocationId
      ? global.MBMS_CONFIG.getLocationId()
      : '';
    if (!id) {
      return all;
    }
    var mine = all.filter(function (row) {
      return String(row.id) === String(id);
    });
    if (mine.length) {
      return mine;
    }
    var name = global.MBMS_CONFIG.getLocationName ? global.MBMS_CONFIG.getLocationName() : '';
    return [{ id: id, name: name || 'My province' }];
  }

  /** Fill a create-form location select with only the user's province. */
  function fillWorkLocation(select) {
    if (!select) {
      return;
    }
    var items = workLocations();
    var selected = global.MBMS_CONFIG && global.MBMS_CONFIG.getLocationId
      ? global.MBMS_CONFIG.getLocationId()
      : '';
    fillSelect(
      select,
      items,
      function (row) { return row.id; },
      function (row) { return row.name; },
      selected,
      items.length === 1 ? 'Your province' : 'Select province'
    );
    if (selected) {
      select.value = String(selected);
    }
    // Keep enabled so the value still submits; only one province option is listed.
    select.disabled = false;
    select.setAttribute('data-work-location', '1');
  }

  function renderTable(body, rows, columns, emptyMessage) {
    if (!body) {
      return;
    }
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="' + columns.length + '" class="text-secondary">' + global.MBMS_UTILS.escapeHtml(emptyMessage || 'No records yet.') + '</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (row) {
      return '<tr>' + columns.map(function (col) {
        if (typeof col.render === 'function') {
          return '<td>' + col.render(row) + '</td>';
        }
        var value = row[col.key];
        return '<td>' + global.MBMS_UTILS.escapeHtml(value == null ? '' : value) + '</td>';
      }).join('') + '</tr>';
    }).join('');
  }

  function renderSummary(el, chips) {
    if (!el) {
      return;
    }
    if (!chips || !chips.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = chips.map(function (chip) {
      var tone = chip.tone ? String(chip.tone).replace(/[^a-z0-9_-]/gi, '') : '';
      var toneClass = tone ? ' is-' + tone : '';
      return (
        '<div class="mbms-summary-chip' + toneClass + '">' +
        '<div class="label"><i class="bi ' + global.MBMS_UTILS.escapeHtml(chip.icon || 'bi-dot') + '" aria-hidden="true"></i> ' +
        global.MBMS_UTILS.escapeHtml(chip.label || '') + '</div>' +
        '<div class="value">' + global.MBMS_UTILS.escapeHtml(chip.value == null ? '—' : chip.value) + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function actionButton(hrefOrAttrs, label, icon, variant) {
    var cls = 'btn btn-sm ' + (variant || 'btn-outline-primary');
    var iconHtml = icon ? '<i class="bi ' + global.MBMS_UTILS.escapeHtml(icon) + '" aria-hidden="true"></i> ' : '';
    if (typeof hrefOrAttrs === 'string') {
      return '<a class="' + cls + '" href="' + global.MBMS_UTILS.escapeHtml(hrefOrAttrs) + '">' + iconHtml +
        global.MBMS_UTILS.escapeHtml(label) + '</a>';
    }
    var attrs = hrefOrAttrs || {};
    var attrHtml = Object.keys(attrs).map(function (key) {
      return key + '="' + global.MBMS_UTILS.escapeHtml(attrs[key]) + '"';
    }).join(' ');
    return '<button type="button" class="' + cls + '" ' + attrHtml + '>' + iconHtml +
      global.MBMS_UTILS.escapeHtml(label) + '</button>';
  }

  function fetchOrMock(path, mockData, params) {
    params = params || {};
    var hasParams = Object.keys(params).some(function (key) {
      return params[key] !== undefined && params[key] !== null && params[key] !== '';
    });
    if (!hasParams && global.MBMS_API && typeof global.MBMS_API.getCached === 'function') {
      var cached = global.MBMS_API.getCached(path);
      if (cached !== null && cached !== undefined) {
        return Promise.resolve({ source: 'api', data: cached, fromCache: true });
      }
    }
    return global.MBMS_API.get(path, { params: params })
      .then(function (response) {
        var data = global.MBMS_UTILS.unwrap(response.data) || response.data;
        if (global.MBMS_API.remember) {
          global.MBMS_API.remember(path, data);
        }
        return { source: 'api', data: data };
      })
      .catch(function (error) {
        if (global.MBMS_UI) {
          global.MBMS_UI.notify({
            type: 'danger',
            message: global.MBMS_UTILS.getErrorMessage(error, 'Unable to load live data.')
          });
        }
        return {
          source: 'error',
          data: Array.isArray(mockData) ? [] : (typeof mockData === 'function' ? [] : {}),
          error: error
        };
      });
  }

  function submitOrMock(method, path, body) {
    var request = method === 'put' ? global.MBMS_API.put(path, body) : global.MBMS_API.post(path, body);
    return request.then(function (response) {
      return { source: 'api', data: response.data };
    });
  }

  global.MBMS_RECORDS = {
    locations: function () {
      return (global.MBMS_MOCK && global.MBMS_MOCK.locations) || [];
    },
    workLocations: workLocations,
    queryParam: queryParam,
    setQuery: setQuery,
    showBanner: showBanner,
    fillSelect: fillSelect,
    fillWorkLocation: fillWorkLocation,
    renderTable: renderTable,
    renderSummary: renderSummary,
    actionButton: actionButton,
    fetchOrMock: fetchOrMock,
    submitOrMock: submitOrMock,
    storeList: storeList,
    storeSave: storeSave,
    storeUpdate: storeUpdate,
    mergeList: mergeList
  };

  global.MBMS_API_CONTRACT = {
    auth: { header: 'Authorization: Bearer {token}', note: 'Required on all module endpoints once Laravel auth is connected.' },
    tea: {
      list: { method: 'GET', path: '/tea', response: 'types[], sizes[] from backend, not hard-coded' },
      detail: { method: 'GET', path: '/tea/{id}', response: 'type, variants[], stock_display from backend' },
      sizes: { method: 'GET', path: '/tea/sizes', response: 'configurable size list' },
      purchase: { method: 'POST', path: '/tea/purchases', fields: ['supplier_id', 'tea_type_id', 'size_id', 'bags', 'quantity', 'price', 'total_amount', 'paid_amount', 'remaining_amount', 'date', 'location_id'] },
      sale: { method: 'POST', path: '/tea/sales', fields: ['customer_id', 'tea_type_id', 'size_id', 'quantity', 'price', 'total_amount', 'paid_amount', 'remaining_amount', 'payment_type', 'date', 'location_id'] },
      history: { method: 'GET', path: '/tea/{id}/history', response: 'purchases[], sales[]' }
    },
    rice: {
      list: { method: 'GET', path: '/rice', response: 'types/qualities[], sizes[]' },
      detail: { method: 'GET', path: '/rice/{id}' },
      purchase: { method: 'POST', path: '/rice/purchases', fields: ['supplier_id', 'rice_type_id', 'size_id', 'bags', 'quantity', 'price', 'total_amount', 'date', 'location_id'], note: 'Supplier-credit rules are not defined in the frontend.' },
      sale: { method: 'POST', path: '/rice/sales', fields: ['customer_id', 'rice_type_id', 'size_id', 'quantity', 'price', 'total_amount', 'paid_amount', 'payment_type', 'date', 'location_id'] },
      history: { method: 'GET', path: '/rice/{id}/history' }
    },
    detergents: {
      list: { method: 'GET', path: '/detergents', response: 'products[] with configurable units[]' },
      detail: { method: 'GET', path: '/detergents/{id}' },
      purchase: { method: 'POST', path: '/detergents/purchases', fields: ['supplier_id', 'product_id', 'unit_id', 'quantity', 'price', 'total_amount', 'paid_amount', 'date', 'location_id'] },
      sale: { method: 'POST', path: '/detergents/sales', fields: ['customer_id', 'product_id', 'unit_id', 'quantity', 'price', 'total_amount', 'paid_amount', 'payment_type', 'date', 'location_id'] },
      history: { method: 'GET', path: '/detergents/{id}/history' }
    },
    customers: {
      list: { method: 'GET', path: '/customers' },
      create: { method: 'POST', path: '/customers', fields: ['name', 'phone', 'address', 'location_id'] },
      update: { method: 'PUT', path: '/customers/{id}', fields: ['name', 'phone', 'address', 'location_id'] },
      detail: { method: 'GET', path: '/customers/{id}', response: 'profile + balance from backend' },
      history: { method: 'GET', path: '/customers/{id}/history', response: 'sales[], payments[], transactions[]' }
    },
    suppliers: {
      list: { method: 'GET', path: '/suppliers' },
      create: { method: 'POST', path: '/suppliers', fields: ['name', 'phone', 'address', 'location_id'] },
      update: { method: 'PUT', path: '/suppliers/{id}', fields: ['name', 'phone', 'address', 'location_id'] },
      detail: { method: 'GET', path: '/suppliers/{id}', response: 'profile + payable balance from backend' },
      history: { method: 'GET', path: '/suppliers/{id}/history', response: 'purchases[], payments[], transactions[]' }
    },
    sales: {
      list: { method: 'GET', path: '/sales', params: ['search', 'category', 'location', 'date_from', 'date_to'] },
      create: { method: 'POST', path: '/sales', fields: ['customer_id', 'category', 'product_id', 'variant_id', 'unit_id', 'quantity', 'price', 'payment_type', 'paid_amount', 'remaining_amount', 'date', 'location_id', 'notes'] }
    },
    purchases: {
      list: { method: 'GET', path: '/purchases', params: ['search', 'category', 'location', 'date_from', 'date_to'] },
      create: { method: 'POST', path: '/purchases', fields: ['supplier_id', 'category', 'product_id', 'variant_id', 'unit_id', 'quantity', 'price', 'total_amount', 'paid_amount', 'remaining_amount', 'date', 'location_id'] }
    },
    payments: {
      customerCreate: { method: 'POST', path: '/payments/customers', fields: ['customer_id', 'amount', 'date', 'description', 'location_id'] },
      supplierCreate: { method: 'POST', path: '/payments/suppliers', fields: ['supplier_id', 'amount', 'date', 'description', 'location_id'] },
      history: { method: 'GET', path: '/payments', params: ['party_type', 'party_id'] }
    },
    stock: {
      current: { method: 'GET', path: '/stock', params: ['search', 'category', 'location'], note: 'Frontend displays stock_display only.' },
      movements: { method: 'GET', path: '/stock/movements', params: ['search', 'type', 'location', 'date_from', 'date_to'] }
    },
    returns: {
      list: { method: 'GET', path: '/sales-returns' },
      create: { method: 'POST', path: '/sales-returns', fields: ['sale_id', 'product_id', 'variant_id', 'quantity', 'unit_id', 'reason', 'condition', 'date', 'location_id'], note: 'Backend adjusts stock. Frontend does not.' }
    },
    damages: {
      list: { method: 'GET', path: '/damaged-stock' },
      create: { method: 'POST', path: '/damaged-stock', fields: ['product_id', 'variant_id', 'quantity', 'unit_id', 'reason', 'date', 'location_id'], note: 'Backend removes stock. Frontend does not.' }
    },
    workers: {
      auth: 'Authorization: Bearer {token}',
      list: { method: 'GET', path: '/workers', response: 'id, name, location, notes' },
      create: { method: 'POST', path: '/workers', fields: ['name', 'location_id', 'notes'], validation: 'name required' },
      detail: { method: 'GET', path: '/workers/{id}', response: 'profile + payment history from backend' },
      payment: { method: 'POST', path: '/workers/{id}/payments', fields: ['amount', 'date', 'description', 'location_id'], response: 'id, worker, amount, date, description, user, location', note: 'Tracks money received. Not a payroll engine.' },
      payments: { method: 'GET', path: '/workers/{id}/payments', response: 'payment[]' },
      monthly: { method: 'GET', path: '/workers/monthly-report', params: ['month', 'worker_id'], response: 'worker, amounts, dates, monthly_total_display', note: 'Official monthly totals come from Laravel.' }
    },
    rawMaterials: {
      auth: 'Authorization: Bearer {token}',
      list: { method: 'GET', path: '/raw-materials', response: 'id, name, units[], stock_display' },
      create: { method: 'POST', path: '/raw-materials', fields: ['name'], validation: 'name required' },
      detail: { method: 'GET', path: '/raw-materials/{id}', response: 'material, stock_display, purchases[], payments[]' },
      purchase: { method: 'POST', path: '/raw-materials/purchases', fields: ['raw_material_id', 'supplier_id', 'bag_size', 'bags', 'kg_per_bag', 'total_kg', 'price', 'total_amount', 'paid_amount', 'remaining_amount', 'date', 'location_id'] },
      stock: { method: 'GET', path: '/raw-materials/{id}/stock', response: 'stock_display by bag size and location. Separate from finished-product stock.' },
      history: { method: 'GET', path: '/raw-materials/{id}/history', response: 'purchases[], payments[]' },
      note: 'Production consumption is not implemented until the team confirms it.'
    },
    factoryMaterials: {
      auth: 'Authorization: Bearer {token}',
      list: { method: 'GET', path: '/factory-materials', response: 'id, name, units[]' },
      create: { method: 'POST', path: '/factory-materials', fields: ['name', 'unit_label'], validation: 'name required' },
      detail: { method: 'GET', path: '/factory-materials/{id}', response: 'material, purchases[]' },
      purchase: { method: 'POST', path: '/factory-materials/purchases', fields: ['material_id', 'quantity', 'unit_id', 'price', 'total_amount', 'supplier_or_person', 'paid_amount', 'remaining_amount', 'payment_type', 'date', 'location_id'] },
      note: 'Stock tracking for factory materials is an open question. Frontend does not invent it.'
    },
    externalDebts: {
      auth: 'Authorization: Bearer {token}',
      list: { method: 'GET', path: '/external-debts', params: ['direction', 'search'], response: 'person, direction, reason, original_amount, paid_received, remaining_display, date, user, location' },
      create: { method: 'POST', path: '/external-debts', fields: ['person', 'direction', 'reason', 'original_amount', 'paid_received', 'remaining_amount', 'date', 'location_id'], validation: 'person, direction, original_amount, date required. direction is business_owes or person_owes' },
      detail: { method: 'GET', path: '/external-debts/{id}', response: 'record + payments[]' },
      payment: { method: 'POST', path: '/external-debts/{id}/payments', fields: ['amount', 'date', 'description', 'location_id'] },
      note: 'Separate from customers and suppliers. Official remaining balances and opening-balance rules come from Laravel.'
    },
    profitLoss: {
      auth: 'Authorization: Bearer {token}',
      summary: { method: 'GET', path: '/reports/profit-loss', params: ['date_from', 'date_to', 'product_id', 'module', 'location_id'], response: 'summary.revenue/cost/gross_profit/operating_expenses/net_profit display values + rows[]. Frontend does not calculate these.' }
    },
    reports: {
      auth: 'Authorization: Bearer {token}',
      sales: { method: 'GET', path: '/reports/sales/{daily|weekly|monthly|yearly}', params: ['date_from', 'date_to', 'product_id', 'category', 'customer_id', 'location_id', 'search', 'page'] },
      purchases: { method: 'GET', path: '/reports/purchases/{daily|weekly|monthly|yearly}', params: ['date_from', 'date_to', 'product_id', 'category', 'supplier_id', 'location_id', 'search', 'page'] },
      stock: { method: 'GET', path: '/reports/stock/{current|movements|damaged|returned}', params: ['date_from', 'date_to', 'category', 'location_id', 'transaction_type', 'search', 'page'] },
      financial: { method: 'GET', path: '/reports/financial/{customer-debts|supplier-debts|external-debts|payments}', params: ['date_from', 'date_to', 'location_id', 'search', 'page'] },
      workers: { method: 'GET', path: '/reports/workers/{payments|monthly}', params: ['date_from', 'date_to', 'location_id', 'search', 'page'] },
      factory: { method: 'GET', path: '/reports/factory/{raw-materials|factory-materials}', params: ['location_id', 'search', 'page'] },
      location: { method: 'GET', path: '/reports/location/{kabul|maidan-wardak|ghazni}', params: ['date_from', 'date_to', 'category', 'product_id', 'search', 'page'], note: 'Location reports where the three named locations are supported. Multi-location access rules are an open question.' },
      export: { note: 'Frontend shows a disabled Export control until Laravel documents an export endpoint.' }
    },
    settings: {
      auth: 'Authorization: Bearer {token}',
      profile: { method: 'GET', path: '/settings/profile', response: 'name, email, location' },
      profileUpdate: { method: 'PUT', path: '/settings/profile', fields: ['name', 'email', 'location_id'] },
      password: { method: 'PUT', path: '/settings/password', fields: ['current_password', 'password', 'password_confirmation'] }
    },
    homeExpenses: {
      auth: 'Authorization: Bearer {token}',
      list: { method: 'GET', path: '/home-expenses', params: ['category', 'search', 'date_from', 'date_to'] },
      create: { method: 'POST', path: '/home-expenses', fields: ['category', 'description', 'amount', 'expense_date', 'date'], validation: 'category, amount, expense_date (or date) required' },
      update: { method: 'PUT', path: '/home-expenses/{id}', fields: ['category', 'description', 'amount', 'expense_date', 'date'] },
      response: 'id, category, description, amount, date, user',
      note: 'Must not affect business profit/loss. Visibility among users is an open question.'
    },
    validation: 'Laravel 422 { message, errors: { field: [message] } }',
    openQuestions: [
      'Currency and number format',
      'Tea remaining payable calculation method',
      'Rice supplier-credit rules',
      'Detergent supplier-credit rules',
      'Exact field names for bag-to-KG conversion',
      'Return condition values',
      'Whether factory materials have stock tracking',
      'Whether production automatically consumes raw materials',
      'External debt opening balances',
      'Home-expense visibility among the three users',
      'Profit costing method: FIFO or Weighted Average',
      'Whether operating expenses affect net profit',
      'Login identifier: email or username',
      'Dashboard widget JSON field names',
      'Multi-location access rules for the three users'
    ]
  };
})(window);
