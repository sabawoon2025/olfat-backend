<?php

namespace App\Services\Purchase;

use App\Enums\StockMovementType;
use App\Models\ProductVariant;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\Supplier;
use App\Models\User;
use App\Services\Stock\StockService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class PurchaseService
{
    /** Retries for the whole unit of work when the DBMS reports a deadlock. */
    private const DEADLOCK_RETRIES = 3;

    public function __construct(private readonly StockService $stockService) {}

    /**
     * @param  array{
     *     supplier_id:int,
     *     location_id:int,
     *     user:User,
     *     purchased_at?:\DateTimeInterface|string|null,
     *     paid_amount?:float|string|null,
     *     notes?:string|null,
     *     items:list<array{product_variant_id:int, quantity:float|string, unit?:string|null, unit_price:float|string}>
     * }  $data
     */
    public function create(array $data): Purchase
    {
        if (empty($data['items'])) {
            throw new InvalidArgumentException('A purchase must include at least one item.');
        }

        return DB::transaction(function () use ($data) {
            $paidAmount = round((float) ($data['paid_amount'] ?? 0), 2);
            if ($paidAmount < 0) {
                throw new InvalidArgumentException('paid_amount cannot be negative.');
            }

            $totalAmount = 0.0;
            $normalizedItems = [];

            foreach ($data['items'] as $item) {
                $variant = ProductVariant::query()->with('product')->findOrFail($item['product_variant_id']);
                if ($variant->product && $variant->product->is_active === false) {
                    throw new InvalidArgumentException(
                        'Cannot purchase inactive product: '.($variant->product->name ?: '#'.$variant->product_id)
                    );
                }
                $quantity = (float) $item['quantity'];
                $unitPrice = (float) $item['unit_price'];

                if ($quantity <= 0) {
                    throw new InvalidArgumentException('Item quantity must be greater than zero.');
                }
                if ($unitPrice < 0) {
                    throw new InvalidArgumentException('Item unit_price cannot be negative.');
                }

                $lineTotal = round($quantity * $unitPrice, 2);
                $totalAmount += $lineTotal;

                $normalizedItems[] = [
                    'product_variant_id' => $variant->id,
                    'quantity' => $quantity,
                    'unit' => $item['unit'] ?? $variant->base_unit,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            }

            $totalAmount = round($totalAmount, 2);
            if ($paidAmount > $totalAmount) {
                throw new InvalidArgumentException('paid_amount cannot exceed total_amount.');
            }

            $remainingAmount = round($totalAmount - $paidAmount, 2);

            $purchase = Purchase::query()->create([
                'reference_no' => $this->nextReference(),
                'supplier_id' => $data['supplier_id'],
                'location_id' => $data['location_id'],
                'user_id' => $data['user']->id,
                'purchased_at' => $data['purchased_at'] ?? now(),
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'status' => 'posted',
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($normalizedItems as $item) {
                /** @var PurchaseItem $purchaseItem */
                $purchaseItem = $purchase->items()->create($item);

                $this->stockService->apply([
                    'product_variant_id' => $purchaseItem->product_variant_id,
                    'location_id' => $purchase->location_id,
                    'type' => StockMovementType::Purchase,
                    'quantity_change' => (float) $purchaseItem->quantity,
                    'unit' => $purchaseItem->unit,
                    'quantity_in_unit' => (float) $purchaseItem->quantity,
                    'user' => $data['user'],
                    'notes' => 'Purchase '.$purchase->reference_no,
                    'occurred_at' => $purchase->purchased_at,
                    'reference_type' => Purchase::class,
                    'reference_id' => $purchase->id,
                ]);
            }

            if ($remainingAmount > 0) {
                $supplier = Supplier::query()
                    ->whereKey($purchase->supplier_id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $supplier->balance = round((float) $supplier->balance + $remainingAmount, 2);
                $supplier->save();
            }

            return $purchase->load(['items.variant.product', 'supplier', 'location', 'user']);
        }, attempts: self::DEADLOCK_RETRIES);
    }

    private function nextReference(): string
    {
        return 'PUR-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
    }
}
