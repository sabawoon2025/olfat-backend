/**
 * Shared product/variant lookups for transaction forms.
 * Values come from mock or later Laravel catalog APIs.
 */
(function (global) {
  'use strict';

  function mock() {
    return global.MBMS_MOCK || {};
  }

  function saleCategories() {
    return [
      { id: 'tea', label: 'Tea' },
      { id: 'rice', label: 'Rice' },
      { id: 'detergents', label: 'Detergents' }
    ];
  }

  function purchaseCategories() {
    return saleCategories().concat([
      { id: 'raw-materials', label: 'Raw Materials' },
      { id: 'factory-materials', label: 'Factory Materials' }
    ]);
  }

  function onlyActive(rows) {
    return (rows || []).filter(function (row) {
      return row.is_active !== false && row.is_active !== 0 && row.is_active !== '0';
    });
  }

  function products(category) {
    var data = mock();
    if (category === 'tea') {
      return onlyActive((data.tea && data.tea.types) || []);
    }
    if (category === 'rice') {
      return onlyActive((data.rice && data.rice.types) || []);
    }
    if (category === 'detergents') {
      return onlyActive((data.detergents && data.detergents.products) || []);
    }
    if (category === 'raw-materials') {
      return onlyActive((data.rawMaterials || []).concat(global.MBMS_RECORDS ? global.MBMS_RECORDS.storeList('rawMaterials') : []));
    }
    if (category === 'factory-materials') {
      return onlyActive((data.factoryMaterials || []).concat(global.MBMS_RECORDS ? global.MBMS_RECORDS.storeList('factoryMaterials') : []));
    }
    return [];
  }

  function variants(category, productId) {
    if (!productId) {
      return [];
    }
    var product = products(category).filter(function (row) {
      return String(row.id) === String(productId);
    })[0];
    if (product && product.units && product.units.length) {
      return product.units;
    }
    if (category === 'tea' || category === 'rice') {
      var catalog = mock()[category] || {};
      var fromCatalog = (catalog.variants || []).filter(function (row) {
        return String(row.type_id) === String(productId) || String(row.product_id) === String(productId);
      });
      if (fromCatalog.length) {
        return fromCatalog.map(function (row) {
          return { id: row.id, label: row.label || row.size_id || row.unit_id };
        });
      }
    }
    if (category === 'detergents' || category === 'raw-materials' || category === 'factory-materials') {
      return (product && product.units) || [];
    }
    return [];
  }

  function customers() {
    return (mock().customers || []).concat(global.MBMS_RECORDS ? global.MBMS_RECORDS.storeList('customers') : []);
  }

  function suppliers() {
    return (mock().suppliers || []).concat(global.MBMS_RECORDS ? global.MBMS_RECORDS.storeList('suppliers') : []);
  }

  global.MBMS_CATALOG = {
    saleCategories: saleCategories,
    purchaseCategories: purchaseCategories,
    products: products,
    variants: variants,
    customers: customers,
    suppliers: suppliers
  };
})(window);
