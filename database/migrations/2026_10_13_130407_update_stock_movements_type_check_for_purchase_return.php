<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->supportsCheckConstraints()) {
            return;
        }

        $this->dropCheck('chk_stock_movements_type');

        DB::statement(
            "ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_type CHECK (type IN ('purchase', 'purchase_return', 'sale', 'sale_return', 'damage', 'adjustment', 'transfer_in', 'transfer_out'))"
        );
    }

    public function down(): void
    {
        if (! $this->supportsCheckConstraints()) {
            return;
        }

        $this->dropCheck('chk_stock_movements_type');

        DB::statement(
            "ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_type CHECK (type IN ('purchase', 'sale', 'sale_return', 'damage', 'adjustment', 'transfer_in', 'transfer_out'))"
        );
    }

    private function dropCheck(string $name): void
    {
        $dropKeyword = DB::connection()->getDriverName() === 'pgsql' ? 'CONSTRAINT' : 'CHECK';
        DB::statement("ALTER TABLE stock_movements DROP {$dropKeyword} {$name}");
    }

    private function supportsCheckConstraints(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb', 'pgsql'], true);
    }
};
