<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('sales', 'currency')) {
            Schema::table('sales', function (Blueprint $table) {
                $table->string('currency', 3)->default('AFN')->after('notes');
                $table->index('currency');
            });
        }

        if (! Schema::hasColumn('purchases', 'currency')) {
            Schema::table('purchases', function (Blueprint $table) {
                $table->string('currency', 3)->default('AFN')->after('notes');
                $table->index('currency');
            });
        }

        if (! Schema::hasColumn('customer_payments', 'currency')) {
            Schema::table('customer_payments', function (Blueprint $table) {
                $table->string('currency', 3)->default('AFN')->after('notes');
                $table->index('currency');
            });
        }

        if (! Schema::hasColumn('supplier_payments', 'currency')) {
            Schema::table('supplier_payments', function (Blueprint $table) {
                $table->string('currency', 3)->default('AFN')->after('notes');
                $table->index('currency');
            });
        }

        if (! Schema::hasColumn('external_debts', 'currency')) {
            Schema::table('external_debts', function (Blueprint $table) {
                $table->string('currency', 3)->default('AFN')->after('status');
                $table->index('currency');
            });
        }

        if (! Schema::hasColumn('customers', 'balance_usd')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->decimal('balance_usd', 15, 2)->default(0)->after('balance');
            });
        }

        if (! Schema::hasColumn('suppliers', 'balance_usd')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->decimal('balance_usd', 15, 2)->default(0)->after('balance');
            });
        }

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'pgsql'], true)) {
            $this->ensureCurrencyCheck('sales', 'sales_currency_check');
            $this->ensureCurrencyCheck('purchases', 'purchases_currency_check');
            $this->ensureCurrencyCheck('customer_payments', 'customer_payments_currency_check');
            $this->ensureCurrencyCheck('supplier_payments', 'supplier_payments_currency_check');
            $this->ensureCurrencyCheck('external_debts', 'external_debts_currency_check');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'pgsql'], true)) {
            foreach ([
                'sales_currency_check',
                'purchases_currency_check',
                'customer_payments_currency_check',
                'supplier_payments_currency_check',
                'external_debts_currency_check',
            ] as $constraint) {
                try {
                    DB::statement("ALTER TABLE {$this->tableFromConstraint($constraint)} DROP CONSTRAINT {$constraint}");
                } catch (Throwable) {
                    // Constraint may already be absent.
                }
            }
        }

        foreach (['sales', 'purchases', 'customer_payments', 'supplier_payments', 'external_debts'] as $table) {
            if (Schema::hasColumn($table, 'currency')) {
                Schema::table($table, function (Blueprint $blueprint) use ($table) {
                    try {
                        $blueprint->dropIndex([$table === 'external_debts' ? 'currency' : 'currency']);
                    } catch (Throwable) {
                        // Index name can differ by driver; column drop still proceeds.
                    }
                    $blueprint->dropColumn('currency');
                });
            }
        }

        if (Schema::hasColumn('customers', 'balance_usd')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->dropColumn('balance_usd');
            });
        }

        if (Schema::hasColumn('suppliers', 'balance_usd')) {
            Schema::table('suppliers', function (Blueprint $table) {
                $table->dropColumn('balance_usd');
            });
        }
    }

    private function ensureCurrencyCheck(string $table, string $constraint): void
    {
        try {
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$constraint} CHECK (currency IN ('AFN', 'USD'))");
        } catch (Throwable) {
            // Already exists from a previous partial run.
        }
    }

    private function tableFromConstraint(string $constraint): string
    {
        return match ($constraint) {
            'sales_currency_check' => 'sales',
            'purchases_currency_check' => 'purchases',
            'customer_payments_currency_check' => 'customer_payments',
            'supplier_payments_currency_check' => 'supplier_payments',
            default => 'external_debts',
        };
    }
};
