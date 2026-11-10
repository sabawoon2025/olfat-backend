<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;

class ProvinceScope
{
    /**
     * API path prefixes (under /api/v1) where writes must use the user's province.
     *
     * @var list<string>
     */
    public const SCOPED_PREFIXES = [
        'sales',
        'purchases',
        'customer-payments',
        'supplier-payments',
        'sales-returns',
        'purchase-returns',
        'damaged-stocks',
        'stock/adjustments',
        'worker-payments',
        'external-debts',
    ];

    public static function isScopedWrite(Request $request): bool
    {
        if (! in_array(strtoupper($request->method()), ['POST', 'PUT', 'PATCH'], true)) {
            return false;
        }

        $path = trim($request->path(), '/');
        if (str_starts_with($path, 'api/v1/')) {
            $path = substr($path, strlen('api/v1/'));
        }

        foreach (self::SCOPED_PREFIXES as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                return true;
            }
        }

        return false;
    }

    public static function userLocationId(?User $user): ?int
    {
        if (! $user || $user->location_id === null) {
            return null;
        }

        return (int) $user->location_id;
    }

    public static function assertSameProvince(?User $user, ?int $locationId, string $message = 'You can only work in your own province.'): void
    {
        $userLocationId = self::userLocationId($user);
        if ($userLocationId === null || $locationId === null) {
            return;
        }

        if ($userLocationId !== (int) $locationId) {
            throw new \InvalidArgumentException($message);
        }
    }
}
