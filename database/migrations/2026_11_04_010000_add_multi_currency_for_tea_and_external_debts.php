<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('currency', 3)->default('AFN')->after('notes');
            $table->index('currency');
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->string('currency', 3)->default('AFN')->after('notes');
            $table->index('currency');
        });

        Schema::table('customer_payments', function (Blueprint $table) {
            $table->string('currency', 3)->default('AFN')->after('notes');
            $table->index('currency');
        });

        Schema::table('supplier_payments', function (Blueprint $table) {
            $table->string('currency', 3)->default('AFN')->after('notes');
            $table->index('currency');
        });

        Schema::table('external_debts', function (Blueprint $table) {
            $table->string('currency', 3)->default('AFN')->after('status');
            $table->index('currency');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->decimal('balance_usd', 15, 2)->default(0)->after('balance');
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->decimal('balance_usd', 15, 2)->default(0)->after('balance');
        });

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'pgsql'], true)) {
            DB::statement("ALTER TABLE sales ADD CONSTRAINT sales_currency_check CHECK (currency IN ('AFN', 'USD'))");
            DB::statement("ALTER TABLE purchases ADD CONSTRAINT purchases_currency_check CHECK (currency IN ('AFN', 'USD'))");
            DB::statement("ALTER TABLE customer_payments ADD CONSTRAINT customer_payments_currency_check CHECK (currency IN ('AFN', 'USD'))");
            DB::statement("ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_currency_check CHECK (currency IN ('AFN', 'USD'))");
            DB::statement("ALTER TABLE external_debts ADD CONSTRAINT external_debts_currency_check CHECK (currency IN ('AFN', 'USD'))");
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'pgsql'], true)) {
            DB::statement('ALTER TABLE sales DROP CONSTRAINT sales_currency_check');
            DB::statement('ALTER TABLE purchases DROP CONSTRAINT purchases_currency_check');
            DB::statement('ALTER TABLE customer_payments DROP CONSTRAINT customer_payments_currency_check');
            DB::statement('ALTER TABLE supplier_payments DROP CONSTRAINT supplier_payments_currency_check');
            DB::statement('ALTER TABLE external_debts DROP CONSTRAINT external_debts_currency_check');
        }

        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex(['currency']);
            $table->dropColumn('currency');
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->dropIndex(['currency']);
            $table->dropColumn('currency');
        });

        Schema::table('customer_payments', function (Blueprint $table) {
            $table->dropIndex(['currency']);
            $table->dropColumn('currency');
        });

        Schema::table('supplier_payments', function (Blueprint $table) {
            $table->dropIndex(['currency']);
            $table->dropColumn('currency');
        });

        Schema::table('external_debts', function (Blueprint $table) {
            $table->dropIndex(['currency']);
            $table->dropColumn('currency');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('balance_usd');
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('balance_usd');
        });
    }
};
