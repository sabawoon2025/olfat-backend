<?php

namespace App\Support;

use App\Enums\Currency;
use App\Models\Customer;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;

/**
 * Rebuild denormalized party balances from open document remainings.
 * Documents stay the source of truth; balances are a cached projection.
 */
class PartyBalanceSync
{
    public static function rebuildCustomer(int $customerId): void
    {
        $customer = Customer::query()->whereKey($customerId)->lockForUpdate()->firstOrFail();

        $afn = round((float) Sale::query()
            ->where('customer_id', $customerId)
            ->where(function ($q) {
                $q->where('currency', Currency::Afn->value)->orWhereNull('currency');
            })
            ->sum('remaining_amount'), 2);

        $usd = round((float) Sale::query()
            ->where('customer_id', $customerId)
            ->where('currency', Currency::Usd->value)
            ->sum('remaining_amount'), 2);

        $customer->balance = $afn;
        $customer->balance_usd = $usd;
        $customer->save();
    }

    public static function rebuildSupplier(int $supplierId): void
    {
        $supplier = Supplier::query()->whereKey($supplierId)->lockForUpdate()->firstOrFail();

        $afn = round((float) Purchase::query()
            ->where('supplier_id', $supplierId)
            ->where(function ($q) {
                $q->where('currency', Currency::Afn->value)->orWhereNull('currency');
            })
            ->sum('remaining_amount'), 2);

        $usd = round((float) Purchase::query()
            ->where('supplier_id', $supplierId)
            ->where('currency', Currency::Usd->value)
            ->sum('remaining_amount'), 2);

        $supplier->balance = $afn;
        $supplier->balance_usd = $usd;
        $supplier->save();
    }

    /**
     * If cached party balances drifted from document remainings, rebuild them.
     */
    public static function healIfDrifted(float $tolerance = 0.01): bool
    {
        $salesAfn = round((float) Sale::query()
            ->where(function ($q) {
                $q->where('currency', Currency::Afn->value)->orWhereNull('currency');
            })
            ->sum('remaining_amount'), 2);
        $salesUsd = round((float) Sale::query()
            ->where('currency', Currency::Usd->value)
            ->sum('remaining_amount'), 2);
        $purchasesAfn = round((float) Purchase::query()
            ->where(function ($q) {
                $q->where('currency', Currency::Afn->value)->orWhereNull('currency');
            })
            ->sum('remaining_amount'), 2);
        $purchasesUsd = round((float) Purchase::query()
            ->where('currency', Currency::Usd->value)
            ->sum('remaining_amount'), 2);

        $customersAfn = round((float) Customer::query()->sum('balance'), 2);
        $customersUsd = round((float) Customer::query()->sum('balance_usd'), 2);
        $suppliersAfn = round((float) Supplier::query()->sum('balance'), 2);
        $suppliersUsd = round((float) Supplier::query()->sum('balance_usd'), 2);

        $customerDrift = abs($salesAfn - $customersAfn) > $tolerance
            || abs($salesUsd - $customersUsd) > $tolerance;
        $supplierDrift = abs($purchasesAfn - $suppliersAfn) > $tolerance
            || abs($purchasesUsd - $suppliersUsd) > $tolerance;

        if (! $customerDrift && ! $supplierDrift) {
            return false;
        }

        DB::transaction(function () use ($customerDrift, $supplierDrift): void {
            if ($customerDrift) {
                Customer::query()->orderBy('id')->pluck('id')->each(
                    fn ($id) => self::rebuildCustomer((int) $id)
                );
            }

            if ($supplierDrift) {
                Supplier::query()->orderBy('id')->pluck('id')->each(
                    fn ($id) => self::rebuildSupplier((int) $id)
                );
            }
        });

        return true;
    }
}
