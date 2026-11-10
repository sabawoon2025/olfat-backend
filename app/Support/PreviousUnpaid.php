<?php

namespace App\Support;

use App\Enums\Currency;
use App\Models\Purchase;
use App\Models\Sale;
use Illuminate\Database\Eloquent\Builder;

class PreviousUnpaid
{
    /**
     * AFN and USD previous unpaid balances for this customer in the sale province.
     * Currencies are never mixed into one number.
     *
     * @return array{afn: float, usd: float, matching: float}
     */
    public static function forSale(Sale $sale): array
    {
        $afn = self::sumSales($sale, Currency::Afn->value);
        $usd = self::sumSales($sale, Currency::Usd->value);
        $matching = CurrencyGuard::normalize($sale->currency ?: Currency::Afn->value) === Currency::Usd->value
            ? $usd
            : $afn;

        return [
            'afn' => $afn,
            'usd' => $usd,
            'matching' => $matching,
        ];
    }

    /**
     * AFN and USD previous unpaid balances for this supplier in the purchase province.
     * Currencies are never mixed into one number.
     *
     * @return array{afn: float, usd: float, matching: float}
     */
    public static function forPurchase(Purchase $purchase): array
    {
        $afn = self::sumPurchases($purchase, Currency::Afn->value);
        $usd = self::sumPurchases($purchase, Currency::Usd->value);
        $matching = CurrencyGuard::normalize($purchase->currency ?: Currency::Afn->value) === Currency::Usd->value
            ? $usd
            : $afn;

        return [
            'afn' => $afn,
            'usd' => $usd,
            'matching' => $matching,
        ];
    }

    private static function sumSales(Sale $sale, string $currency): float
    {
        return round((float) self::applyCurrency(
            Sale::query()
                ->where('customer_id', $sale->customer_id)
                ->where('location_id', $sale->location_id)
                ->whereKeyNot($sale->id)
                ->where('remaining_amount', '>', 0),
            $currency
        )->sum('remaining_amount'), 2);
    }

    private static function sumPurchases(Purchase $purchase, string $currency): float
    {
        return round((float) self::applyCurrency(
            Purchase::query()
                ->where('supplier_id', $purchase->supplier_id)
                ->where('location_id', $purchase->location_id)
                ->whereKeyNot($purchase->id)
                ->where('remaining_amount', '>', 0),
            $currency
        )->sum('remaining_amount'), 2);
    }

    /**
     * @param  Builder<Sale>|Builder<Purchase>  $query
     * @return Builder<Sale>|Builder<Purchase>
     */
    private static function applyCurrency(Builder $query, string $currency): Builder
    {
        $normalized = CurrencyGuard::normalize($currency);

        if ($normalized === Currency::Usd->value) {
            return $query->where('currency', Currency::Usd->value);
        }

        return $query->where(function (Builder $inner): void {
            $inner->where('currency', Currency::Afn->value)->orWhereNull('currency');
        });
    }
}
