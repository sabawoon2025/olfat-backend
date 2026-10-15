<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('settings')->where('key', 'home_expenses.categories')->exists();

        if ($exists) {
            return;
        }

        DB::table('settings')->insert([
            'key' => 'home_expenses.categories',
            'value' => '[]',
            'type' => 'json',
            'group' => 'home_expenses',
            'label' => 'Home Expense Categories',
            'description' => 'Custom categories available in the Add Expense form',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'home_expenses.categories')->delete();
    }
};
