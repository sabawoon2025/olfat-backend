/**
 * English / Persian UI language. The choice is stored on this device
 * and applied to the whole staff system.
 */
(function (global) {
  'use strict';

  var KEY = 'MBMS_LANG';
  var FA = {
    'Mobile Business Management System': 'سیستم مدیریت کسب‌وکار موبایل',
    'Skip to content': 'رفتن به محتوا',
    'Open menu': 'باز کردن فهرست',
    'Search modules': 'جستجوی بخش‌ها',
    'Sign out': 'خروج',
    'Sign in': 'ورود',
    'Sign in to continue': 'برای ادامه وارد شوید',
    'Sign in to your account': 'به حساب خود وارد شوید',
    'Welcome back': 'خوش آمدید',
    'Sign in · MBMS': 'ورود · MBMS',
    'Menu': 'فهرست',
    'More': 'بیشتر',
    'Close': 'بستن',
    'Primary': 'اصلی',
    'Mobile': 'موبایل',
    'Overview': 'نمای کلی',
    'Catalog': 'کاتالوگ',
    'Operations': 'عملیات',
    'People': 'افراد',
    'Finance': 'مالی',
    'Materials': 'مواد',
    'System': 'سیستم',
    'Dashboard': 'داشبورد',
    'Tea': 'چای',
    'Rice': 'برنج',
    'Detergents': 'مواد شوینده',
    'Sales': 'فروش',
    'Purchases': 'خرید',
    'Stock': 'موجودی',
    'Returns': 'برگشتی‌ها',
    'Damaged Stock': 'اجناس آسیب‌دیده',
    'Customers': 'مشتریان',
    'Suppliers': 'تأمین‌کنندگان',
    'Workers': 'کارگران',
    'Payments': 'پرداخت‌ها',
    'External Debts': 'قرض‌های بیرونی',
    'Home Expenses': 'مصارف خانه',
    'Profit & Loss': 'سود و زیان',
    'Profit/Loss': 'سود و زیان',
    'Raw Materials': 'مواد خام',
    'Factory Materials': 'مواد فابریکه',
    'Reports': 'گزارش‌ها',
    'Settings': 'تنظیمات',
    'Refresh': 'تازه‌سازی',
    'New sale': 'فروش جدید',
    'New purchase': 'خرید جدید',
    'Record payment': 'ثبت پرداخت',
    'Open reports': 'باز کردن گزارش‌ها',
    'Today’s business overview. Numbers shown here come from Laravel, not from this screen.': 'نمای امروز کسب‌وکار. عددهای این صفحه از سرور می‌آید، نه از خود این صفحه.',
    "Today's business overview. Numbers shown here come from Laravel, not from this screen.": 'نمای امروز کسب‌وکار. عددهای این صفحه از سرور می‌آید، نه از خود این صفحه.',
    "Today's Sales": 'فروش امروز',
    "Today's Purchases": 'خرید امروز',
    'Current Stock': 'موجودی فعلی',
    'Customer Receivables': 'طلب از مشتریان',
    'Supplier Payables': 'بدهی به تأمین‌کنندگان',
    'Worker Payments': 'پرداخت به کارگران',
    'Recent Transactions': 'معاملات اخیر',
    'Stock Warnings': 'هشدار موجودی',
    'When': 'زمان',
    'Type': 'نوع',
    'Detail': 'جزئیات',
    'Amount': 'مبلغ',
    'Item': 'جنس',
    'Message': 'پیام',
    'None right now.': 'فعلاً موردی نیست.',
    'Not available yet': 'هنوز آماده نیست',
    'Sample data': 'داده نمونه',
    'Email or username': 'ایمیل یا نام کاربری',
    'Province': 'ولایت',
    'Select province': 'ولایت را انتخاب کنید',
    'Select email': 'ایمیل را انتخاب کنید',
    'Choose your province, then your email. Each province can be used by only one user. All users still see the same shared activity.': 'ابتدا ولایت، سپس ایمیل خود را انتخاب کنید. هر ولایت فقط برای یک کاربر است. هر سه کاربر فعالیت مشترک را می‌بینند.',
    'After sign-in, your email and province are stored on your Settings profile. Passwords stay on the server only.': 'پس از ورود، ایمیل و ولایت در تنظیمات ذخیره می‌شود. رمز عبور فقط روی سرور می‌ماند.',
    'Province is claimed at first login and cannot be changed here. All three users still see the same shared activity.': 'ولایت در اولین ورود ثبت می‌شود و اینجا تغییر نمی‌کند. هر سه کاربر فعالیت مشترک را می‌بینند.',
    'Password': 'رمز عبور',
    'Show': 'نمایش',
    'Hide': 'پنهان',
    'Show password': 'نمایش رمز',
    'Hide password': 'پنهان کردن رمز',
    'Enter your email or username.': 'ایمیل یا نام کاربری را وارد کنید.',
    'Password is required.': 'رمز عبور لازم است.',
    'you@example.com': 'you@example.com',
    'Authentication is sent to the Laravel API. There is no local login.': 'ورود به سرور لاراول فرستاده می‌شود. ورود محلی وجود ندارد.',
    'View dashboard UI': 'دیدن صفحه اصلی',
    'Please wait': 'لطفاً صبر کنید',
    'Profile': 'مشخصات',
    'Account': 'حساب',
    'Appearance': 'نمایش',
    'Application': 'برنامه',
    'Language': 'زبان',
    'English': 'انگلیسی',
    'Name': 'نام',
    'Email': 'ایمیل',
    'Usual location': 'موقعیت همیشگی',
    'Location here is a profile preference. Multi-location access rules are still an open question.': 'موقعیت اینجا فقط ترجیح مشخصات است. قاعده دسترسی چندموقعیتی هنوز باز است.',
    'Save profile': 'ذخیره مشخصات',
    'Current password': 'رمز فعلی',
    'New password': 'رمز جدید',
    'Confirm new password': 'تکرار رمز جدید',
    'Password changes are sent to Laravel. They are not stored in the browser.': 'تغییر رمز به سرور فرستاده می‌شود و در مرورگر ذخیره نمی‌شود.',
    'Update password': 'به‌روزرسانی رمز',
    'These choices stay on this device. They do not change business data.': 'این انتخاب‌ها فقط روی همین دستگاه می‌ماند و داده کسب‌وکار را عوض نمی‌کند.',
    'Display density': 'فاصله نمایش',
    'Comfortable': 'راحت',
    'Compact': 'فشرده',
    'API base URL': 'نشانی پایه API',
    'Default is the local Laravel URL. Do not put database credentials or secrets here.': 'پیش‌فرض، نشانی محلی لاراول است. رمز پایگاه داده را اینجا نگذارید.',
    'Save API URL': 'ذخیره نشانی API',
    'Reset default': 'بازگشت به پیش‌فرض',
    'Profile, account, display, and API connection. There is no administrator role in this workflow.': 'مشخصات، حساب، نمایش و اتصال API. در این کار نقش مدیر جداگانه نیست.',
    'Display density saved on this device only.': 'فاصله نمایش فقط روی همین دستگاه ذخیره شد.',
    'Profile saved.': 'مشخصات ذخیره شد.',
    'Password updated.': 'رمز به‌روز شد.',
    'The new password and confirmation do not match.': 'رمز جدید و تکرار آن یکسان نیست.',
    'API base URL saved on this device. No production URL is hard-coded in page scripts.': 'نشانی API روی همین دستگاه ذخیره شد.',
    'API base URL reset to the local default.': 'نشانی API به پیش‌فرض محلی برگشت.',
    'Unable to load profile': 'مشخصات بار نشد',
    'Language saved on this device.': 'زبان روی همین دستگاه ذخیره شد.',
    'Add customer': 'افزودن مشتری',
    'Add supplier': 'افزودن تأمین‌کننده',
    'Edit customer': 'ویرایش مشتری',
    'Edit supplier': 'ویرایش تأمین‌کننده',
    'Search customers': 'جستجوی مشتریان',
    'Search suppliers': 'جستجوی تأمین‌کنندگان',
    'Filter by location': 'فیلتر بر اساس موقعیت',
    'Phone': 'تلفن',
    'Contact': 'تماس',
    'Address': 'آدرس',
    'Balance': 'مانده',
    'Payable': 'قابل پرداخت',
    'Payable balance': 'مانده قابل پرداخت',
    'Open': 'باز کردن',
    'Save': 'ذخیره',
    'Cancel': 'لغو',
    'Reset': 'پاک کردن',
    'Customer': 'مشتری',
    'Supplier': 'تأمین‌کننده',
    'Customer records and the balance they still owe.': 'سوابق مشتری و مانده‌ای که هنوز بدهکارند.',
    'Supplier records and the balance the business still owes.': 'سوابق تأمین‌کننده و مانده‌ای که کسب‌وکار هنوز بدهکار است.',
    'Back to customers': 'بازگشت به مشتریان',
    'Back to suppliers': 'بازگشت به تأمین‌کنندگان',
    'Sales history': 'سابقه فروش',
    'Purchase history': 'سابقه خرید',
    'Payment history': 'سابقه پرداخت',
    'Transaction history': 'سابقه معاملات',
    'Date': 'تاریخ',
    'Status': 'وضعیت',
    'Method': 'روش',
    'Saved to the API.': 'در سرور ذخیره شد.',
    'That record is not available.': 'این سابقه موجود نیست.',
    'All locations': 'همه موقعیت‌ها',
    'All categories': 'همه دسته‌ها',
    'All products': 'همه اجناس',
    'All modules': 'همه بخش‌ها',
    'All customers': 'همه مشتریان',
    'All suppliers': 'همه تأمین‌کنندگان',
    'All': 'همه',
    'Select': 'انتخاب کنید',
    'Kabul': 'کابل',
    'Maidan/Wardak': 'میدان وردک',
    'Ghazni': 'غزنی',
    'Green Tea': 'چای سبز',
    'Black Tea': 'چای سیاه',
    'Rice (General)': 'برنج (عمومی)',
    'Vaseline': 'وازلین',
    'Liquid Dishwashing': 'مایع ظرفشویی',
    'Shampoo': 'شامپو',
    'Powder': 'پودر',
    'Soap': 'صابون',
    'Factory Raw Material': 'مواد خام فابریکه',
    '20kg': '۲۰ کیلو',
    '30kg': '۳۰ کیلو',
    '35kg': '۳۵ کیلو',
    '50kg': '۵۰ کیلو',
    '68kg': '۶۸ کیلو',
    '24.5kg': '۲۴٫۵ کیلو',
    '170kg bag': 'بوجی ۱۷۰ کیلو',
    '220kg bag': 'بوجی ۲۲۰ کیلو',
    'Green Tea and Black Tea. Bag sizes come from backend data so future sizes can be added.': 'چای سبز و چای سیاه. اندازه بوجی از سرور می‌آید تا بعداً اندازه جدید اضافه شود.',
    'Variants': 'انواع',
    'Stock display': 'نمایش موجودی',
    'Source': 'منبع',
    'Size': 'اندازه',
    'Quantity': 'مقدار',
    'Total': 'مجموع',
    'Location': 'موقعیت',
    'Party': 'طرف حساب',
    'Back to tea list': 'بازگشت به فهرست چای',
    'Back to rice list': 'بازگشت به فهرست برنج',
    'Back to detergent list': 'بازگشت به فهرست مواد شوینده',
    'Purchase': 'خرید',
    'Sale': 'فروش',
    'Tea purchase': 'خرید چای',
    'Tea sale': 'فروش چای',
    'Rice purchase': 'خرید برنج',
    'Rice sale': 'فروش برنج',
    'Detergent purchase': 'خرید مواد شوینده',
    'Detergent sale': 'فروش مواد شوینده',
    'Bag size': 'اندازه بوجی',
    'Number of bags': 'تعداد بوجی',
    'Total quantity': 'مقدار کل',
    'Purchase price': 'قیمت خرید',
    'Total amount': 'مبلغ کل',
    'Paid amount': 'مبلغ پرداخت‌شده',
    'Remaining payable': 'باقی‌مانده قابل پرداخت',
    'Save purchase': 'ذخیره خرید',
    'Price': 'قیمت',
    'Paid': 'پرداخت‌شده',
    'Remaining debt': 'قرض باقی‌مانده',
    'Payment type': 'نوع پرداخت',
    'Cash': 'نقد',
    'Credit': 'نسیه',
    'Cash / Credit': 'نقد / نسیه',
    'Save sale': 'ذخیره فروش',
    'All history': 'همه سوابق',
    'Search tea types': 'جستجوی نوع چای',
    'Search rice types': 'جستجوی نوع برنج',
    'Search products': 'جستجوی اجناس',
    'Filter tea types': 'فیلتر نوع چای',
    'Filter rice types': 'فیلتر نوع برنج',
    'Filter products': 'فیلتر اجناس',
    'Tea can be sold for cash or on credit. Official remaining debt comes from Laravel.': 'چای نقد یا نسیه فروخته می‌شود. قرض باقی‌مانده رسمی از سرور می‌آید.',
    'Rice may be sold for cash or credit. Supplier-credit rules are not implemented in this UI.': 'برنج می‌تواند نقد یا نسیه فروخته شود. قاعده نسیه تأمین‌کننده در این صفحه ساخته نشده است.',
    'Optional customer credit is supported in the form only. Credit rules will come from Laravel.': 'نسیه مشتری فقط در فرم هست. قاعده نسیه از سرور می‌آید.',
    'No variants yet. Future sizes or units will come from the backend.': 'هنوز نوعی نیست. اندازه یا واحد بعدی از سرور می‌آید.',
    'No stock values yet.': 'هنوز مقدار موجودی نیست.',
    'Backend value': 'مقدار سرور',
    'Sample / API': 'نمونه / سرور',
    'That record is not available.': 'این سابقه موجود نیست.',
    'Unable to load': 'بار نشد',
    'Try again': 'دوباره تلاش کنید',
    'Purchase sent to the API.': 'خرید به سرور فرستاده شد.',
    'Sale sent to the API.': 'فروش به سرور فرستاده شد.',
    'One reusable sales form for Tea, Rice, and Detergents. Official totals come from Laravel.': 'یک فرم فروش برای چای، برنج و مواد شوینده. مجموع رسمی از سرور محاسبه می‌شود.',
    'Reusable purchase form for Tea, Rice, Detergents, Raw Materials, and Factory Materials.': 'یک فرم خرید برای چای، برنج، مواد شوینده، مواد خام و مواد فابریکه.',
    'Enter amounts as provided. Laravel calculates official totals and stock.': 'مبلغ را همان‌طور که هست وارد کنید. مجموع و موجودی را سرور حساب می‌کند.',
    'Product category': 'دسته جنس',
    'Product': 'جنس',
    'Variant / unit': 'نوع / واحد',
    'Variant': 'نوع',
    'Category': 'دسته',
    'Notes': 'یادداشت',
    'From date': 'از تاریخ',
    'To date': 'تا تاریخ',
    'All movements': 'همه حرکت‌ها',
    'Return': 'برگشت',
    'Damage': 'آسیب',
    'No sales yet': 'هنوز فروشی نیست',
    'No purchases yet': 'هنوز خریدی نیست',
    'New records will show up here.': 'سوابق جدید اینجا دیده می‌شود.',
    'Materials you add will show up here.': 'موادی که اضافه کنید اینجا دیده می‌شود.',
    'Saved': 'ذخیره شد',
    'The transaction was sent to Laravel. Stock will be updated by the backend.': 'معامله به سرور فرستاده شد. موجودی را سرور به‌روز می‌کند.',
    'Customer and supplier payments. Official balances stay on the backend.': 'پرداخت مشتری و تأمین‌کننده. مانده رسمی در سرور می‌ماند.',
    'Customer payments': 'پرداخت مشتریان',
    'Supplier payments': 'پرداخت تأمین‌کنندگان',
    'New payment': 'پرداخت جدید',
    'Search payments': 'جستجوی پرداخت‌ها',
    'Description': 'شرح',
    'User': 'کاربر',
    'No payments yet': 'هنوز پرداختی نیست',
    'Payments you record will show up here.': 'پرداخت‌هایی که ثبت کنید اینجا دیده می‌شود.',
    'Worker payments you record will show up here.': 'پرداخت کارگر که ثبت کنید اینجا دیده می‌شود.',
    'Payments on this debt will show up here.': 'پرداخت‌های این قرض اینجا دیده می‌شود.',
    'Payment sent to Laravel. Official balances stay on the backend.': 'پرداخت به سرور فرستاده شد. مانده رسمی در سرور می‌ماند.',
    'Display only. Official quantities and movements come from Laravel.': 'فقط نمایش. مقدار و حرکت رسمی از سرور می‌آید.',
    'Current stock': 'موجودی فعلی',
    'Stock movements': 'حرکت موجودی',
    'Movement type': 'نوع حرکت',
    'Search stock': 'جستجوی موجودی',
    'Reference': 'مرجع',
    'No stock rows': 'سطر موجودی نیست',
    'Stock for every province will show up here.': 'موجودی هر ولایت اینجا دیده می‌شود.',
    'No movements': 'حرکتی نیست',
    'Purchase, sale, return, and damage movements will come from Laravel.': 'حرکت خرید، فروش، برگشت و آسیب از سرور می‌آید.',
    'Out of stock': 'موجودی تمام شده',
    'Sales Returns': 'برگشت فروش',
    'New return': 'برگشت جدید',
    'Original sale': 'فروش اصلی',
    'Reason': 'دلیل',
    'No returns yet': 'هنوز برگشتی نیست',
    'Returns you record will show up here.': 'برگشت‌هایی که ثبت کنید اینجا دیده می‌شود.',
    'Record return': 'ثبت برگشت',
    'This will request a sales return. Stock will only change if Laravel accepts the request.': 'این یک درخواست برگشت است. موجودی فقط اگر سرور بپذیرد عوض می‌شود.',
    'Submit return': 'فرستادن برگشت',
    'Return sent. The backend will adjust stock.': 'برگشت فرستاده شد. سرور موجودی را تنظیم می‌کند.',
    'Return not saved': 'برگشت ذخیره نشد',
    'Request a return. Laravel adjusts stock. This page does not change inventory in the browser.': 'درخواست برگشت. سرور موجودی را تنظیم می‌کند. این صفحه خودش موجودی را عوض نمی‌کند.',
    'No damage records': 'سابقه آسیب نیست',
    'Damaged stock you record will show up here.': 'موجودی آسیب‌دیده که ثبت کنید اینجا دیده می‌شود.',
    'Record damage': 'ثبت آسیب',
    'This will request a damage record. Available stock will only change if Laravel accepts it.': 'این یک درخواست ثبت آسیب است. موجودی فقط اگر سرور بپذیرد کم می‌شود.',
    'Submit damage': 'فرستادن آسیب',
    'Damage sent. The backend will remove stock.': 'آسیب فرستاده شد. سرور موجودی را کم می‌کند.',
    'Damage not saved': 'آسیب ذخیره نشد',
    'Request a damage record. Laravel removes available stock. This page does not change inventory in the browser.': 'درخواست ثبت آسیب. سرور موجودی قابل استفاده را کم می‌کند. این صفحه خودش موجودی را عوض نمی‌کند.',
    'Add worker': 'افزودن کارگر',
    'Search workers': 'جستجوی کارگران',
    'Worker name': 'نام کارگر',
    'Monthly payment report': 'گزارش ماهانه پرداخت',
    'Monthly report': 'گزارش ماهانه',
    'Payment dates': 'تاریخ‌های پرداخت',
    'Amounts received': 'مبلغ‌های دریافت‌شده',
    'Monthly total': 'مجموع ماه',
    'Tracks money received by workers. This is not a payroll system.': 'پول دریافت‌شده توسط کارگر را ثبت می‌کند. این سیستم معاش نیست.',
    'Official monthly totals come from Laravel. This screen only displays backend results.': 'مجموع ماهانه رسمی از سرور می‌آید. این صفحه فقط نتیجه سرور را نشان می‌دهد.',
    'Back to workers': 'بازگشت به کارگران',
    'Record payment received': 'ثبت پول دریافت‌شده',
    'Save worker': 'ذخیره کارگر',
    'Save payment': 'ذخیره پرداخت',
    'Only the worker record is stored here. Salary, hours, and payroll rules are not part of this module.': 'اینجا فقط سابقه کارگر ذخیره می‌شود. معاش، ساعت و قاعده حقوق در این بخش نیست.',
    'No workers yet': 'هنوز کارگری نیست',
    'Workers you add will show up here.': 'کارگرانی که اضافه کنید اینجا دیده می‌شوند.',
    'No monthly report rows': 'سطر گزارش ماهانه نیست',
    'Official monthly totals will come from Laravel. This UI does not calculate payroll.': 'مجموع ماهانه رسمی از سرور می‌آید. این صفحه معاش را حساب نمی‌کند.',
    'Worker saved.': 'کارگر ذخیره شد.',
    'Payment sent. Official monthly totals stay on Laravel.': 'پرداخت فرستاده شد. مجموع ماهانه رسمی در سرور می‌ماند.',
    'That worker is not available.': 'این کارگر موجود نیست.',
    'Report month': 'ماه گزارش',
    'Add external debt record': 'افزودن قرض بیرونی',
    'Search person or reason': 'جستجوی شخص یا دلیل',
    'Person / entity': 'شخص / نهاد',
    'Direction': 'جهت',
    'Original amount': 'مبلغ اصلی',
    'Paid / received': 'پرداخت یا دریافت‌شده',
    'Remaining display': 'باقی‌مانده',
    'Remaining': 'باقی‌مانده',
    'Business owes this person': 'کسب‌وکار به این شخص بدهکار است',
    'This person owes the business': 'این شخص به کسب‌وکار بدهکار است',
    'Business owes': 'کسب‌وکار بدهکار است',
    'Person owes business': 'شخص به کسب‌وکار بدهکار است',
    'Amount paid to this person': 'مبلغ پرداخت‌شده به این شخص',
    'Amount received from this person': 'مبلغ دریافت‌شده از این شخص',
    'No external debt records': 'قرض بیرونی نیست',
    'These records are separate from customers and suppliers. Official balances come from Laravel.': 'این سوابق از مشتری و تأمین‌کننده جداست. مانده رسمی از سرور می‌آید.',
    'Separate from customers and suppliers. The two directions are never mixed.': 'از مشتری و تأمین‌کننده جداست. این دو جهت با هم مخلوط نمی‌شود.',
    'Back to external debts': 'بازگشت به قرض‌های بیرونی',
    'Saved. Official remaining balance stays on Laravel.': 'ذخیره شد. مانده باقی‌مانده رسمی در سرور می‌ماند.',
    'Payment sent. Official remaining balance stays on Laravel.': 'پرداخت فرستاده شد. مانده باقی‌مانده رسمی در سرور می‌ماند.',
    'Select direction': 'جهت را انتخاب کنید',
    'Add home expense': 'افزودن مصرف خانه',
    'Search home expenses': 'جستجوی مصارف خانه',
    'Home expenses are personal/household spending. They are not business costs and do not affect Profit & Loss on this frontend.': 'مصارف خانه خرج شخصی است. هزینه کسب‌وکار نیست و در سود و زیان این سیستم نمی‌آید.',
    'No home expenses yet': 'هنوز مصرف خانه نیست',
    'Home expenses stay outside business profit.': 'مصارف خانه بیرون از سود کسب‌وکار می‌ماند.',
    'Home expense saved. It does not change business profit/loss.': 'مصرف خانه ذخیره شد و سود و زیان کسب‌وکار را عوض نمی‌کند.',
    'Save expense': 'ذخیره مصرف',
    'Food': 'غذا',
    'Household expenses': 'مصارف خانه',
    'Other home expenses': 'سایر مصارف خانه',
    'Add new category': 'افزودن دسته جدید',
    '+ Add new category…': '+ افزودن دسته جدید…',
    'New category name': 'نام دسته جدید',
    'Or type a new category': 'یا نام دسته جدید را بنویسید',
    'Leave the dropdown on “Select category”, type a name here, then save. It will stay in the list next time.': 'فهرست را روی «انتخاب دسته» بگذارید، اینجا نام را بنویسید و ذخیره کنید. دفعه بعد در فهرست می‌ماند.',
    'Pick a saved category, or click Add new category to type a name.': 'یک دسته ذخیره‌شده را انتخاب کنید، یا برای نوشتن نام جدید روی افزودن دسته جدید بزنید.',
    'Saved with this expense and kept in the category list for next time.': 'با این مصرف ذخیره می‌شود و دفعه بعد در فهرست دسته‌ها می‌ماند.',
    'Select a category or type a new category name.': 'یک دسته انتخاب کنید یا نام دسته جدید را بنویسید.',
    'Personal expenses': 'مصارف شخصی',
    'Add raw material': 'افزودن مواد خام',
    'Add factory material': 'افزودن مواد فابریکه',
    'Search raw materials': 'جستجوی مواد خام',
    'Search factory materials': 'جستجوی مواد فابریکه',
    'Back to raw materials': 'بازگشت به مواد خام',
    'Back to factory materials': 'بازگشت به مواد فابریکه',
    'Raw material purchase': 'خرید مواد خام',
    'Factory material purchase': 'خرید مواد فابریکه',
    'Material saved.': 'مواد ذخیره شد.',
    'That material is not available.': 'این مواد موجود نیست.',
    'Choose a supplier or enter a person.': 'تأمین‌کننده را انتخاب کنید یا نام شخص را بنویسید.',
    'Separate from finished detergent products. Current bag sizes: 170kg and 220kg.': 'از جنس آماده مواد شوینده جداست. اندازه فعلی بوجی: ۱۷۰ و ۲۲۰ کیلو.',
    'Cartons, labels, tape, and other factory-use materials. Separate from raw materials.': 'کارتن، لیبل، نوار و مواد مصرف فابریکه. از مواد خام جداست.',
    'Displays backend-provided figures only. This screen does not choose FIFO or weighted average, and it does not invent a profit formula.': 'فقط عددهای سرور را نشان می‌دهد. این صفحه روش قیمت‌گذاری را انتخاب نمی‌کند و فرمول سود نمی‌سازد.',
    'Revenue': 'درآمد',
    'Cost': 'هزینه',
    'Gross Profit': 'سود ناخالص',
    'Operating Expenses': 'مصارف عملیاتی',
    'Net Profit/Loss': 'سود یا زیان خالص',
    'No profit/loss rows': 'سطر سود و زیان نیست',
    'Choose a date range to see profit and loss. Home expenses are not included here.': 'بازه تاریخ را انتخاب کنید تا سود و زیان دیده شود. مصارف خانه اینجا نیست.',
    'Unable to load profit/loss': 'سود و زیان بار نشد',
    'Module': 'بخش',
    'Result': 'نتیجه',
    'Open the Profit & Loss screen': 'باز کردن صفحه سود و زیان',
    'The official P&L layout lives on its own page so costing is not invented in reports.': 'شکل رسمی سود و زیان صفحه خودش را دارد تا در گزارش‌ها ساخته نشود.',
    'Totals for sales, stock, and money across all provinces. Use Export to download the rows on screen.': 'مجموع فروش، موجودی و پول در همه ولایت‌ها. برای دانلود سطرهای روی صفحه، خروجی بگیرید.',
    'No report rows': 'سطر گزارش نیست',
    'No rows match these filters yet.': 'هنوز سطری با این فیلتر نیست.',
    'There are no report rows to download.': 'سطری برای دانلود نیست.',
    'Download this report as a spreadsheet': 'این گزارش را به شکل صفحه گسترده دانلود کنید',
    'Unable to load report': 'گزارش بار نشد',
    'Daily': 'روزانه',
    'Weekly': 'هفتگی',
    'Monthly': 'ماهانه',
    'Yearly': 'سالانه',
    'Customer debts': 'قرض مشتریان',
    'Supplier debts': 'قرض تأمین‌کنندگان',
    'Worker payments': 'پرداخت کارگران',
    'Monthly totals': 'مجموع‌های ماهانه',
    'Returned stock': 'موجودی برگشتی',
    'Financial': 'مالی',
    'Factory': 'فابریکه',
    'Previous': 'قبلی',
    'Next': 'بعدی',
    'Page': 'صفحه',
    'Rows shown': 'سطرهای نشان‌داده‌شده',
    'Export': 'خروجی',
    'Search report': 'جستجوی گزارش',
    'Period': 'دوره',
    'Person': 'شخص',
    'Worker': 'کارگر',
    'Month': 'ماه',
    'Note': 'یادداشت',
    'Reset form': 'پاک کردن فرم',
    'Clear the entered values?': 'مقدارهای واردشده پاک شود؟',
    'Confirm': 'تأیید',
    'Form error': 'خطای فرم',
    'Loading': 'در حال بار شدن',
    'Loading…': 'در حال بار شدن…',
    'Loading settings': 'در حال بار شدن تنظیمات',
    'Loading dashboard': 'در حال بار شدن داشبورد',
    'Nothing to show': 'چیزی برای نمایش نیست',
    'Must match': 'باید یکسان باشد',
    'Required': 'لازم است',
    'sale': 'فروش',
    'purchase': 'خرید',
    'sale_return': 'برگشت فروش',
    'damage': 'آسیب',
    'adjustment': 'تعدیل',
    'transfer_in': 'انتقال به داخل',
    'transfer_out': 'انتقال به بیرون',
    'tea': 'چای',
    'rice': 'برنج',
    'detergents': 'مواد شوینده',
    'cash': 'نقد',
    'credit': 'نسیه',
    'Available': 'آماده',
    'Profit and loss is waiting for a costing method.': 'سود و زیان منتظر روش محاسبه قیمت است.',
    'Purchase sent. Official stock and payables stay on Laravel.': 'خرید فرستاده شد. موجودی و بدهی رسمی در سرور می‌ماند.',
    'OPEN QUESTION: costing method (FIFO or weighted average) and whether operating expenses affect net profit. Home expenses are excluded from this screen.': 'سؤال باز: روش محاسبه قیمت (اولین ورود یا میانگین) و این‌که مصارف عملیاتی در سود خالص بیاید یا نه. مصارف خانه در این صفحه نیست.',
    'OPEN QUESTION: production consumption is not implemented until the team confirms whether it should decrease raw-material stock and increase finished-product stock.': 'سؤال باز: مصرف تولید تا وقتی تیم تأیید نکند که موجودی مواد خام کم و موجودی جنس آماده زیاد شود، ساخته نشده است.',
    'OPEN QUESTION: the team has not confirmed whether factory materials require inventory stock tracking. This page does not invent stock.': 'سؤال باز: تیم هنوز تأیید نکرده که مواد فابریکه موجودی جدا داشته باشد. این صفحه موجودی نمی‌سازد.',
    'Bag': 'بوجی',
    'Unit': 'واحد',
    'Units': 'واحدها',
    'Kilogram': 'کیلوگرم',
    'Piece': 'دانه',
    'History': 'سابقه',
    'Edit': 'ویرایش',
    'Add record': 'افزودن سابقه',
    'Save record': 'ذخیره سابقه',
    'Quantity display': 'نمایش مقدار',
    'Remaining balance': 'مانده باقی‌مانده',
    'Remaining amount': 'مبلغ باقی‌مانده',
    'Paid / received amount': 'مبلغ پرداخت یا دریافت‌شده',
    'KG per bag': 'کیلو در هر بوجی',
    'Total KG': 'مجموع کیلو',
    'Supplier / person': 'تأمین‌کننده / شخص',
    'Other person if not a supplier': 'شخص دیگر اگر تأمین‌کننده نیست',
    'Condition if required': 'حالت، اگر لازم باشد',
    'Optional. Return condition rules are not defined here.': 'اختیاری. قاعده حالت برگشت اینجا تعریف نشده است.',
    'Date · user · location': 'تاریخ · کاربر · موقعیت',
    'Low stock placeholder': 'جایگاه موجودی کم',
    'Reorder placeholder': 'جایگاه سفارش دوباره',
    'Backend value. Separate from finished detergent stock.': 'مقدار سرور. از موجودی جنس آماده جداست.',
    'Stock display from API': 'نمایش موجودی از سرور',
    'Stock tracking not finalized': 'پیگیری موجودی هنوز نهایی نیست',
    'Raw-material stock display': 'نمایش موجودی مواد خام',
    'No': 'نخیر'
  };

  function current() {
    try {
      return global.localStorage.getItem(KEY) === 'fa' ? 'fa' : 'en';
    } catch (err) {
      return 'en';
    }
  }

  function digits(text) {
    var persian = '۰۱۲۳۴۵۶۷۸۹';
    return String(text).replace(/[0-9]/g, function (digit) {
      return persian[digit];
    });
  }

  function translate(text) {
    if (current() !== 'fa' || text == null) {
      return text;
    }
    var raw = String(text);
    var trimmed = raw.replace(/\s+/g, ' ').trim();
    if (!trimmed || trimmed.indexOf('@') !== -1 || /^https?:/i.test(trimmed) || trimmed.charAt(0) === '/') {
      return raw;
    }
    var mapped = FA[trimmed];
    if (!mapped && trimmed.indexOf(' · ') !== -1) {
      mapped = trimmed.split(' · ').map(function (part) {
        return FA[part] || part;
      }).join(' · ');
      if (mapped === trimmed) {
        mapped = '';
      }
    }
    if (!mapped) {
      var leftAt = trimmed.match(/^(.*?) left at (.+)$/);
      var reference = trimmed.match(/^(Sale|Purchase|SalesReturn|DamagedStock) (\d+)$/);
      if (leftAt) {
        mapped = leftAt[1] + ' باقی در ' + (FA[leftAt[2]] || leftAt[2]);
      } else if (reference) {
        var referenceNames = { Sale: 'فروش', Purchase: 'خرید', SalesReturn: 'برگشت فروش', DamagedStock: 'آسیب' };
        mapped = referenceNames[reference[1]] + ' ' + reference[2];
      }
    }
    if (!mapped) {
      mapped = trimmed
        .replace(/\bkg\b/gi, 'کیلو')
        .replace(/\bleft at\b/gi, 'باقی در');
      if (mapped === trimmed) {
        mapped = '';
      }
    }
    if (!mapped) {
      if (!/[0-9]/.test(trimmed)) {
        return raw;
      }
      mapped = digits(trimmed).replace(/\bkg\b/gi, 'کیلو');
    } else {
      mapped = digits(mapped);
    }
    if (mapped === trimmed) {
      return raw;
    }
    return raw.replace(trimmed, mapped);
  }

  function skip(node) {
    var parent = node.parentElement;
    if (!parent) {
      return true;
    }
    var tag = parent.tagName;
    return tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' || parent.closest('[data-i18n-skip]');
  }

  function translateNode(node) {
    if (!node || current() !== 'fa') {
      return;
    }
    if (node.nodeType === 3) {
      if (skip(node)) {
        return;
      }
      var next = translate(node.nodeValue);
      if (next !== node.nodeValue) {
        node.nodeValue = next;
      }
      return;
    }
    if (node.nodeType !== 1 || node.closest('[data-i18n-skip]')) {
      return;
    }
    if (node.childNodes) {
      Array.prototype.forEach.call(node.childNodes, translateNode);
    }
    ['placeholder', 'aria-label', 'title'].forEach(function (name) {
      if (!node.getAttribute) {
        return;
      }
      var value = node.getAttribute(name);
      if (!value) {
        return;
      }
      var next = translate(value);
      if (next !== value) {
        node.setAttribute(name, next);
      }
    });
  }

  function applyDirection() {
    var persian = current() === 'fa';
    document.documentElement.lang = persian ? 'fa' : 'en';
    document.documentElement.dir = persian ? 'rtl' : 'ltr';
    if (!persian) {
      return;
    }
    var font = document.getElementById('mbms-fa-font');
    if (!font) {
      font = document.createElement('link');
      font.id = 'mbms-fa-font';
      font.rel = 'stylesheet';
      font.href = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap';
      document.head.appendChild(font);
    }
    Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"]'), function (link) {
      if (link.href.indexOf('bootstrap@5.3.3/dist/css/bootstrap.min.css') !== -1) {
        link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.rtl.min.css';
      }
    });
  }

  function apply(root) {
    applyDirection();
    if (current() === 'fa') {
      translateNode(root || document.body);
      if (document.title) {
        document.title = translate(document.title);
      }
    }
  }

  function setLanguage(lang) {
    try {
      global.localStorage.setItem(KEY, lang === 'fa' ? 'fa' : 'en');
    } catch (err) {
      /* ignore */
    }
    global.location.reload();
  }

  var observer = new MutationObserver(function () {
    if (current() !== 'fa') {
      return;
    }
    observer.disconnect();
    apply(document.body);
    watch();
  });

  function watch() {
    if (!document.documentElement) {
      return;
    }
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'aria-label', 'title']
    });
  }

  function start() {
    apply(document.body);
    watch();
  }

  global.MBMS_I18N = {
    lang: current,
    t: translate,
    apply: apply,
    set: setLanguage
  };

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }
})(window);
