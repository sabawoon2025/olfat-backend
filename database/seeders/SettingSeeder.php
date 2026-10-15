<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            // --- General ---------------------------------------------------
            [
                'key' => 'app.name',
                'value' => 'Olfat Business Management',
                'type' => 'string',
                'group' => 'general',
                'label' => 'Application Name',
                'description' => 'Display name for the business system',
            ],
            [
                'key' => 'app.currency_code',
                'value' => 'AFN',
                'type' => 'string',
                'group' => 'general',
                'label' => 'Currency Code',
                'description' => 'ISO 4217 code (e.g. AFN, USD, EUR)',
            ],
            [
                'key' => 'app.currency_symbol',
                'value' => '؋',
                'type' => 'string',
                'group' => 'general',
                'label' => 'Currency Symbol',
                'description' => 'Symbol shown on bills next to amounts',
            ],
            [
                'key' => 'app.currency_position',
                'value' => 'suffix',
                'type' => 'string',
                'group' => 'general',
                'label' => 'Currency Position',
                'description' => 'prefix (e.g. $100) or suffix (e.g. 100 ؋)',
            ],
            [
                'key' => 'app.timezone',
                'value' => 'Asia/Kabul',
                'type' => 'string',
                'group' => 'general',
                'label' => 'Timezone',
                'description' => 'Default timezone for date/time display',
            ],

            // --- Business identity (shown on every invoice header) --------
            [
                'key' => 'business.legal_name',
                'value' => 'Olfat Trading Company',
                'type' => 'string',
                'group' => 'business',
                'label' => 'Legal Business Name',
                'description' => 'Registered business name printed on invoices',
            ],
            [
                'key' => 'business.tagline',
                'value' => 'Sales Invoice',
                'type' => 'string',
                'group' => 'business',
                'label' => 'Tagline / Document Caption',
                'description' => 'Short line under the business name on invoices',
            ],
            [
                'key' => 'business.logo_url',
                'value' => '/assets/images/logo.svg',
                'type' => 'string',
                'group' => 'business',
                'label' => 'Logo URL',
                'description' => 'Public URL or relative path to the invoice logo',
            ],
            [
                'key' => 'business.address_line1',
                'value' => '',
                'type' => 'string',
                'group' => 'business',
                'label' => 'Address Line 1',
                'description' => 'Street / shop number',
            ],
            [
                'key' => 'business.address_line2',
                'value' => '',
                'type' => 'string',
                'group' => 'business',
                'label' => 'Address Line 2',
                'description' => 'City / Province / Country',
            ],
            [
                'key' => 'business.phone',
                'value' => '',
                'type' => 'string',
                'group' => 'business',
                'label' => 'Phone',
                'description' => 'Primary phone number printed on invoices',
            ],
            [
                'key' => 'business.whatsapp',
                'value' => '',
                'type' => 'string',
                'group' => 'business',
                'label' => 'WhatsApp',
                'description' => 'Default WhatsApp number shown on invoices (branch profiles can override)',
            ],
            [
                'key' => 'business.email',
                'value' => '',
                'type' => 'string',
                'group' => 'business',
                'label' => 'Email',
                'description' => 'Business email printed on invoices',
            ],
            [
                'key' => 'business.website',
                'value' => '',
                'type' => 'string',
                'group' => 'business',
                'label' => 'Website',
                'description' => 'Business website printed on invoices',
            ],
            [
                'key' => 'business.tax_id',
                'value' => '',
                'type' => 'string',
                'group' => 'business',
                'label' => 'Tax / Registration Number',
                'description' => 'TIN, VAT number, business licence, etc.',
            ],

            // --- Invoice (A4 bill layout) ---------------------------------
            [
                'key' => 'invoice.prefix',
                'value' => 'INV',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Invoice Number Prefix',
                'description' => 'Prefix shown before the sale reference (e.g. INV, BILL)',
            ],
            [
                'key' => 'invoice.header_note',
                'value' => '',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Header Note',
                'description' => 'Optional short line printed above the invoice meta box',
            ],
            [
                'key' => 'invoice.footer_note',
                'value' => 'Thank you for your business. Please keep this bill for your records.',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Footer Note',
                'description' => 'Primary footer message printed on sale bills',
            ],
            [
                'key' => 'invoice.terms',
                'value' => 'Goods once sold are not refundable unless damaged on delivery. All disputes must be reported within 48 hours.',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Terms & Conditions',
                'description' => 'Terms printed in the invoice footer',
            ],
            [
                'key' => 'invoice.bank_details',
                'value' => '',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Bank / Payment Details',
                'description' => 'Account name, number and bank printed in the footer',
            ],
            [
                'key' => 'invoice.signature_customer_label',
                'value' => 'Customer signature',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Customer Signature Label',
                'description' => 'Text under the left signature line',
            ],
            [
                'key' => 'invoice.signature_authorized_label',
                'value' => 'Authorized signature',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Authorized Signature Label',
                'description' => 'Text under the right signature line',
            ],
            [
                'key' => 'invoice.show_watermark',
                'value' => '1',
                'type' => 'boolean',
                'group' => 'invoice',
                'label' => 'Show Paid/Unpaid Watermark',
                'description' => 'Diagonal PAID / UNPAID / PARTIAL stamp on the invoice',
            ],

            // --- Backwards-compat keys referenced by older bill-page.js ---
            [
                'key' => 'bill.phone',
                'value' => '',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Bill Phone (legacy)',
                'description' => 'Legacy key kept for backwards compatibility — prefer business.phone',
            ],
            [
                'key' => 'bill.address',
                'value' => '',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Bill Address (legacy)',
                'description' => 'Legacy key kept for backwards compatibility — prefer business.address_line1',
            ],
            [
                'key' => 'bill.footer_note',
                'value' => 'Thank you for your business. Please keep this bill for your records.',
                'type' => 'string',
                'group' => 'invoice',
                'label' => 'Bill Footer Note (legacy)',
                'description' => 'Legacy key kept for backwards compatibility — prefer invoice.footer_note',
            ],

            // --- Stock ----------------------------------------------------
            [
                'key' => 'stock.low_stock_threshold',
                'value' => '5',
                'type' => 'decimal',
                'group' => 'stock',
                'label' => 'Low Stock Threshold',
                'description' => 'Dashboard warning when stock quantity is at or below this value',
            ],

            // --- Accounting (unchanged open questions) --------------------
            [
                'key' => 'accounting.costing_method',
                'value' => '',
                'type' => 'string',
                'group' => 'accounting',
                'label' => 'Costing Method',
                'description' => 'OPEN QUESTION: fifo | weighted_average — required before P&L',
            ],
            [
                'key' => 'accounting.include_operating_expenses_in_profit',
                'value' => '0',
                'type' => 'boolean',
                'group' => 'accounting',
                'label' => 'Include Operating Expenses in Net Profit',
                'description' => 'OPEN QUESTION: Master Spec §28.2',
            ],

            // --- Factory --------------------------------------------------
            [
                'key' => 'factory.auto_consume_raw_materials',
                'value' => '0',
                'type' => 'boolean',
                'group' => 'factory',
                'label' => 'Auto Consume Raw Materials on Production',
                'description' => 'OPEN QUESTION: Master Spec §28.6 — do not invent production posting yet',
            ],
            [
                'key' => 'factory.track_factory_material_stock',
                'value' => '0',
                'type' => 'boolean',
                'group' => 'factory',
                'label' => 'Track Factory Material Stock',
                'description' => 'OPEN QUESTION: Master Spec §28.5',
            ],
        ];

        foreach ($defaults as $setting) {
            Setting::query()->updateOrCreate(
                ['key' => $setting['key']],
                $setting
            );
        }
    }
}
