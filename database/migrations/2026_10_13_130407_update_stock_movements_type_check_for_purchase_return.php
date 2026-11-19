<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Throwable;

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
        $driver = DB::connection()->getDriverName();

        if ($driver === 'pgsql') {
            DB::statement("ALTER TABLE stock_movements DROP CONSTRAINT {$name}");

            return;
        }

        // MariaDB only accepts DROP CONSTRAINT. MySQL 8 accepts DROP CHECK
        // (and newer MySQL also accepts DROP CONSTRAINT).
        $version = strtolower((string) (DB::selectOne('select version() as v')->v ?? ''));
        $isMariaDb = str_contains($version, 'mariadb');
        $primary = $isMariaDb ? 'CONSTRAINT' : 'CHECK';
        $fallback = $isMariaDb ? 'CHECK' : 'CONSTRAINT';

        try {
            DB::statement("ALTER TABLE stock_movements DROP {$primary} {$name}");
        } catch (Throwable) {
            DB::statement("ALTER TABLE stock_movements DROP {$fallback} {$name}");
        }
    }

    private function supportsCheckConstraints(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb', 'pgsql'], true);
    }
};
