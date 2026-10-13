<?php

namespace App\Enums;

enum StockMovementType: string
{
    case Purchase = 'purchase';
    case PurchaseReturn = 'purchase_return';
    case Sale = 'sale';
    case SaleReturn = 'sale_return';
    case Damage = 'damage';
    case Adjustment = 'adjustment';
    case TransferIn = 'transfer_in';
    case TransferOut = 'transfer_out';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
