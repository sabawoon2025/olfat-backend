<?php

namespace App\Models;

use App\Support\InvoiceProfile;
use Database\Factories\LocationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['name', 'code', 'is_active', 'invoice_profile'])]
class Location extends Model
{
    /** @use HasFactory<LocationFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'invoice_profile' => 'array',
        ];
    }

    /**
     * Non-empty invoice branding fields for this branch.
     *
     * @return array<string, string>
     */
    public function compactInvoiceProfile(): array
    {
        return InvoiceProfile::compact($this->invoice_profile);
    }

    public function user(): HasOne
    {
        return $this->hasOne(User::class);
    }

    public function stockBalances(): HasMany
    {
        return $this->hasMany(StockBalance::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
