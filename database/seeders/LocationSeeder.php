<?php

namespace Database\Seeders;

use App\Models\Location;
use Illuminate\Database\Seeder;

class LocationSeeder extends Seeder
{
    public function run(): void
    {
        $locations = [
            [
                'name' => 'Kabul',
                'code' => 'kabul',
                'invoice_profile' => [
                    'legal_name' => 'Olfat Trading Company — Kabul',
                    'tagline' => 'Kabul Branch Sales Invoice',
                    'address_line1' => 'Kabul Main Warehouse',
                    'address_line2' => 'Kabul, Afghanistan',
                    'phone' => '',
                    'whatsapp' => '',
                    'footer_note' => 'Thank you for shopping at our Kabul branch.',
                ],
            ],
            [
                'name' => 'Maidan/Wardak',
                'code' => 'maidan-wardak',
                'invoice_profile' => [
                    'legal_name' => 'Olfat Trading Company — Maidan/Wardak',
                    'tagline' => 'Maidan/Wardak Branch Sales Invoice',
                    'address_line1' => 'Maidan/Wardak Branch',
                    'address_line2' => 'Maidan Wardak, Afghanistan',
                    'footer_note' => 'Thank you for shopping at our Maidan/Wardak branch.',
                ],
            ],
            [
                'name' => 'Ghazni',
                'code' => 'ghazni',
                'invoice_profile' => [
                    'legal_name' => 'Olfat Trading Company — Ghazni',
                    'tagline' => 'Ghazni Branch Sales Invoice',
                    'address_line1' => 'Ghazni Branch',
                    'address_line2' => 'Ghazni, Afghanistan',
                    'footer_note' => 'Thank you for shopping at our Ghazni branch.',
                ],
            ],
        ];

        foreach ($locations as $location) {
            Location::query()->updateOrCreate(
                ['code' => $location['code']],
                [
                    'name' => $location['name'],
                    'is_active' => true,
                    'invoice_profile' => $location['invoice_profile'],
                ]
            );
        }
    }
}
