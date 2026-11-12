<?php

namespace App\Support;

use App\Enums\Currency;
use App\Models\Customer;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Supplier;

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
}
