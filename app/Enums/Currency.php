<?php

namespace App\Enums;

enum Currency: string
{
    case Afn = 'AFN';
    case Usd = 'USD';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
