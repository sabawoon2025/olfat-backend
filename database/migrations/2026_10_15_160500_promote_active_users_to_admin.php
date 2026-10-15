<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('is_active', true)
            ->update(['role' => 'admin']);
    }

    public function down(): void
    {
        // Irreversible: original mixed roles are not restored.
    }
};
