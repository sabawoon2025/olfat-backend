/**
 * Navigation catalog for Phase 2.
 * Grouping is for UI only. It does not define business rules.
 */
(function (global) {
  'use strict';

  function asset(path) {
    var base = global.MBMS_BASE_PATH || '.';
    return String(base).replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '');
  }

  function groups() {
    return [
      {
        id: 'overview',
        label: 'Overview',
        items: [{ id: 'dashboard', label: 'Dashboard', href: asset('index.html'), icon: 'home' }]
      },
      {
        id: 'catalog',
        label: 'Catalog',
        items: [
          { id: 'tea', label: 'Tea', href: asset('pages/tea.html'), icon: 'leaf' },
          { id: 'rice', label: 'Rice', href: asset('pages/rice.html'), icon: 'bag' },
          { id: 'detergents', label: 'Detergents', href: asset('pages/detergents.html'), icon: 'box' }
        ]
      },
      {
        id: 'operations',
        label: 'Operations',
        items: [
          { id: 'sales', label: 'Sales', href: asset('pages/sales.html'), icon: 'cart' },
          { id: 'purchases', label: 'Purchases', href: asset('pages/purchases.html'), icon: 'truck' },
          { id: 'stock', label: 'Stock', href: asset('pages/stock.html'), icon: 'layers' },
          { id: 'returns', label: 'Returns', href: asset('pages/returns.html'), icon: 'arrow-repeat' },
          { id: 'damaged-stock', label: 'Damaged Stock', href: asset('pages/damaged-stock.html'), icon: 'alert' }
        ]
      },
      {
        id: 'people',
        label: 'People',
        items: [
          { id: 'customers', label: 'Customers', href: asset('pages/customers.html'), icon: 'users' },
          { id: 'suppliers', label: 'Suppliers', href: asset('pages/suppliers.html'), icon: 'building' },
          { id: 'workers', label: 'Workers', href: asset('pages/workers.html'), icon: 'user' }
        ]
      },
      {
        id: 'finance',
        label: 'Finance',
        items: [
          { id: 'payments', label: 'Payments', href: asset('pages/payments.html'), icon: 'card' },
          { id: 'external-debts', label: 'External Debts', href: asset('pages/external-debts.html'), icon: 'scale' },
          { id: 'home-expenses', label: 'Home Expenses', href: asset('pages/home-expenses.html'), icon: 'home' },
          { id: 'profit-loss', label: 'Profit & Loss', href: asset('pages/profit-loss.html'), icon: 'chart' }
        ]
      },
      {
        id: 'materials',
        label: 'Materials',
        items: [
          { id: 'raw-materials', label: 'Raw Materials', href: asset('pages/raw-materials.html'), icon: 'box' },
          { id: 'factory-materials', label: 'Factory Materials', href: asset('pages/factory-materials.html'), icon: 'factory' }
        ]
      },
      {
        id: 'system',
        label: 'System',
        items: [
          { id: 'reports', label: 'Reports', href: asset('pages/reports.html'), icon: 'file' },
          { id: 'settings', label: 'Settings', href: asset('pages/settings.html'), icon: 'settings' }
        ]
      }
    ];
  }

  function allItems() {
    return groups().reduce(function (list, group) {
      return list.concat(group.items);
    }, []);
  }

  function findItem(id) {
    return allItems().filter(function (item) {
      return item.id === id;
    })[0] || null;
  }

  var mobilePrimaryIds = ['dashboard', 'sales', 'stock', 'payments'];

  function mobilePrimary(activeId) {
    return mobilePrimaryIds.map(function (id) {
      var item = findItem(id);
      return item ? Object.assign({ isPrimary: true }, item) : null;
    }).filter(Boolean).concat([
      { id: 'more', label: 'More', type: 'more', icon: 'more', isActiveMore: mobilePrimaryIds.indexOf(activeId) === -1 }
    ]);
  }

  global.MBMS_NAV = {
    asset: asset,
    groups: groups,
    allItems: allItems,
    findItem: findItem,
    mobilePrimary: mobilePrimary,
    mobilePrimaryIds: mobilePrimaryIds
  };
})(window);
