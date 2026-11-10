<?php

namespace App\Models;

use App\Enums\ExternalDebtDirection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'reference_no',
    'external_party_id',
    'direction',
    'reason',
    'original_amount',
    'paid_amount',
    'remaining_amount',
    'location_id',
    'user_id',
    'opened_at',
    'notes',
    'status',
    'currency',
])]
class ExternalDebt extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'direction' => ExternalDebtDirection::class,
            'original_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
            'opened_at' => 'datetime',
        ];
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(ExternalParty::class, 'external_party_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ExternalDebtPayment::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
