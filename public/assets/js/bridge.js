/**
 * Maps the staff UI onto the Laravel /api/v1 contract.
 * Screens keep their existing fields. This file translates paths, bodies, and responses.
 */
(function (global) {
  'use strict';

  global.MBMS_MOCK = global.MBMS_MOCK || {};

  var rawRequest = global.MBMS_API.request;
  var stockByVariant = {};
  var cache = {
    locations: [],
    products: [],
    customers: [],
    suppliers: [],
    parties: []
  };

  var SESSION_CACHE_KEY = 'MBMS_REF_CACHE_V1';
  var SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
  var AUTH_ME_FLAG_KEY = 'MBMS_AUTH_ME_OK';
  var shellPrefetchPromise = null;
  var locationsPromise = null;
  var authMePromise = null;

  function readSessionBag() {
    try {
      var raw = global.sessionStorage.getItem(SESSION_CACHE_KEY);
      if (!raw) {
        return { savedAt: 0, entries: {} };
      }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.entries) {
        return { savedAt: 0, entries: {} };
      }
      return parsed;
    } catch (err) {
      return { savedAt: 0, entries: {} };
    }
  }

  function writeSessionBag(bag) {
    try {
      global.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(bag));
    } catch (err) {
      /* quota / private mode */
    }
  }

  function clearSessionCache() {
    try {
      global.sessionStorage.removeItem(SESSION_CACHE_KEY);
      global.sessionStorage.removeItem(AUTH_ME_FLAG_KEY);
    } catch (err) {
      /* ignore */
    }
    locationsPromise = null;
    authMePromise = null;
    shellPrefetchPromise = null;
  }

  function hasLocalAuthIdentity() {
    return !!(
      global.MBMS_CONFIG &&
      typeof global.MBMS_CONFIG.getAuthToken === 'function' &&
      global.MBMS_CONFIG.getAuthToken() &&
      typeof global.MBMS_CONFIG.getUserId === 'function' &&
      global.MBMS_CONFIG.getUserId()
    );
  }

  function markAuthMeOk() {
    try {
      global.sessionStorage.setItem(AUTH_ME_FLAG_KEY, '1');
    } catch (err) {
      /* ignore */
    }
  }

  function authMeAlreadyChecked() {
    try {
      return global.sessionStorage.getItem(AUTH_ME_FLAG_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function applyLocationRows(locationRows) {
    cache.locations = locationRows || [];
    global.MBMS_MOCK = global.MBMS_MOCK || {};
    global.MBMS_MOCK.locations = cache.locations;
    return cache.locations;
  }

  function isFreshEntry(entry) {
    return !!(entry && entry.savedAt && (Date.now() - entry.savedAt) < SESSION_CACHE_TTL_MS && entry.data != null);
  }

  function setSessionEntry(key, data) {
    var bag = readSessionBag();
    bag.entries[key] = { savedAt: Date.now(), data: data };
    bag.savedAt = Date.now();
    writeSessionBag(bag);
  }

  function getSessionEntry(key) {
    var entry = readSessionBag().entries[key];
    return isFreshEntry(entry) ? entry.data : null;
  }

  function removeSessionEntries(keys) {
    var bag = readSessionBag();
    (keys || []).forEach(function (key) {
      delete bag.entries[key];
    });
    writeSessionBag(bag);
  }

  function applyProductCaches(products) {
    cache.products = products || [];
    var mock = global.MBMS_MOCK = global.MBMS_MOCK || {};
    var tea = cache.products.filter(function (row) { return moduleName(row.module) === 'tea'; });
    var rice = cache.products.filter(function (row) { return moduleName(row.module) === 'rice'; });
    var detergent = cache.products.filter(function (row) { return moduleName(row.module) === 'detergent'; });
    mock.tea = catalogFrom(tea);
    mock.rice = catalogFrom(rice);
    mock.detergents = catalogFrom(detergent);
    mock.rawMaterials = cache.products.filter(function (row) { return moduleName(row.module) === 'raw_material'; }).map(mapProduct);
    mock.factoryMaterials = cache.products.filter(function (row) { return moduleName(row.module) === 'factory_material'; }).map(mapProduct);
    setSessionEntry('products', cache.products);
    setSessionEntry('tea', mock.tea);
    setSessionEntry('rice', mock.rice);
    setSessionEntry('detergents', mock.detergents);
  }

  function hydrateFromSession() {
    global.MBMS_MOCK = global.MBMS_MOCK || {};
    var locations = getSessionEntry('locations');
    if (Array.isArray(locations)) {
      cache.locations = locations;
      global.MBMS_MOCK.locations = locations;
    }
    var customers = getSessionEntry('customers');
    if (Array.isArray(customers)) {
      cache.customers = customers;
      global.MBMS_MOCK.customers = customers;
    }
    var suppliers = getSessionEntry('suppliers');
    if (Array.isArray(suppliers)) {
      cache.suppliers = suppliers;
      global.MBMS_MOCK.suppliers = suppliers;
    }
    var parties = getSessionEntry('parties');
    if (Array.isArray(parties)) {
      cache.parties = parties;
    }
    var products = getSessionEntry('products');
    if (Array.isArray(products)) {
      applyProductCaches(products);
    } else {
      ['tea', 'rice', 'detergents'].forEach(function (key) {
        var catalog = getSessionEntry(key);
        if (catalog) {
          global.MBMS_MOCK[key] = catalog;
        }
      });
    }
    var balances = getSessionEntry('stockBalances');
    if (Array.isArray(balances)) {
      indexStock(balances);
    }
    var workers = getSessionEntry('workers');
    if (Array.isArray(workers)) {
      global.MBMS_MOCK.workers = workers;
    }
    var workerPayments = getSessionEntry('workerPayments');
    if (Array.isArray(workerPayments)) {
      global.MBMS_MOCK.workerPayments = workerPayments;
      global.MBMS_MOCK.workerMonthlyReports = getSessionEntry('workerMonthlyReports') || monthlyFrom(workerPayments);
    }
  }

  function invalidateCaches(keys) {
    var list = keys || [];
    list.forEach(function (key) {
      if (key === 'locations') {
        cache.locations = [];
        if (global.MBMS_MOCK) {
          global.MBMS_MOCK.locations = [];
        }
      } else if (key === 'customers') {
        cache.customers = [];
        cache._customersLoaded = false;
        if (global.MBMS_MOCK) {
          global.MBMS_MOCK.customers = [];
        }
      } else if (key === 'suppliers') {
        cache.suppliers = [];
        cache._suppliersLoaded = false;
        if (global.MBMS_MOCK) {
          global.MBMS_MOCK.suppliers = [];
        }
      } else if (key === 'parties') {
        cache.parties = [];
      } else if (key === 'products' || key === 'tea' || key === 'rice' || key === 'detergents') {
        cache.products = [];
        if (global.MBMS_MOCK) {
          delete global.MBMS_MOCK.tea;
          delete global.MBMS_MOCK.rice;
          delete global.MBMS_MOCK.detergents;
          delete global.MBMS_MOCK.rawMaterials;
          delete global.MBMS_MOCK.factoryMaterials;
        }
      } else if (key === 'stockBalances' || key === 'stock') {
        stockByVariant = {};
        if (global.MBMS_MOCK) {
          delete global.MBMS_MOCK.stock;
        }
      } else if (key === 'workers') {
        if (global.MBMS_MOCK) {
          delete global.MBMS_MOCK.workers;
        }
      } else if (key === 'workerPayments') {
        if (global.MBMS_MOCK) {
          delete global.MBMS_MOCK.workerPayments;
          delete global.MBMS_MOCK.workerMonthlyReports;
        }
      }
    });
    removeSessionEntries(list.concat(
      list.indexOf('products') !== -1 ? ['tea', 'rice', 'detergents', 'products'] : []
    ));
  }

  function mutationInvalidationKeys(original, method) {
    if (String(method || 'GET').toUpperCase() === 'GET') {
      return [];
    }
    var path = String(original || '');
    if (path === 'auth/login' || path === 'login' || path === 'auth/logout' || path === 'logout') {
      return [];
    }
    if (/^(tea|rice|detergents|raw-materials|factory-materials)(\/|$)/.test(path) || path === 'products' || /^products\//.test(path)) {
      return ['products', 'tea', 'rice', 'detergents', 'stockBalances', 'stock'];
    }
    if (path === 'sales' || /\/sales$/.test(path) || path.indexOf('sales/') === 0) {
      return ['products', 'tea', 'rice', 'detergents', 'stockBalances', 'stock', 'customers'];
    }
    if (path === 'purchases' || /\/purchases$/.test(path) || path.indexOf('purchases/') === 0) {
      return ['products', 'tea', 'rice', 'detergents', 'stockBalances', 'stock', 'suppliers'];
    }
    if (path === 'customers' || /^customers\//.test(path) || path === 'payments/customers') {
      return ['customers'];
    }
    if (path === 'suppliers' || /^suppliers\//.test(path) || path === 'payments/suppliers') {
      return ['suppliers'];
    }
    if (path === 'stock' || path.indexOf('stock/') === 0 || path === 'damaged-stock' || path === 'sales-returns') {
      return ['stockBalances', 'stock', 'products', 'tea', 'rice', 'detergents'];
    }
    if (path === 'workers' || /^workers\//.test(path) || path === 'worker-payments') {
      return ['workers', 'workerPayments'];
    }
    if (path === 'external-debts' || /^external-debts\//.test(path) || path === 'external-parties' || /^external-parties\//.test(path)) {
      return ['parties'];
    }
    if (path === 'locations' || /^locations\//.test(path)) {
      return ['locations'];
    }
    return [];
  }

  function getCached(path) {
    var key = String(path || '').replace(/^\/+/, '');
    if (!key) {
      return null;
    }
    if (key === 'tea' || key === 'rice' || key === 'detergents') {
      if (global.MBMS_MOCK && global.MBMS_MOCK[key]) {
        return global.MBMS_MOCK[key];
      }
      return getSessionEntry(key);
    }
    if (key === 'workers') {
      if (global.MBMS_MOCK && Object.prototype.hasOwnProperty.call(global.MBMS_MOCK, 'workers') && Array.isArray(global.MBMS_MOCK.workers)) {
        return global.MBMS_MOCK.workers;
      }
      return getSessionEntry('workers');
    }
    if (key === 'customers') {
      if (cache._customersLoaded) {
        return cache.customers;
      }
      var cachedCustomers = getSessionEntry('customers');
      if (cachedCustomers !== null) {
        cache.customers = cachedCustomers;
        cache._customersLoaded = true;
        return cachedCustomers;
      }
      return null;
    }
    if (key === 'suppliers') {
      if (cache._suppliersLoaded) {
        return cache.suppliers;
      }
      var cachedSuppliers = getSessionEntry('suppliers');
      if (cachedSuppliers !== null) {
        cache.suppliers = cachedSuppliers;
        cache._suppliersLoaded = true;
        return cachedSuppliers;
      }
      return null;
    }
    if (key === 'locations') {
      if (cache.locations && cache.locations.length) {
        return cache.locations;
      }
      return getSessionEntry('locations');
    }
    if (key === 'stock') {
      return getSessionEntry('stock');
    }
    return null;
  }

  var MODULE_CATEGORY = {
    tea: 'tea',
    rice: 'rice',
    detergent: 'detergents',
    raw_material: 'raw-materials',
    factory_material: 'factory-materials'
  };

  var CATEGORY_MODULE = {
    tea: 'tea',
    rice: 'rice',
    detergents: 'detergent',
    'raw-materials': 'raw_material',
    'factory-materials': 'factory_material'
  };

  var CATEGORY_LABEL = {
    tea: 'Tea',
    rice: 'Rice',
    detergents: 'Detergents',
    'raw-materials': 'Raw Materials',
    'factory-materials': 'Factory Materials'
  };

  var LOCATION_KIND = {
    kabul: 'Kabul',
    'maidan-wardak': 'Maidan/Wardak',
    ghazni: 'Ghazni'
  };

  function sid(value) {
    return value == null ? '' : String(value);
  }

  function num(value) {
    var n = parseFloat(String(value == null ? '' : value).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function money(value) {
    return num(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function day(value) {
    if (!value) {
      return '';
    }
    return String(value).slice(0, 10);
  }

  function isoDate(date) {
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var dateNum = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + dateNum;
  }

  function relName(value) {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return value.name || '';
  }

  function inner(payload) {
    if (payload && typeof payload === 'object' && payload.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')) {
      return payload.data;
    }
    return payload;
  }

  function rowsOf(payload) {
    var data = inner(payload);
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }

  function isId(value) {
    return /^\d+$/.test(sid(value));
  }

  function findNamed(list, value) {
    var key = sid(value);
    return (list || []).filter(function (row) {
      return sid(row.id) === key || row.name === value;
    })[0] || null;
  }

  function idOnly(value) {
    if (value == null || value === '') {
      return '';
    }
    if (isId(value)) {
      return Number(value);
    }
    var location = findNamed(cache.locations, value);
    if (location) {
      return Number(location.id);
    }
    var customer = findNamed(cache.customers, value);
    if (customer) {
      return Number(customer.id);
    }
    var supplier = findNamed(cache.suppliers, value);
    if (supplier) {
      return Number(supplier.id);
    }
    return value;
  }

  function moduleName(value) {
    if (!value) {
      return '';
    }
    if (typeof value === 'object') {
      return value.value || '';
    }
    return String(value);
  }

  function categoryOf(moduleValue) {
    return MODULE_CATEGORY[moduleName(moduleValue)] || moduleName(moduleValue) || '';
  }

  function moduleOf(category) {
    return CATEGORY_MODULE[category] || category || '';
  }

  function indexStock(rows) {
    stockByVariant = {};
    (rows || []).forEach(function (row) {
      var variant = row.variant || {};
      var id = sid(row.product_variant_id || variant.id);
      if (!id) {
        return;
      }
      if (!stockByVariant[id]) {
        stockByVariant[id] = { qty: 0, unit: variant.base_unit || '', byLocation: [] };
      }
      var qty = num(row.quantity);
      stockByVariant[id].qty += qty;
      if (variant.base_unit) {
        stockByVariant[id].unit = variant.base_unit;
      }
      var locationId = sid(row.location_id || (row.location && row.location.id));
      var locationName = relName(row.location) || '';
      if (locationId || locationName) {
        var existing = stockByVariant[id].byLocation.filter(function (item) {
          return item.id === locationId || (!locationId && item.name === locationName);
        })[0];
        if (existing) {
          existing.qty += qty;
        } else {
          stockByVariant[id].byLocation.push({
            id: locationId,
            name: locationName || ('Location ' + locationId),
            qty: qty
          });
        }
      }
    });
  }

  function formatQty(value) {
    var n = num(value);
    if (Math.abs(n - Math.round(n)) < 0.0001) {
      return String(Math.round(n));
    }
    return String(n);
  }

  function stockText(variantId, unit) {
    var entry = stockByVariant[sid(variantId)];
    if (!entry) {
      return '0' + (unit ? ' ' + unit : '');
    }
    var displayUnit = entry.unit || unit || '';
    var total = formatQty(entry.qty) + (displayUnit ? ' ' + displayUnit : '');
    var parts = (entry.byLocation || [])
      .filter(function (item) { return num(item.qty) !== 0; })
      .map(function (item) {
        return item.name + ' ' + formatQty(item.qty);
      });
    if (parts.length > 1 || (parts.length === 1 && entry.byLocation.length > 1)) {
      return total + ' (' + parts.join(', ') + ')';
    }
    if (parts.length === 1) {
      return parts[0] + (displayUnit ? ' ' + displayUnit : '') + ' · total ' + total;
    }
    return total;
  }

  function stockAtLocation(variantId, locationId) {
    var entry = stockByVariant[sid(variantId)];
    if (!entry) {
      return { qty: 0, unit: '', location: '' };
    }
    var loc = sid(locationId);
    var match = (entry.byLocation || []).filter(function (item) {
      return item.id === loc;
    })[0];
    return {
      qty: match ? num(match.qty) : 0,
      unit: entry.unit || '',
      location: match ? match.name : ''
    };
  }

  function clearStore(key) {
    try {
      var store = JSON.parse(global.localStorage.getItem('MBMS_PHASE3_STORE') || '{}');
      delete store[key];
      global.localStorage.setItem('MBMS_PHASE3_STORE', JSON.stringify(store));
    } catch (err) {
      /* ignore */
    }
  }

  function lineLabel(items) {
    return (items || []).map(function (item) {
      var variant = item.variant || {};
      var product = variant.product || {};
      return [product.name, variant.name].filter(Boolean).join(' ');
    }).filter(Boolean).join(', ');
  }

  function firstItem(record) {
    return (record.items && record.items[0]) || {};
  }

  function mapParty(row) {
    return {
      id: sid(row.id),
      name: row.name || '',
      phone: row.phone || '',
      address: row.address || '',
      notes: row.notes || '',
      location: '',
      balance_display: money(row.balance)
    };
  }

  function mapVariant(product, variant) {
    return {
      id: sid(variant.id),
      label: variant.name || '',
      type_id: sid(product.id),
      product_id: sid(product.id),
      size_id: variant.name || '',
      unit_id: variant.name || '',
      stock_display: stockText(variant.id, variant.base_unit)
    };
  }

  function mapProduct(row) {
    var variants = (row.variants || []).map(function (variant) {
      return mapVariant(row, variant);
    });
    return {
      id: sid(row.id),
      name: row.name || '',
      notes: row.description || '',
      module: row.module || '',
      category: categoryOf(row.module),
      units: variants.map(function (variant) {
        return { id: variant.id, label: variant.label };
      }),
      variants: variants,
      stock_display: variants.map(function (variant) {
        return variant.label + ': ' + variant.stock_display;
      }).join(', ')
    };
  }

  function catalogFrom(products) {
    var mapped = (products || []).map(mapProduct);
    var variants = [];
    var sizes = [];
    var seen = {};
    mapped.forEach(function (product) {
      product.variants.forEach(function (variant) {
        variants.push(variant);
        if (!seen[variant.label]) {
          seen[variant.label] = true;
          sizes.push({ id: variant.label, label: variant.label });
        }
      });
    });
    return {
      types: mapped,
      products: mapped,
      sizes: sizes,
      variants: variants,
      purchases: [],
      sales: []
    };
  }

  function mapSale(row) {
    var item = firstItem(row);
    var variant = item.variant || {};
    var product = variant.product || {};
    var customer = row.customer || {};
    var seller = row.user || {};
    return {
      id: sid(row.id),
      reference_no: row.reference_no || '',
      category: categoryOf(product.module),
      product: product.name || lineLabel(row.items) || 'Sale',
      product_id: sid(product.id),
      variant: variant.name || '',
      variant_id: sid(item.product_variant_id || variant.id),
      customer: relName(row.customer),
      customer_id: sid(row.customer_id || customer.id),
      customer_phone: customer.phone || '',
      customer_address: customer.address || '',
      seller: seller.name || '',
      supplier: '',
      quantity: item.quantity != null ? String(item.quantity) : '',
      price: item.unit_price != null ? money(item.unit_price) : '',
      total: money(row.total_amount),
      total_raw: num(row.total_amount),
      paid: money(row.paid_amount),
      paid_raw: num(row.paid_amount),
      remaining: money(row.remaining_amount),
      remaining_raw: num(row.remaining_amount),
      payment_type: row.payment_type || '',
      date: day(row.sold_at),
      sold_at: row.sold_at || '',
      location: relName(row.location),
      location_id: sid(row.location_id),
      notes: row.notes || '',
      items: (row.items || []).map(function (line) {
        var lineVariant = line.variant || {};
        var lineProduct = lineVariant.product || {};
        return {
          id: sid(line.id),
          product_variant_id: sid(line.product_variant_id || lineVariant.id),
          product_id: sid(lineProduct.id),
          product: lineProduct.name || '',
          variant: lineVariant.name || '',
          unit: line.unit || lineVariant.base_unit || '',
          quantity: line.quantity != null ? String(line.quantity) : '',
          quantity_raw: num(line.quantity),
          unit_price: money(line.unit_price),
          unit_price_raw: num(line.unit_price),
          line_total: money(line.line_total != null ? line.line_total : (num(line.quantity) * num(line.unit_price))),
          line_total_raw: num(line.line_total != null ? line.line_total : (num(line.quantity) * num(line.unit_price)))
        };
      })
    };
  }

  function mapPurchase(row) {
    var item = firstItem(row);
    var variant = item.variant || {};
    var product = variant.product || {};
    return {
      id: sid(row.id),
      reference_no: row.reference_no || '',
      category: categoryOf(product.module),
      product: product.name || lineLabel(row.items) || 'Purchase',
      product_id: sid(product.id),
      variant: variant.name || '',
      variant_id: sid(item.product_variant_id || variant.id),
      customer: '',
      supplier: relName(row.supplier),
      supplier_id: sid(row.supplier_id || (row.supplier && row.supplier.id)),
      material_id: sid(product.id),
      quantity: item.quantity != null ? String(item.quantity) : '',
      price: item.unit_price != null ? money(item.unit_price) : '',
      total: money(row.total_amount),
      paid: money(row.paid_amount),
      remaining: money(row.remaining_amount),
      date: day(row.purchased_at),
      location: relName(row.location),
      location_id: sid(row.location_id),
      notes: row.notes || ''
    };
  }

  function mapBalance(row) {
    var variant = row.variant || {};
    var product = variant.product || {};
    var category = categoryOf(product.module);
    return {
      id: sid(row.id),
      category: CATEGORY_LABEL[category] || category,
      category_id: category,
      product: product.name || '',
      variant: variant.name || '',
      stock_display: stockText(variant.id, variant.base_unit),
      quantity: row.quantity,
      location: relName(row.location),
      location_id: sid(row.location_id),
      date: ''
    };
  }

  function mapMovement(row) {
    var variant = row.variant || {};
    var product = variant.product || {};
    var typeName = moduleName(row.type).replace(/_/g, ' ');
    var refType = String(row.reference_type || '').split('\\').pop();
    return {
      id: sid(row.id),
      date: day(row.occurred_at || row.created_at),
      type: typeName,
      product: product.name || '',
      variant: variant.name || '',
      quantity: row.quantity_change != null ? String(row.quantity_change) : (row.quantity != null ? String(row.quantity) : ''),
      location: relName(row.location),
      reference: refType ? (refType + (row.reference_id ? ' ' + row.reference_id : '')) : (row.reference_no || '')
    };
  }

  function mapPayment(row, personKey) {
    var person = row[personKey] || {};
    var personIdKey = personKey === 'customer' ? 'customer_id' : 'supplier_id';
    return {
      id: sid(row.id),
      person: person.name || '',
      person_id: sid(row[personIdKey] || person.id),
      customer_id: personKey === 'customer' ? sid(row.customer_id || person.id) : '',
      supplier_id: personKey === 'supplier' ? sid(row.supplier_id || person.id) : '',
      amount: money(row.amount),
      date: day(row.paid_at),
      description: row.notes || row.description || '',
      user: relName(row.user),
      location: relName(row.location)
    };
  }

  function mapWorker(row) {
    return {
      id: sid(row.id),
      name: row.name || '',
      phone: row.phone || '',
      notes: row.notes || '',
      location: '—'
    };
  }

  function mapWorkerPayment(row) {
    return {
      id: sid(row.id),
      worker_id: sid(row.worker_id || (row.worker && row.worker.id)),
      worker: relName(row.worker),
      amount: money(row.amount),
      date: day(row.paid_at),
      description: row.description || '',
      user: relName(row.user),
      location: relName(row.location),
      month: day(row.paid_at).slice(0, 7)
    };
  }

  function monthlyFrom(payments) {
    var groups = {};
    payments.forEach(function (row) {
      var key = row.worker_id + '|' + row.month;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          worker_id: row.worker_id,
          worker: row.worker,
          month: row.month,
          dates: [],
          amounts: [],
          total: 0
        };
      }
      groups[key].dates.push(row.date);
      groups[key].amounts.push(row.amount);
      groups[key].total += num(row.amount);
    });
    return Object.keys(groups).map(function (key) {
      var group = groups[key];
      return {
        id: group.id,
        worker_id: group.worker_id,
        worker: group.worker,
        month: group.month,
        dates: group.dates.join(', '),
        amounts: group.amounts.join(', '),
        monthly_total_display: money(group.total),
        date: group.month,
        amount: money(group.total),
        location: ''
      };
    });
  }

  function mapDebt(row) {
    var direction = row.direction && row.direction.value ? row.direction.value : row.direction;
    return {
      id: sid(row.id),
      person: relName(row.party),
      direction: direction || '',
      reason: row.reason || '',
      original_amount: money(row.original_amount),
      paid_received: money(row.paid_amount),
      remaining_display: money(row.remaining_amount),
      date: day(row.opened_at),
      user: relName(row.user),
      location: relName(row.location)
    };
  }

  function mapExpense(row) {
    return {
      id: sid(row.id),
      category: row.category || '',
      description: row.description || '',
      amount: money(row.amount),
      date: day(row.expense_date),
      user: relName(row.user)
    };
  }

  function mapReturn(row) {
    var sale = row.sale || {};
    var item = firstItem(row);
    var variant = item.variant || {};
    var product = variant.product || {};
    return {
      id: sid(row.id),
      date: day(row.returned_at),
      sale_id: sid(row.sale_id || sale.id),
      product: product.name || lineLabel(row.items) || sale.reference_no || '',
      variant: variant.name || '',
      quantity: item.quantity != null ? String(item.quantity) : '',
      reason: row.notes || '',
      location: relName(row.location)
    };
  }

  function mapDamage(row) {
    var variant = row.variant || {};
    var product = variant.product || {};
    return {
      id: sid(row.id),
      date: day(row.damaged_at),
      product: product.name || '',
      variant: variant.name || '',
      quantity: row.quantity != null ? String(row.quantity) : '',
      reason: row.reason || '',
      location: relName(row.location)
    };
  }

  function tradeBody(body, partyKey, dateKey) {
    var paid = body.paid != null ? body.paid : body.paid_amount;
    var payload = {
      location_id: idOnly(body.location_id || body.location),
      paid_amount: num(paid),
      notes: body.notes || null,
      items: [{
        product_variant_id: idOnly(body.variant_id || body.variant || body.unit || body.size_id || body.unit_id),
        quantity: num(body.quantity || body.bags || body.total_kg),
        unit_price: num(body.price != null ? body.price : body.unit_price)
      }]
    };
    payload[partyKey] = idOnly(body[partyKey] || body.party_id || body.party || body.customer || body.supplier || body.person);
    payload[dateKey] = body.date || body[dateKey] || null;
    return payload;
  }

  function rangeFor(kind, params) {
    params = params || {};
    var from = params.date_from || params.from || '';
    var to = params.date_to || params.to || '';
    if (from || to || !kind) {
      return { from: from, to: to };
    }
    var now = new Date();
    if (kind === 'daily') {
      return { from: isoDate(now), to: isoDate(now) };
    }
    if (kind === 'weekly') {
      var week = new Date(now);
      week.setDate(week.getDate() - 6);
      return { from: isoDate(week), to: isoDate(now) };
    }
    if (kind === 'monthly') {
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
    }
    if (kind === 'yearly') {
      return { from: now.getFullYear() + '-01-01', to: isoDate(now) };
    }
    return { from: '', to: '' };
  }

  function reportTarget(path, params) {
    var parts = String(path || '').split('/');
    var group = parts[1] || '';
    var kind = parts[2] || '';
    var range = rangeFor(kind, params);
    var next = { path: path, params: { per_page: 100, from: range.from, to: range.to } };
    if (params.location_id && isId(params.location_id)) {
      next.params.location_id = params.location_id;
    }
    if (params.customer_id && isId(params.customer_id)) {
      next.params.customer_id = params.customer_id;
    }
    if (params.supplier_id && isId(params.supplier_id)) {
      next.params.supplier_id = params.supplier_id;
    }
    if (group === 'sales') {
      next.path = 'sales';
    } else if (group === 'purchases') {
      next.path = 'purchases';
    } else if (group === 'stock' && kind === 'movements') {
      next.path = 'stock/movements';
    } else if (group === 'stock' && kind === 'damaged') {
      next.path = 'damaged-stocks';
    } else if (group === 'stock' && kind === 'returned') {
      next.path = 'sales-returns';
    } else if (group === 'stock') {
      next.path = 'stock/balances';
      if (params.category) {
        next.params.module = moduleOf(params.category);
      }
    } else if (group === 'financial' && kind === 'supplier-debts') {
      next.path = 'suppliers';
    } else if (group === 'financial' && kind === 'external-debts') {
      next.path = 'external-debts';
    } else if (group === 'financial' && kind === 'payments') {
      next.path = 'customer-payments';
      next.also = 'supplier-payments';
    } else if (group === 'financial') {
      next.path = 'customers';
    } else if (group === 'workers') {
      next.path = 'worker-payments';
    } else if (group === 'factory') {
      next.path = 'products';
      next.params.module = kind === 'factory-materials' ? 'factory_material' : 'raw_material';
    } else if (group === 'location') {
      next.path = 'stock/movements';
      var location = findNamed(cache.locations, LOCATION_KIND[kind] || kind);
      if (location) {
        next.params.location_id = location.id;
      }
    } else if (path === 'reports/profit-loss') {
      next.path = 'reports/profit-loss';
      next.params = {};
    }
    return next;
  }

  function plan(method, path, options) {
    options = options || {};
    var params = Object.assign({}, options.params || {});
    var body = options.body;
    var verb = String(method || 'GET').toUpperCase();
    var nextPath = String(path || '').replace(/^\/+/, '');
    var createPartyName = '';

    if (params.date_from && !params.from) {
      params.from = params.date_from;
    }
    if (params.date_to && !params.to) {
      params.to = params.date_to;
    }
    delete params.date_from;
    delete params.date_to;

    if (nextPath === 'login') {
      nextPath = 'auth/login';
    } else if (nextPath === 'logout') {
      nextPath = 'auth/logout';
    } else if (nextPath === 'settings/profile' && verb === 'GET') {
      nextPath = 'auth/me';
    } else if (nextPath === 'settings/profile' && verb === 'PUT') {
      nextPath = 'auth/profile';
      body = {
        name: body && body.name,
        email: body && body.email,
        phone: body && body.phone
      };
    } else if (nextPath === 'settings/password') {
      nextPath = 'auth/password';
      body = {
        current_password: body && body.current_password,
        password: body && body.password,
        password_confirmation: body && body.password_confirmation
      };
    } else if (nextPath === 'tea' || nextPath === 'rice' || nextPath === 'detergents' || nextPath === 'raw-materials' || nextPath === 'factory-materials') {
      if (verb === 'GET') {
        params.module = moduleOf(nextPath);
        params.per_page = params.per_page || 200;
        nextPath = 'products';
      } else if (verb === 'POST') {
        nextPath = 'products';
        body = {
          module: moduleOf(path),
          name: body && body.name,
          description: (body && (body.notes || body.description)) || null,
          variants: ((body && body.units) || [{ label: 'Unit' }]).map(function (unit) {
            var base = unit.base_unit || unit.package_unit || 'kg';
            var qty = num(unit.package_qty);
            return {
              name: unit.label || unit.name || 'Unit',
              base_unit: base,
              package_unit: unit.package_unit || base,
              package_qty: qty > 0 ? qty : 1,
              sku: unit.sku || null
            };
          })
        };
      }
    } else if (/^(tea|rice|detergents|raw-materials|factory-materials)\/purchases$/.test(nextPath)) {
      nextPath = 'purchases';
      body = tradeBody(body || {}, 'supplier_id', 'purchased_at');
    } else if (/^(tea|rice|detergents)\/sales$/.test(nextPath)) {
      nextPath = 'sales';
      body = tradeBody(body || {}, 'customer_id', 'sold_at');
    } else if (nextPath === 'sales' && verb === 'POST') {
      body = tradeBody(body || {}, 'customer_id', 'sold_at');
    } else if (nextPath === 'purchases' && verb === 'POST') {
      body = tradeBody(body || {}, 'supplier_id', 'purchased_at');
    } else if (nextPath === 'sales' || nextPath === 'purchases' || nextPath === 'customers' || nextPath === 'suppliers' || nextPath === 'workers' || nextPath === 'home-expenses' || nextPath === 'external-debts') {
      if (verb === 'GET') {
        params.per_page = params.per_page || 100;
      }
    } else if (nextPath === 'payments/customers') {
      nextPath = 'customer-payments';
      if (verb === 'POST') {
        body = {
          customer_id: idOnly(body.person_id || body.person),
          location_id: idOnly(body.location_id || body.location),
          amount: num(body.amount),
          paid_at: body.date,
          notes: body.description || null
        };
      } else {
        params.per_page = 100;
      }
    } else if (nextPath === 'payments/suppliers') {
      nextPath = 'supplier-payments';
      if (verb === 'POST') {
        body = {
          supplier_id: idOnly(body.person_id || body.person),
          location_id: idOnly(body.location_id || body.location),
          amount: num(body.amount),
          paid_at: body.date,
          notes: body.description || null
        };
      } else {
        params.per_page = 100;
      }
    } else if (nextPath === 'stock') {
      nextPath = 'stock/balances';
      params.per_page = 200;
    } else if (nextPath === 'stock/movements' || nextPath === 'sales-returns' || nextPath === 'damaged-stocks') {
      params.per_page = params.per_page || 100;
    } else if (nextPath === 'damaged-stock') {
      nextPath = 'damaged-stocks';
      if (verb === 'POST') {
        body = {
          product_variant_id: idOnly(body.variant_id || body.variant),
          location_id: idOnly(body.location_id || body.location),
          quantity: num(body.quantity),
          reason: body.reason,
          damaged_at: body.date || null,
          notes: body.notes || null
        };
      } else {
        params.per_page = 100;
      }
    } else if (nextPath === 'sales-returns' && verb === 'POST') {
      var sale = findNamed(global.MBMS_MOCK && global.MBMS_MOCK.sales, body.sale_id);
      var saleItem = sale && sale.items && sale.items[0];
      body = {
        sale_id: idOnly(body.sale_id),
        location_id: idOnly(body.location_id || body.location),
        returned_at: body.date || null,
        notes: body.reason || null,
        items: [{
          sale_item_id: saleItem ? Number(saleItem.id) : '',
          quantity: num(body.quantity)
        }]
      };
    } else if (/^workers\/\d+\/payments$/.test(nextPath)) {
      var workerId = nextPath.split('/')[1];
      nextPath = 'worker-payments';
      body = {
        worker_id: Number(body.worker_id || workerId),
        location_id: idOnly(body.location_id || body.location),
        amount: num(body.amount),
        paid_at: body.date || null,
        description: body.description || null
      };
    } else if (nextPath === 'external-debts' && verb === 'POST') {
      createPartyName = body.person || '';
      body = {
        direction: body.direction,
        reason: body.reason,
        original_amount: num(body.original_amount),
        paid_amount: num(body.paid_received || 0),
        location_id: idOnly(body.location_id || body.location),
        opened_at: body.date || null
      };
    } else if (/^external-debts\/\d+\/payments$/.test(nextPath) && verb === 'POST') {
      body = {
        location_id: idOnly(body.location_id || body.location),
        amount: num(body.amount),
        paid_at: body.date || null,
        notes: body.description || null
      };
    } else if (nextPath === 'home-expenses' || /^home-expenses\/\d+$/.test(nextPath)) {
      if (verb === 'POST' || verb === 'PUT') {
        body = {
          category: body.category,
          description: body.description || null,
          amount: num(body.amount),
          expense_date: body.date || body.expense_date
        };
      } else {
        params.per_page = 100;
      }
    } else if ((nextPath === 'customers' || nextPath === 'suppliers' || /^customers\/\d+$/.test(nextPath) || /^suppliers\/\d+$/.test(nextPath)) && (verb === 'POST' || verb === 'PUT')) {
      body = {
        name: body.name,
        phone: body.phone || null,
        address: body.address || null,
        notes: body.notes || null
      };
    } else if (nextPath === 'workers' && verb === 'POST') {
      body = {
        name: body.name,
        phone: body.phone || null,
        notes: body.notes || null
      };
    } else if (nextPath.indexOf('reports/') === 0 && nextPath !== 'reports/profit-loss') {
      var target = reportTarget(nextPath, params);
      nextPath = target.path;
      params = target.params;
      options.also = target.also || '';
      options.reportKind = path;
    } else if (verb === 'GET' && !params.per_page && nextPath.indexOf('/') === -1) {
      params.per_page = 100;
    }

    var nextOptions = Object.assign({}, options, { params: params, body: body });
    return {
      method: verb,
      path: nextPath,
      original: path,
      options: nextOptions,
      createPartyName: createPartyName
    };
  }

  function reportRows(original, payload, extraPayload) {
    var rows = rowsOf(payload);
    var kind = String(original || '');
    if (kind.indexOf('reports/sales') === 0) {
      rows = rows.map(function (row) {
        var mapped = mapSale(row);
        return { date: mapped.date, period: mapped.date, product: mapped.product, customer: mapped.customer, amount: mapped.total, location: mapped.location };
      });
    } else if (kind.indexOf('reports/purchases') === 0) {
      rows = rows.map(function (row) {
        var mapped = mapPurchase(row);
        return { date: mapped.date, period: mapped.date, product: mapped.product, supplier: mapped.supplier, amount: mapped.total, location: mapped.location };
      });
    } else if (kind === 'reports/stock/movements' || kind.indexOf('reports/location/') === 0) {
      rows = rows.map(function (row) {
        var mapped = mapMovement(row);
        return {
          date: mapped.date,
          category: '',
          product: mapped.product,
          variant: mapped.variant,
          type: mapped.type,
          quantity: mapped.quantity,
          stock_display: mapped.quantity,
          amount: mapped.quantity,
          location: mapped.location
        };
      });
    } else if (kind === 'reports/stock/damaged') {
      rows = rows.map(function (row) {
        var mapped = mapDamage(row);
        return { date: mapped.date, category: '', product: mapped.product, variant: mapped.variant, type: 'Damage', quantity: mapped.quantity, stock_display: mapped.quantity, location: mapped.location };
      });
    } else if (kind === 'reports/stock/returned') {
      rows = rows.map(mapReturn);
    } else if (kind === 'reports/stock/current' || kind === 'reports/stock') {
      rows = rows.map(mapBalance);
    } else if (kind === 'reports/financial/supplier-debts') {
      rows = rows.filter(function (row) { return num(row.balance) > 0; }).map(function (row) {
        return { date: '', person: row.name, direction: 'Supplier payable', amount: money(row.balance), remaining_display: money(row.balance), location: '' };
      });
    } else if (kind === 'reports/financial/external-debts') {
      rows = rows.map(function (row) {
        var mapped = mapDebt(row);
        return { date: mapped.date, person: mapped.person, direction: mapped.direction, amount: mapped.original_amount, remaining_display: mapped.remaining_display, location: mapped.location };
      });
    } else if (kind === 'reports/financial/payments') {
      var incoming = rows.map(function (row) { return mapPayment(row, 'customer'); });
      var outgoing = rowsOf(extraPayload).map(function (row) { return mapPayment(row, 'supplier'); });
      rows = incoming.concat(outgoing);
    } else if (kind === 'reports/financial/customer-debts' || kind.indexOf('reports/financial') === 0) {
      rows = rows.filter(function (row) { return num(row.balance) > 0; }).map(function (row) {
        return { date: '', person: row.name, direction: 'Customer owes', amount: money(row.balance), remaining_display: money(row.balance), location: '' };
      });
    } else if (kind === 'reports/workers/monthly') {
      rows = monthlyFrom(rows.map(mapWorkerPayment));
    } else if (kind.indexOf('reports/workers') === 0) {
      rows = rows.map(function (row) {
        var mapped = mapWorkerPayment(row);
        return { date: mapped.date, month: mapped.month, worker: mapped.worker, amount: mapped.amount, monthly_total_display: mapped.amount, location: mapped.location };
      });
    } else if (kind.indexOf('reports/factory') === 0) {
      rows = rows.map(function (row) {
        var product = mapProduct(row);
        return { product: product.name, stock_display: product.stock_display || '0', note: product.notes || '', location: '' };
      });
    }
    return {
      rows: rows,
      summary: { rows: rows.length },
      meta: { current_page: 1, last_page: 1 }
    };
  }

  function present(original, method, payload) {
    var data = inner(payload);
    if (original === 'auth/login' || original === 'login') {
      return data;
    }
    if (original === 'auth/me' || original === 'settings/profile') {
      var user = data || {};
      if (user.id && global.MBMS_CONFIG.setUserId) {
        global.MBMS_CONFIG.setUserId(user.id);
      }
      var locationId = user.location_id != null
        ? sid(user.location_id)
        : (user.location && user.location.id != null ? sid(user.location.id) : '');
      var locationName = (user.location && user.location.name) || '';
      if (global.MBMS_CONFIG && global.MBMS_CONFIG.setLocation) {
        global.MBMS_CONFIG.setLocation(locationId, locationName);
      }
      return {
        id: sid(user.id),
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        location_id: locationId,
        location: locationId,
        location_name: locationName
      };
    }
    if (original === 'dashboard') {
      var recentSales = rowsOf(data && data.recent_sales);
      var recentPurchases = rowsOf(data && data.recent_purchases);
      var stockWarnings = rowsOf(data && data.stock_warnings);
      var byLocation = rowsOf(data && data.by_location);
      var recent = []
        .concat(recentSales.map(function (row) {
          return {
            when: day(row.sold_at),
            type: 'Sale',
            detail: [relName(row.customer) || row.reference_no || '', relName(row.location)].filter(Boolean).join(' · '),
            amount: money(row.total_amount)
          };
        }))
        .concat(recentPurchases.map(function (row) {
          return {
            when: day(row.purchased_at),
            type: 'Purchase',
            detail: [relName(row.supplier) || row.reference_no || '', relName(row.location)].filter(Boolean).join(' · '),
            amount: money(row.total_amount)
          };
        }));
      function provinceLines(metricKey, formatFn) {
        return byLocation.map(function (row) {
          return {
            name: row.name || '',
            value: formatFn ? formatFn(row[metricKey]) : String(row[metricKey] != null ? row[metricKey] : 0)
          };
        }).filter(function (row) { return row.name; });
      }
      return {
        today_sales: money(data.today && data.today.sales_total),
        today_sales_by_location: provinceLines('sales_total', money),
        today_purchases: money(data.today && data.today.purchases_total),
        today_purchases_by_location: provinceLines('purchases_total', money),
        current_stock: data.stock_quantity != null ? String(data.stock_quantity) : '—',
        current_stock_by_location: provinceLines('stock_quantity', function (v) { return formatQty(v); }),
        customer_receivables: money(data.receivables && data.receivables.customers_total),
        supplier_payables: money(data.payables && data.payables.suppliers_total),
        profit_loss: (function () {
          if (!data.profit_loss) {
            return '—';
          }
          if (data.profit_loss.available && data.profit_loss.net_profit != null) {
            return money(data.profit_loss.net_profit);
          }
          return data.profit_loss.available ? 'Available' : 'Not available yet';
        })(),
        worker_payments: data.worker_payments_today != null ? money(data.worker_payments_today) : '—',
        worker_payments_by_location: provinceLines('worker_payments_today', money),
        recent_transactions: recent,
        stock_warnings: stockWarnings.map(function (row) {
          var variant = row.variant || {};
          var product = variant.product || {};
          return {
            item: [product.name, variant.name].filter(Boolean).join(' · ') || 'Stock',
            message: num(row.quantity) <= 0
              ? ('Out of stock at ' + (relName(row.location) || 'this province'))
              : (formatQty(row.quantity) + ' left at ' + (relName(row.location) || 'this province'))
          };
        })
      };
    }
    if (original === 'reports/profit-loss') {
      var summary = (data && data.summary) || {};
      var note = (summary.note)
        || (data && data.method_label ? ('Method: ' + data.method_label) : '')
        || 'Profit and loss from Laravel.';
      return {
        summary: {
          revenue: { display: money(summary.revenue) },
          cost: { display: money(summary.cost != null ? summary.cost : summary.cogs) },
          gross_profit: { display: money(summary.gross_profit) },
          operating_expenses: { display: money(summary.operating_expenses) },
          net_profit: { display: money(summary.net_profit) }
        },
        rows: (Array.isArray(data.rows) ? data.rows : []).map(function (row) {
          return {
            module: row.module || '',
            product: row.product || '',
            location: row.location || '',
            revenue: money(row.revenue),
            cost: money(row.cost),
            result: money(row.result)
          };
        }),
        notice: note
      };
    }
    if (String(original).indexOf('reports/') === 0) {
      return data;
    }
    if (original === 'tea' || original === 'rice' || original === 'detergents') {
      if (method === 'POST') {
        return mapProduct(data || {});
      }
      return catalogFrom(rowsOf(payload));
    }
    if ((original === 'raw-materials' || original === 'factory-materials') && method === 'GET') {
      return rowsOf(payload).map(mapProduct);
    }
    if ((original === 'raw-materials' || original === 'factory-materials') && method === 'POST') {
      return mapProduct(data || {});
    }
    if (original === 'customers' || original === 'suppliers') {
      return method === 'GET' ? rowsOf(payload).map(mapParty) : mapParty(data || {});
    }
    if (original === 'sales' || /^sales\/\d+$/.test(original)) {
      if (method === 'GET' && original === 'sales') {
        return rowsOf(payload).map(mapSale);
      }
      return mapSale(data || {});
    }
    if (original === 'purchases' || /\/purchases$/.test(original)) {
      return method === 'GET' ? rowsOf(payload).map(mapPurchase) : mapPurchase(data || {});
    }
    if (/\/sales$/.test(original) && method === 'POST') {
      return mapSale(data || {});
    }
    if (original === 'payments/customers') {
      return method === 'GET' ? rowsOf(payload).map(function (row) { return mapPayment(row, 'customer'); }) : mapPayment(data || {}, 'customer');
    }
    if (original === 'payments/suppliers') {
      return method === 'GET' ? rowsOf(payload).map(function (row) { return mapPayment(row, 'supplier'); }) : mapPayment(data || {}, 'supplier');
    }
    if (original === 'stock') {
      var balances = rowsOf(payload);
      indexStock(balances);
      return balances.map(mapBalance);
    }
    if (original === 'stock/movements') {
      return rowsOf(payload).map(mapMovement);
    }
    if (original === 'sales-returns') {
      return method === 'GET' ? rowsOf(payload).map(mapReturn) : mapReturn(data || {});
    }
    if (original === 'damaged-stock') {
      return method === 'GET' ? rowsOf(payload).map(mapDamage) : mapDamage(data || {});
    }
    if (original === 'workers') {
      return method === 'GET' ? rowsOf(payload).map(mapWorker) : mapWorker(data || {});
    }
    if (/^workers\/\d+\/payments$/.test(original)) {
      return mapWorkerPayment(data || {});
    }
    if (original === 'external-debts') {
      return method === 'GET' ? rowsOf(payload).map(mapDebt) : mapDebt(data || {});
    }
    if (original === 'home-expenses' || /^home-expenses\/\d+$/.test(original)) {
      return method === 'GET' ? rowsOf(payload).map(mapExpense) : mapExpense(data || {});
    }
    return data;
  }

  function remember(path, data) {
    var mock = global.MBMS_MOCK = global.MBMS_MOCK || {};
    if (path === 'tea' || path === 'rice') {
      mock[path] = data;
      setSessionEntry(path, data);
      return;
    }
    if (path === 'detergents') {
      mock.detergents = data;
      setSessionEntry('detergents', data);
      return;
    }
    if (path === 'raw-materials' && Array.isArray(data)) {
      mock.rawMaterials = data;
      clearStore('rawMaterials');
      return;
    }
    if (path === 'factory-materials' && Array.isArray(data)) {
      mock.factoryMaterials = data;
      clearStore('factoryMaterials');
      return;
    }
    if (path === 'customers' && Array.isArray(data)) {
      mock.customers = data;
      cache.customers = data;
      cache._customersLoaded = true;
      clearStore('customers');
      setSessionEntry('customers', data);
      return;
    }
    if (path === 'suppliers' && Array.isArray(data)) {
      mock.suppliers = data;
      cache.suppliers = data;
      cache._suppliersLoaded = true;
      clearStore('suppliers');
      setSessionEntry('suppliers', data);
      return;
    }
    if (path === 'sales' && Array.isArray(data)) {
      mock.sales = data;
      clearStore('sales');
      return;
    }
    if (path === 'purchases' && Array.isArray(data)) {
      mock.purchases = data;
      clearStore('purchases');
      return;
    }
    if (path === 'stock' && Array.isArray(data)) {
      mock.stock = data;
      clearStore('stock');
      setSessionEntry('stock', data);
      return;
    }
    if (path === 'stock/movements' && Array.isArray(data)) {
      mock.stockMovements = data;
      clearStore('stockMovements');
      return;
    }
    if (path === 'payments/customers' && Array.isArray(data)) {
      mock.customerPayments = data;
      clearStore('customerPayments');
      return;
    }
    if (path === 'payments/suppliers' && Array.isArray(data)) {
      mock.supplierPayments = data;
      clearStore('supplierPayments');
      return;
    }
    if (path === 'sales-returns' && Array.isArray(data)) {
      mock.returns = data;
      clearStore('returns');
      return;
    }
    if (path === 'damaged-stock' && Array.isArray(data)) {
      mock.damages = data;
      clearStore('damages');
      return;
    }
    if (path === 'workers' && Array.isArray(data)) {
      mock.workers = data;
      clearStore('workers');
      setSessionEntry('workers', data);
      return;
    }
    if (path === 'external-debts' && Array.isArray(data)) {
      mock.externalDebts = data;
      clearStore('externalDebts');
      return;
    }
    if (path === 'home-expenses' && Array.isArray(data)) {
      mock.homeExpenses = data;
      clearStore('homeExpenses');
    }
  }

  function rememberPayments(rows) {
    var mock = global.MBMS_MOCK = global.MBMS_MOCK || {};
    var payments = rows.map(mapWorkerPayment);
    mock.workerPayments = payments;
    mock.workerMonthlyReports = monthlyFrom(payments);
    clearStore('workerPayments');
    clearStore('workerMonthlyReports');
    setSessionEntry('workerPayments', payments);
    setSessionEntry('workerMonthlyReports', mock.workerMonthlyReports);
  }

  function redirectLogin() {
    if (global.MBMS_CONFIG && global.MBMS_CONFIG.clearAuthToken) {
      global.MBMS_CONFIG.clearAuthToken();
    }
    clearSessionCache();
    var target = (global.MBMS_NAV && global.MBMS_NAV.asset)
      ? global.MBMS_NAV.asset('pages/login.html')
      : 'pages/login.html';
    if (global.location.pathname.indexOf('login.html') === -1) {
      global.location.href = target;
    }
  }

  function send(planned, extraPayload) {
    return rawRequest(planned.method, planned.path, planned.options).then(function (response) {
      if (planned.options.also) {
        return rawRequest('GET', planned.options.also, { params: planned.options.params }).then(function (extra) {
          response.data = reportRows(planned.options.reportKind || planned.original, response.data, extra.data);
          return response;
        });
      }
      if (planned.options.reportKind) {
        response.data = reportRows(planned.options.reportKind, response.data, extraPayload);
        return response;
      }
      response.data = present(planned.original, planned.method, response.data);
      return response;
    }).then(function (response) {
      var keys = mutationInvalidationKeys(planned.original, planned.method);
      if (keys.length) {
        invalidateCaches(keys);
      }
      return response;
    }).catch(function (error) {
      if (error && error.status === 401 && String(planned.original).indexOf('login') === -1) {
        redirectLogin();
      }
      throw error;
    });
  }

  function ensureParty(name) {
    var existing = findNamed(cache.parties, name);
    if (existing) {
      return Promise.resolve(existing.id);
    }
    var loadParties = cache.parties && cache.parties.length
      ? Promise.resolve(cache.parties)
      : rawRequest('GET', 'external-parties', { params: { per_page: 100 } }).then(function (response) {
          cache.parties = rowsOf(response.data);
          setSessionEntry('parties', cache.parties);
          return cache.parties;
        });
    return loadParties.then(function () {
      var found = findNamed(cache.parties, name);
      if (found) {
        return found.id;
      }
      return rawRequest('POST', 'external-parties', { body: { name: name } }).then(function (response) {
        var party = inner(response.data);
        cache.parties.push(party);
        setSessionEntry('parties', cache.parties);
        return party.id;
      });
    });
  }

  global.MBMS_API.request = function (method, path, options) {
    var planned = plan(method, path, options);
    if (planned.createPartyName) {
      return ensureParty(planned.createPartyName).then(function (partyId) {
        planned.options.body.external_party_id = partyId;
        return send(planned);
      });
    }
    return send(planned);
  };

  global.MBMS_API.remember = remember;
  global.MBMS_API.rememberWorkerPayments = rememberPayments;
  global.MBMS_API.getCached = getCached;
  global.MBMS_API.invalidateCaches = invalidateCaches;
  global.MBMS_API.clearSessionCache = clearSessionCache;
  global.MBMS_API.stockAtLocation = stockAtLocation;
  global.MBMS_API.stockText = stockText;

  /**
   * Load locations once; reuse in-memory / session cache.
   * Safe to call from pages that need location selects — does not force auth/me.
   */
  global.MBMS_API.ensureLocations = function () {
    if (!global.MBMS_CONFIG || !global.MBMS_CONFIG.getAuthToken || !global.MBMS_CONFIG.getAuthToken()) {
      return Promise.resolve([]);
    }

    global.MBMS_MOCK = global.MBMS_MOCK || {};
    hydrateFromSession();

    var cachedLocations = getCached('locations');
    if (cachedLocations && cachedLocations.length) {
      return Promise.resolve(applyLocationRows(cachedLocations));
    }
    if (locationsPromise) {
      return locationsPromise;
    }

    locationsPromise = rawRequest('GET', 'locations', { params: { per_page: 100 } })
      .then(function (response) {
        var locationRows = rowsOf(response.data).map(function (row) {
          return { id: sid(row.id), name: row.name || '' };
        });
        setSessionEntry('locations', locationRows);
        return applyLocationRows(locationRows);
      })
      .catch(function (error) {
        locationsPromise = null;
        if (error && error.status === 401) {
          redirectLogin();
        }
        throw error;
      });

    return locationsPromise;
  };

  /**
   * Refresh auth/me only when local identity is missing or forced.
   * Token validity is still enforced by Sanctum on every API call (401 → login).
   */
  global.MBMS_API.ensureAuthMe = function (options) {
    options = options || {};
    if (!global.MBMS_CONFIG || !global.MBMS_CONFIG.getAuthToken || !global.MBMS_CONFIG.getAuthToken()) {
      return Promise.resolve(null);
    }
    if (!options.force && hasLocalAuthIdentity() && authMeAlreadyChecked()) {
      return Promise.resolve(null);
    }
    if (authMePromise) {
      return authMePromise;
    }

    authMePromise = rawRequest('GET', 'auth/me')
      .then(function (response) {
        present('auth/me', 'GET', response.data);
        markAuthMeOk();
        return response.data;
      })
      .catch(function (error) {
        authMePromise = null;
        if (error && error.status === 401) {
          redirectLogin();
        }
        throw error;
      });

    return authMePromise;
  };

  /**
   * Background shell warmup only. Must not race the current page's critical API.
   * app.js schedules this after page init via requestIdleCallback.
   *
   * options.page.prefetchLocations === false → skip locations (e.g. Dashboard).
   * auth/me skipped when token + user id already available this session.
   */
  global.MBMS_API.prefetch = function (options) {
    options = options || {};
    if (!global.MBMS_CONFIG || !global.MBMS_CONFIG.getAuthToken || !global.MBMS_CONFIG.getAuthToken()) {
      return Promise.resolve();
    }
    if (shellPrefetchPromise) {
      return shellPrefetchPromise;
    }

    global.MBMS_MOCK = global.MBMS_MOCK || {};
    hydrateFromSession();

    var page = options.page || global.MBMS_PAGE || {};
    var wantLocations = options.locations;
    if (wantLocations == null) {
      wantLocations = page.prefetchLocations !== false;
    }

    var tasks = [];

    if (options.forceAuthMe || !hasLocalAuthIdentity() || !authMeAlreadyChecked()) {
      tasks.push(
        global.MBMS_API.ensureAuthMe({ force: !!options.forceAuthMe }).catch(function () {
          return null;
        })
      );
    } else {
      markAuthMeOk();
    }

    if (wantLocations) {
      tasks.push(
        global.MBMS_API.ensureLocations().catch(function () {
          return [];
        })
      );
    }

    if (!tasks.length) {
      return Promise.resolve();
    }

    shellPrefetchPromise = Promise.all(tasks).then(function () {
      return true;
    }).catch(function (error) {
      shellPrefetchPromise = null;
      if (error && error.status === 401) {
        redirectLogin();
      }
    });

    return shellPrefetchPromise;
  };

  hydrateFromSession();
  if (hasLocalAuthIdentity()) {
    markAuthMeOk();
  }
})(window);
