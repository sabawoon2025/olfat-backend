<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('settings')->where('key', 'business.whatsapp')->exists();

        if ($exists) {
            return;
        }

        DB::table('settings')->insert([
            'key' => 'business.whatsapp',
            'value' => '',
            'type' => 'string',
            'group' => 'business',
            'label' => 'WhatsApp',
            'description' => 'Default WhatsApp number shown on invoices (branch profiles can override)',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'business.whatsapp')->delete();
    }
};
