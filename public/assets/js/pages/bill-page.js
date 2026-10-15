/**
 * Professional A4 sale invoice:
 *   • global branding from GET /api/v1/settings
 *   • per-branch overrides from sale.invoice_profile
 *   • print-ready A4 + client PDF download
 *   • WhatsApp share with PDF attachment when the device supports it
 */
(function (global) {
  'use strict';

  var currentSale = null;
  var pdfLibsPromise = null;

  var billSettings = {
    businessName: 'Business Name',
    tagline: 'Sales Invoice',
    logoUrl: '',
    addressLine1: '',
    addressLine2: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    taxId: '',
    invoicePrefix: 'INV',
    headerNote: '',
    footerNote: 'Thank you for your business. Please keep this bill for your records.',
    terms: 'Goods once sold are not refundable unless damaged on delivery. All disputes must be reported within 48 hours.',
    bankDetails: '',
    signatureCustomer: 'Customer signature',
    signatureAuthorized: 'Authorized signature',
    showWatermark: false,
    currencyCode: 'AFN',
    currencySymbol: '',
    currencyPosition: 'suffix'
  };

  var ONES = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen'
  ];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function saleIdFromQuery() {
    try {
      return new URLSearchParams(global.location.search).get('id') || '';
    } catch (err) {
      return '';
    }
  }

  function money(value) {
    var n = Number(value);
    if (value == null || value === '' || isNaN(n)) {
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
      return '0.00';
    }
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function withCurrency(value) {
    var amount = money(value);
    var token = billSettings.currencySymbol || billSettings.currencyCode || '';
    if (!token) {
      return amount;
    }
    return billSettings.currencyPosition === 'prefix'
      ? (token + ' ' + amount)
      : (amount + ' ' + token);
  }

  function textOrFallback(primary, fallback) {
    var value = (primary == null ? '' : String(primary)).trim();
    return value || fallback || '';
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = value == null ? '' : String(value);
    }
  }

  function showError(message) {
    var box = document.getElementById('bill-error');
    var root = document.getElementById('bill-root');
    if (root) {
      root.hidden = true;
    }
    if (box) {
      box.hidden = !message;
      box.textContent = message || '';
    }
  }

  function defaultLogoUrl() {
    if (global.MBMS_NAV && typeof global.MBMS_NAV.asset === 'function') {
      return global.MBMS_NAV.asset('assets/images/logo.svg');
    }
    return '../assets/images/logo.svg';
  }

  function resolveLogoUrl(url) {
    var value = textOrFallback(url, '');
    if (!value) {
      return defaultLogoUrl();
    }
    if (/^https?:\/\//i.test(value) || value.indexOf('data:') === 0) {
      return value;
    }
    if (value.charAt(0) === '/') {
      return global.location.origin + value;
    }
    if (value.indexOf('assets/') === 0 && global.MBMS_NAV && typeof global.MBMS_NAV.asset === 'function') {
      return global.MBMS_NAV.asset(value);
    }
    return value;
  }

  function twoDigits(n) {
    if (n < 20) {
      return ONES[n];
    }
    var t = Math.floor(n / 10);
    var o = n % 10;
    return TENS[t] + (o ? '-' + ONES[o] : '');
  }

  function chunkToWords(n) {
    var words = [];
    var hundreds = Math.floor(n / 100);
    var rest = n % 100;
    if (hundreds) {
      words.push(ONES[hundreds] + ' hundred');
    }
    if (rest) {
      words.push(twoDigits(rest));
    }
    return words.join(' ');
  }

  function amountInWords(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) {
      return '—';
    }
    var negative = n < 0;
    n = Math.abs(n);
    var whole = Math.floor(n + 1e-9);
    var cents = Math.round((n - whole) * 100);
    if (whole === 0 && cents === 0) {
      return 'Zero only';
    }

    var parts = [];
    var billions = Math.floor(whole / 1000000000);
    var millions = Math.floor((whole % 1000000000) / 1000000);
    var thousands = Math.floor((whole % 1000000) / 1000);
    var remainder = whole % 1000;

    if (billions) {
      parts.push(chunkToWords(billions) + ' billion');
    }
    if (millions) {
      parts.push(chunkToWords(millions) + ' million');
    }
    if (thousands) {
      parts.push(chunkToWords(thousands) + ' thousand');
    }
    if (remainder || !parts.length) {
      parts.push(chunkToWords(remainder) || 'zero');
    }

    var currency = billSettings.currencyCode || 'AFN';
    var text = parts.join(' ') + ' ' + currency;
    if (cents > 0) {
      text += ' and ' + twoDigits(cents) + ' cents';
    }
    text += ' only';
    if (negative) {
      text = 'Minus ' + text;
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function invoiceNumber(sale) {
    var ref = textOrFallback(sale.reference_no, '');
    if (ref) {
      return ref;
    }

    var prefix = textOrFallback(billSettings.invoicePrefix, 'INV').replace(/[^A-Za-z0-9]+/g, '').toUpperCase() || 'INV';
    var year = '';
    if (sale.date) {
      year = String(sale.date).slice(0, 4);
    } else if (sale.sold_at) {
      year = String(sale.sold_at).slice(0, 4);
    }
    if (!/^\d{4}$/.test(year)) {
      year = String(new Date().getFullYear());
    }
    var sequence = String(sale.id || 0);
    while (sequence.length < 4) {
      sequence = '0' + sequence;
    }
    return prefix + '-' + year + '-' + sequence;
  }

  function paymentLabel(sale, status) {
    var type = String(sale.payment_type || '').toLowerCase();
    if (type === 'cash') {
      return 'Cash';
    }
    if (type === 'credit') {
      return 'Credit';
    }
    if (type === 'mixed' || type === 'partial') {
      return 'Partial / Mixed';
    }
    return status.label;
  }

  function paymentStatus(sale) {
    var remaining = Number(sale.remaining_raw != null ? sale.remaining_raw : sale.remaining || 0);
    var paid = Number(sale.paid_raw != null ? sale.paid_raw : sale.paid || 0);
    if (remaining <= 0.0001) {
      return { label: 'Paid', className: 'is-paid' };
    }
    if (paid <= 0.0001) {
      return { label: 'Unpaid', className: 'is-credit' };
    }
    return { label: 'Partial', className: 'is-mixed' };
  }

  function applyLocationProfile(profile) {
    if (!profile || typeof profile !== 'object') {
      return;
    }
    billSettings.businessName = textOrFallback(profile.legal_name, billSettings.businessName);
    billSettings.tagline = textOrFallback(profile.tagline, billSettings.tagline);
    billSettings.logoUrl = textOrFallback(profile.logo_url, billSettings.logoUrl);
    billSettings.addressLine1 = textOrFallback(profile.address_line1, billSettings.addressLine1);
    billSettings.addressLine2 = textOrFallback(profile.address_line2, billSettings.addressLine2);
    billSettings.phone = textOrFallback(profile.phone, billSettings.phone);
    billSettings.whatsapp = textOrFallback(profile.whatsapp, billSettings.whatsapp);
    billSettings.email = textOrFallback(profile.email, billSettings.email);
    billSettings.website = textOrFallback(profile.website, billSettings.website);
    billSettings.taxId = textOrFallback(profile.tax_id, billSettings.taxId);
    billSettings.headerNote = textOrFallback(profile.header_note, billSettings.headerNote);
    billSettings.footerNote = textOrFallback(profile.footer_note, billSettings.footerNote);
    billSettings.terms = textOrFallback(profile.terms, billSettings.terms);
    billSettings.bankDetails = textOrFallback(profile.bank_details, billSettings.bankDetails);
    billSettings.signatureCustomer = textOrFallback(
      profile.signature_customer_label,
      billSettings.signatureCustomer
    );
    billSettings.signatureAuthorized = textOrFallback(
      profile.signature_authorized_label,
      billSettings.signatureAuthorized
    );
  }

  function loadSettings() {
    if (!global.MBMS_API || typeof global.MBMS_API.get !== 'function') {
      return Promise.resolve();
    }

    return global.MBMS_API.get('settings').then(function (response) {
      var rows = global.MBMS_UTILS.unwrap(response.data) || response.data || [];
      if (!Array.isArray(rows) && rows && Array.isArray(rows.data)) {
        rows = rows.data;
      }
      if (!Array.isArray(rows)) {
        return;
      }

      var map = {};
      rows.forEach(function (row) {
        if (row && row.key != null) {
          map[row.key] = row.value;
        }
      });

      billSettings.businessName = textOrFallback(
        map['business.legal_name'],
        textOrFallback(map['app.name'], billSettings.businessName)
      );
      billSettings.tagline = textOrFallback(map['business.tagline'], billSettings.tagline);
      billSettings.logoUrl = textOrFallback(map['business.logo_url'], '');
      billSettings.addressLine1 = textOrFallback(
        map['business.address_line1'],
        textOrFallback(map['bill.address'], '')
      );
      billSettings.addressLine2 = textOrFallback(map['business.address_line2'], '');
      billSettings.phone = textOrFallback(
        map['business.phone'],
        textOrFallback(map['bill.phone'], '')
      );
      billSettings.whatsapp = textOrFallback(map['business.whatsapp'], '');
      billSettings.email = textOrFallback(map['business.email'], '');
      billSettings.website = textOrFallback(map['business.website'], '');
      billSettings.taxId = textOrFallback(map['business.tax_id'], '');
      billSettings.invoicePrefix = textOrFallback(map['invoice.prefix'], billSettings.invoicePrefix);
      billSettings.headerNote = textOrFallback(map['invoice.header_note'], '');
      billSettings.footerNote = textOrFallback(
        map['invoice.footer_note'],
        textOrFallback(map['bill.footer_note'], billSettings.footerNote)
      );
      billSettings.terms = textOrFallback(map['invoice.terms'], billSettings.terms);
      billSettings.bankDetails = textOrFallback(map['invoice.bank_details'], '');
      billSettings.signatureCustomer = textOrFallback(
        map['invoice.signature_customer_label'],
        billSettings.signatureCustomer
      );
      billSettings.signatureAuthorized = textOrFallback(
        map['invoice.signature_authorized_label'],
        billSettings.signatureAuthorized
      );
      /* Watermark intentionally disabled for a clean professional invoice. */
      billSettings.showWatermark = false;
      billSettings.currencyCode = textOrFallback(map['app.currency_code'], billSettings.currencyCode);
      billSettings.currencySymbol = textOrFallback(map['app.currency_symbol'], billSettings.currencySymbol);
      billSettings.currencyPosition = textOrFallback(map['app.currency_position'], billSettings.currencyPosition);
    }).catch(function () {
      /* defaults remain */
    });
  }

  function renderContactList() {
    var list = document.getElementById('bill-contact-list');
    if (!list) {
      return;
    }
    var rows = [];
    if (billSettings.phone) {
      rows.push({ label: 'Tel', value: billSettings.phone });
    }
    if (billSettings.whatsapp) {
      rows.push({ label: 'WhatsApp', value: billSettings.whatsapp });
    }
    if (billSettings.email) {
      rows.push({ label: 'Email', value: billSettings.email });
    }
    if (billSettings.website) {
      rows.push({ label: 'Web', value: billSettings.website });
    }
    if (!rows.length) {
      list.hidden = true;
      list.innerHTML = '';
      return;
    }
    list.hidden = false;
    list.innerHTML = rows.map(function (row) {
      return '<span class="bill-contact-item"><span class="label">' +
        global.MBMS_UTILS.escapeHtml(row.label) + ':</span>' +
        global.MBMS_UTILS.escapeHtml(row.value) + '</span>';
    }).join('');
  }

  function renderHeader(sale, status) {
    var logo = document.getElementById('bill-logo');
    var fallback = document.getElementById('bill-logo-fallback');
    var logoUrl = resolveLogoUrl(billSettings.logoUrl);
    if (logo) {
      logo.hidden = false;
      logo.onerror = function () {
        logo.hidden = true;
        if (fallback) {
          fallback.hidden = false;
          var initials = (billSettings.businessName || 'MB')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .join('');
          fallback.textContent = initials || 'MB';
        }
      };
      logo.onload = function () {
        if (fallback) {
          fallback.hidden = true;
        }
        logo.hidden = false;
      };
      logo.src = logoUrl;
      logo.alt = billSettings.businessName || 'Business logo';
    }

    setText('bill-business-name', billSettings.businessName);
    setText('bill-business-tag', billSettings.tagline || 'Sales Invoice');

    var addressLines = [billSettings.addressLine1, billSettings.addressLine2]
      .filter(function (line) { return !!line; });
    setText('bill-business-address', addressLines.join('\n'));
    renderContactList();

    var taxEl = document.getElementById('bill-business-tax');
    if (taxEl) {
      if (billSettings.taxId) {
        taxEl.textContent = 'Tax / Reg: ' + billSettings.taxId;
        taxEl.hidden = false;
      } else {
        taxEl.hidden = true;
      }
    }

    setText('bill-number', invoiceNumber(sale));
    setText('bill-date', sale.date || '—');
    setText('bill-province', sale.location || '—');
    setText('bill-currency', billSettings.currencySymbol
      ? (billSettings.currencyCode + ' (' + billSettings.currencySymbol + ')')
      : (billSettings.currencyCode || '—'));

    var statusEl = document.getElementById('bill-status');
    if (statusEl) {
      statusEl.textContent = status.label;
      statusEl.className = 'bill-status ' + (status.className || '');
    }

    var headerNote = document.getElementById('bill-header-note');
    if (headerNote) {
      if (billSettings.headerNote) {
        headerNote.textContent = billSettings.headerNote;
        headerNote.hidden = false;
      } else {
        headerNote.hidden = true;
      }
    }
  }

  function renderParties(sale, status) {
    setText('bill-customer-name', sale.customer || 'Walk-in customer');
    setText('bill-customer-phone', sale.customer_phone || '—');
    setText('bill-customer-address', sale.customer_address || '—');
    setText('bill-seller-name', sale.seller || billSettings.businessName || 'Staff');
    setText('bill-payment-type', paymentLabel(sale, status));
  }

  function normalizeItems(sale) {
    var items = sale.items || [];
    if (items.length) {
      return items;
    }
    if (sale.product || sale.variant || sale.quantity) {
      return [{
        product: sale.product,
        variant: sale.variant,
        unit: '',
        quantity: sale.quantity,
        quantity_raw: sale.quantity,
        unit_price: sale.price,
        unit_price_raw: sale.price_raw != null ? sale.price_raw : sale.price,
        line_total: sale.total,
        line_total_raw: sale.total_raw != null ? sale.total_raw : sale.total
      }];
    }
    return [];
  }

  function renderItems(sale) {
    var body = document.getElementById('bill-items-body');
    if (!body) {
      return;
    }
    var items = normalizeItems(sale);
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="5" class="text-secondary">No line items on this sale.</td></tr>';
      return;
    }

    body.innerHTML = items.map(function (line, index) {
      var product = line.product || '';
      var variant = line.variant || '';
      var title = product || variant || 'Item';
      var sub = product && variant ? variant : '';
      var qtyRaw = line.quantity_raw != null ? line.quantity_raw : line.quantity;
      var qty = (qtyRaw == null ? '' : qtyRaw) + (line.unit ? (' ' + line.unit) : '');
      var unitPrice = line.unit_price_raw != null ? line.unit_price_raw : line.unit_price;
      var lineTotal = line.line_total_raw != null
        ? line.line_total_raw
        : (line.line_total != null
          ? line.line_total
          : (Number(qtyRaw || 0) * Number(unitPrice || 0)));
      return (
        '<tr>' +
        '<td class="bill-col-num">' + (index + 1) + '</td>' +
        '<td class="bill-col-item"><span class="bill-item-title">' +
        global.MBMS_UTILS.escapeHtml(title) + '</span>' +
        (sub ? '<span class="bill-item-sub">' + global.MBMS_UTILS.escapeHtml(sub) + '</span>' : '') +
        '</td>' +
        '<td class="bill-col-qty num">' + global.MBMS_UTILS.escapeHtml(String(qty)) + '</td>' +
        '<td class="bill-col-price num">' + global.MBMS_UTILS.escapeHtml(withCurrency(unitPrice)) + '</td>' +
        '<td class="bill-col-total num">' + global.MBMS_UTILS.escapeHtml(withCurrency(lineTotal)) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderTotals(sale) {
    var total = sale.total_raw != null ? sale.total_raw : sale.total;
    var paid = sale.paid_raw != null ? sale.paid_raw : sale.paid;
    var remaining = sale.remaining_raw != null ? sale.remaining_raw : sale.remaining;
    setText('bill-subtotal', withCurrency(total));
    setText('bill-paid', withCurrency(paid));
    setText('bill-remaining', withCurrency(remaining));
    setText('bill-total', withCurrency(total));
    setText('bill-amount-words', amountInWords(total));
  }

  function renderNotes(sale) {
    var notesWrap = document.getElementById('bill-notes-wrap');
    if (!notesWrap) {
      return;
    }
    if (sale.notes) {
      notesWrap.hidden = false;
      setText('bill-notes', sale.notes);
    } else {
      notesWrap.hidden = true;
    }
  }

  function renderSignatures() {
    setText('bill-sign-customer', billSettings.signatureCustomer);
    setText('bill-sign-authorized', billSettings.signatureAuthorized);
  }

  function renderFooter(sale) {
    var termsWrap = document.getElementById('bill-footer-terms-wrap');
    if (termsWrap) {
      if (billSettings.terms) {
        termsWrap.hidden = false;
        setText('bill-footer-terms', billSettings.terms);
      } else {
        termsWrap.hidden = true;
      }
    }

    var bankWrap = document.getElementById('bill-footer-bank-wrap');
    if (bankWrap) {
      if (billSettings.bankDetails) {
        bankWrap.hidden = false;
        setText('bill-footer-bank', billSettings.bankDetails);
      } else {
        bankWrap.hidden = true;
      }
    }

    setText('bill-footer-note', billSettings.footerNote || 'Thank you for your business.');

    var metaBits = [billSettings.businessName];
    if (sale.location) {
      metaBits.push(sale.location);
    }
    metaBits.push(invoiceNumber(sale));
    metaBits.push('Computer generated invoice');
    setText('bill-footer-meta', metaBits.join(' · '));
  }

  function renderSale(sale) {
    currentSale = sale;
    var root = document.getElementById('bill-root');
    var error = document.getElementById('bill-error');
    if (error) {
      error.hidden = true;
    }
    if (root) {
      root.hidden = false;
    }

    applyLocationProfile(sale.invoice_profile || {});

    var status = paymentStatus(sale);
    var number = invoiceNumber(sale);
    document.title = number + ' · Invoice';
    setText('bill-toolbar-title', number);

    renderHeader(sale, status);
    renderParties(sale, status);
    renderItems(sale);
    renderTotals(sale);
    renderNotes(sale);
    renderSignatures();
    renderFooter(sale);
  }

  function whatsAppText(sale) {
    var lines = [];
    lines.push('*' + billSettings.businessName + '*');
    if (sale.location) {
      lines.push(sale.location + ' branch');
    }
    lines.push('Invoice: ' + invoiceNumber(sale));
    lines.push('Date: ' + (sale.date || ''));
    lines.push('Customer: ' + (sale.customer || ''));
    lines.push('');
    normalizeItems(sale).forEach(function (line, index) {
      var label = [line.product, line.variant].filter(Boolean).join(' · ') || 'Item';
      var qtyRaw = line.quantity_raw != null ? line.quantity_raw : line.quantity;
      var unitPrice = line.unit_price_raw != null ? line.unit_price_raw : line.unit_price;
      lines.push(
        (index + 1) + '. ' + label + ' — ' + qtyRaw + (line.unit ? (' ' + line.unit) : '') +
        ' × ' + withCurrency(unitPrice)
      );
    });
    lines.push('');
    var total = sale.total_raw != null ? sale.total_raw : sale.total;
    var paid = sale.paid_raw != null ? sale.paid_raw : sale.paid;
    var remaining = sale.remaining_raw != null ? sale.remaining_raw : sale.remaining;
    lines.push('Total: ' + withCurrency(total));
    lines.push('Paid: ' + withCurrency(paid));
    lines.push('Balance: ' + withCurrency(remaining));
    if (billSettings.whatsapp || billSettings.phone) {
      lines.push('');
      lines.push('Contact: ' + (billSettings.whatsapp || billSettings.phone));
    }
    lines.push('');
    lines.push('_PDF invoice attached / downloaded_');
    return lines.join('\n');
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-bill-pdf="' + src + '"]');
      if (existing) {
        resolve();
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.billPdf = src;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(script);
    });
  }

  function ensurePdfLibs() {
    if (global.html2canvas && global.jspdf && global.jspdf.jsPDF) {
      return Promise.resolve();
    }
    if (pdfLibsPromise) {
      return pdfLibsPromise;
    }
    pdfLibsPromise = loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
      .then(function () {
        return loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
      })
      .catch(function (error) {
        pdfLibsPromise = null;
        throw error;
      });
    return pdfLibsPromise;
  }

  function invoiceFileName(sale) {
    var number = invoiceNumber(sale).replace(/[^\w.-]+/g, '_');
    return number + '.pdf';
  }

  function buildPdfBlob(sale) {
    var paper = document.getElementById('bill-paper');
    if (!paper) {
      return Promise.reject({ message: 'Invoice paper is not ready.' });
    }

    return ensurePdfLibs().then(function () {
      return global.html2canvas(paper, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
    }).then(function (canvas) {
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var JsPDF = global.jspdf.jsPDF;
      var pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var pageWidth = pdf.internal.pageSize.getWidth();
      var pageHeight = pdf.internal.pageSize.getHeight();
      var imgWidth = pageWidth;
      var imgHeight = (canvas.height * imgWidth) / canvas.width;
      var heightLeft = imgHeight;
      var position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 2) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      return pdf.output('blob');
    });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function openWhatsAppChat(sale, text) {
    var encoded = encodeURIComponent(text);
    var phone = String(sale.customer_phone || '').replace(/[^\d]/g, '');
    var url = phone
      ? ('https://wa.me/' + phone + '?text=' + encoded)
      : ('https://wa.me/?text=' + encoded);
    global.open(url, '_blank', 'noopener');
  }

  function downloadPdf() {
    if (!currentSale) {
      return Promise.resolve();
    }
    var btn = document.getElementById('bill-download-pdf');
    if (btn && global.MBMS_UI) {
      global.MBMS_UI.setButtonLoading(btn, true);
    }
    return buildPdfBlob(currentSale).then(function (blob) {
      downloadBlob(blob, invoiceFileName(currentSale));
      if (global.MBMS_UI) {
        global.MBMS_UI.notify({ type: 'success', message: 'Invoice PDF downloaded.' });
      }
    }).catch(function (error) {
      if (global.MBMS_UI) {
        global.MBMS_UI.notify({
          type: 'danger',
          title: 'PDF failed',
          message: global.MBMS_UTILS.getErrorMessage(error, 'Could not generate the invoice PDF.')
        });
      }
    }).finally(function () {
      if (btn && global.MBMS_UI) {
        global.MBMS_UI.setButtonLoading(btn, false);
      }
    });
  }

  function shareWhatsAppPdf() {
    if (!currentSale) {
      return;
    }
    var btn = document.getElementById('bill-whatsapp');
    if (btn && global.MBMS_UI) {
      global.MBMS_UI.setButtonLoading(btn, true);
    }

    var caption = whatsAppText(currentSale);
    var fileName = invoiceFileName(currentSale);

    buildPdfBlob(currentSale).then(function (blob) {
      var file = new File([blob], fileName, { type: 'application/pdf' });
      var canShareFiles = typeof navigator !== 'undefined'
        && typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [file] });

      if (canShareFiles) {
        return navigator.share({
          files: [file],
          title: invoiceNumber(currentSale),
          text: caption
        }).then(function () {
          if (global.MBMS_UI) {
            global.MBMS_UI.notify({ type: 'success', message: 'Invoice shared. Choose WhatsApp if prompted.' });
          }
        });
      }

      downloadBlob(blob, fileName);
      openWhatsAppChat(currentSale, caption);
      if (global.MBMS_UI) {
        global.MBMS_UI.notify({
          type: 'success',
          title: 'PDF ready for WhatsApp',
          message: 'Invoice PDF downloaded. Attach ' + fileName + ' in the WhatsApp chat that just opened.'
        });
      }
    }).catch(function (error) {
      openWhatsAppChat(currentSale, caption);
      if (global.MBMS_UI) {
        global.MBMS_UI.notify({
          type: 'warning',
          title: 'Opened WhatsApp without PDF',
          message: global.MBMS_UTILS.getErrorMessage(error, 'PDF could not be generated. A text summary was shared instead.')
        });
      }
    }).finally(function () {
      if (btn && global.MBMS_UI) {
        global.MBMS_UI.setButtonLoading(btn, false);
      }
    });
  }

  function loadBill() {
    var id = saleIdFromQuery();
    if (!id) {
      showError('Missing sale id. Open an invoice from the Sales page.');
      return Promise.resolve();
    }
    if (!global.MBMS_CONFIG || !global.MBMS_CONFIG.getAuthToken || !global.MBMS_CONFIG.getAuthToken()) {
      global.location.href = (global.MBMS_NAV && global.MBMS_NAV.asset)
        ? global.MBMS_NAV.asset('pages/login.html')
        : 'login.html';
      return Promise.resolve();
    }

    return loadSettings().then(function () {
      return global.MBMS_API.get('sales/' + id);
    }).then(function (response) {
      var sale = global.MBMS_UTILS.unwrap(response.data) || response.data || {};
      if (!sale.id) {
        throw { message: 'Sale invoice was not found.' };
      }
      renderSale(sale);
    }).catch(function (error) {
      showError(global.MBMS_UTILS.getErrorMessage(error, 'Unable to load this sale invoice.'));
    });
  }

  global.MBMS_PAGE = {
    title: 'Sale Invoice',
    prefetchLocations: false,
    onReady: function () {
      var printBtn = document.getElementById('bill-print');
      var pdfBtn = document.getElementById('bill-download-pdf');
      var waBtn = document.getElementById('bill-whatsapp');
      if (printBtn) {
        printBtn.addEventListener('click', function () {
          global.print();
        });
      }
      if (pdfBtn) {
        pdfBtn.addEventListener('click', downloadPdf);
      }
      if (waBtn) {
        waBtn.addEventListener('click', shareWhatsAppPdf);
      }
      loadBill();
    }
  };
})(window);
