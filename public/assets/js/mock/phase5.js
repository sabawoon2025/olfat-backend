/**
 * Phase 5 sample records. Display only.
 * No official payroll, stock, debt, or profit is calculated here.
 */
(function (global) {
  'use strict';

  global.MBMS_MOCK = global.MBMS_MOCK || {};

  global.MBMS_MOCK.rawBagSizes = [
    { id: '170kg', label: '170kg bag', kg: '170' },
    { id: '220kg', label: '220kg bag', kg: '220' }
  ];

  global.MBMS_MOCK.rawMaterials = [
    {
      id: 'rm-1',
      name: 'Sample raw material A',
      units: [{ id: '170kg', label: '170kg bag' }, { id: '220kg', label: '220kg bag' }],
      stock_display: '8 bags · 170kg',
      location: 'Kabul',
      notes: 'Raw-material stock. Separate from finished detergent stock.'
    },
    {
      id: 'rm-2',
      name: 'Sample raw material B',
      units: [{ id: '170kg', label: '170kg bag' }, { id: '220kg', label: '220kg bag' }],
      stock_display: '3 bags · 220kg',
      location: 'Kabul',
      notes: 'Raw-material stock. Separate from finished detergent stock.'
    }
  ];

  global.MBMS_MOCK.factoryMaterials = [
    { id: 'fm-cartons', name: 'Cartons', units: [{ id: 'piece', label: 'Piece' }, { id: 'other', label: 'Other configured unit' }] },
    { id: 'fm-labels', name: 'Labels', units: [{ id: 'piece', label: 'Piece' }, { id: 'roll', label: 'Roll' }] },
    { id: 'fm-tape', name: 'Tape', units: [{ id: 'roll', label: 'Roll' }, { id: 'other', label: 'Other configured unit' }] },
    { id: 'fm-other', name: 'Other factory material', units: [{ id: 'piece', label: 'Piece' }, { id: 'other', label: 'Other configured unit' }] }
  ];

  global.MBMS_MOCK.workers = [
    { id: 'w-1', name: 'Sample worker A', location: 'Kabul', notes: 'Tracks money received. Not a payroll record.' },
    { id: 'w-2', name: 'Sample worker B', location: 'Ghazni', notes: 'Tracks money received. Not a payroll record.' }
  ];

  global.MBMS_MOCK.workerPayments = [
    { id: 'wp-1', worker_id: 'w-1', worker: 'Sample worker A', amount: '200', date: '2026-09-05', description: 'Sample payment received', user: 'Signed-in user', location: 'Kabul' },
    { id: 'wp-2', worker_id: 'w-1', worker: 'Sample worker A', amount: '180', date: '2026-09-20', description: 'Sample payment received', user: 'Signed-in user', location: 'Kabul' },
    { id: 'wp-3', worker_id: 'w-2', worker: 'Sample worker B', amount: '150', date: '2026-09-12', description: 'Sample payment received', user: 'Signed-in user', location: 'Ghazni' }
  ];

  global.MBMS_MOCK.workerMonthlyReports = [
    { id: 'wmr-1', worker_id: 'w-1', worker: 'Sample worker A', month: '2026-09', dates: '2026-09-05; 2026-09-20', amounts: '200; 180', monthly_total_display: '380' },
    { id: 'wmr-2', worker_id: 'w-2', worker: 'Sample worker B', month: '2026-09', dates: '2026-09-12', amounts: '150', monthly_total_display: '150' }
  ];

  global.MBMS_MOCK.externalDebts = [
    {
      id: 'ed-1',
      person: 'Ahmad',
      direction: 'business_owes',
      reason: 'Sample amount the business owes this person',
      original_amount: '500',
      paid_received: '100',
      remaining_display: '400',
      date: '2026-09-01',
      user: 'Signed-in user',
      location: 'Kabul'
    },
    {
      id: 'ed-2',
      person: 'Karim',
      direction: 'person_owes',
      reason: 'Sample amount this person owes the business',
      original_amount: '300',
      paid_received: '50',
      remaining_display: '250',
      date: '2026-08-15',
      user: 'Signed-in user',
      location: 'Ghazni'
    }
  ];

  global.MBMS_MOCK.externalDebtPayments = [
    { id: 'edp-1', debt_id: 'ed-1', amount: '100', date: '2026-09-10', description: 'Partial payment to Ahmad', user: 'Signed-in user', location: 'Kabul' },
    { id: 'edp-2', debt_id: 'ed-2', amount: '50', date: '2026-09-02', description: 'Partial amount received from Karim', user: 'Signed-in user', location: 'Ghazni' }
  ];

  global.MBMS_MOCK.homeExpenseCategories = [
    { id: 'Food', label: 'Food' },
    { id: 'Household', label: 'Household' },
    { id: 'Personal', label: 'Personal' },
    { id: 'Transport', label: 'Transport' },
    { id: 'Medical', label: 'Medical' }
  ];

  global.MBMS_MOCK.homeExpenses = [
    { id: 'he-1', category: 'Food', description: 'Sample grocery purchase', amount: '45', date: '2026-09-18', user: 'Signed-in user' },
    { id: 'he-2', category: 'Household expenses', description: 'Sample household item', amount: '20', date: '2026-09-21', user: 'Signed-in user' }
  ];
})(window);
