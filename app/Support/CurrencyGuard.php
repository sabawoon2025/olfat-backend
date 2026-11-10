<?php

namespace App\Support;

use App\Enums\Currency;
use App\Enums\ProductModule;
use App\Models\ProductVariant;
use InvalidArgumentException;

class CurrencyGuard
{
    public static function normalize(?string $currency): string
    {
        $value = strtoupper(trim((string) ($currency ?: Currency::Afn->value)));

        if (! in_array($value, Currency::values(), true)) {
            throw new InvalidArgumentException('Currency must be AFN or USD.');
        }

        return $value;
    }

    /**
     * @param  list<array{product_variant_id:int}>  $items
     */
    public static function assertTradeCurrencyAllowed(string $currency, array $items): void
    {
        $currency = self::normalize($currency);

        if ($currency === Currency::Afn->value) {
            return;
        }

        foreach ($items as $item) {
            $variant = ProductVariant::query()->with('product')->findOrFail($item['product_variant_id']);
            $module = $variant->product?->module;
            $moduleValue = $module instanceof ProductModule ? $module->value : (string) $module;

            if ($moduleValue !== ProductModule::Tea->value) {
                throw new InvalidArgumentException(
                    'USD is only allowed for tea sales and purchases. Remove non-tea products or use AFN.'
                );
            }
        }
    }

    public static function partyBalanceColumn(string $currency): string
    {
        return self::normalize($currency) === Currency::Usd->value ? 'balance_usd' : 'balance';
    }
}
