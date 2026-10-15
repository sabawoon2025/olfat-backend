<?php

namespace App\Services\Purchase;

use App\Enums\StockMovementType;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\PurchaseReturn;
use App\Models\Supplier;
use App\Models\User;
use App\Services\Stock\StockService;
use App\Support\ProvinceScope;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class PurchaseReturnService
{
    private const DEADLOCK_RETRIES = 3;

    public function __construct(private readonly StockService $stockService) {}

    /**
     * @param  array{
     *     purchase_id:int,
     *     location_id?:int|null,
     *     user:User,
     *     returned_at?:\DateTimeInterface|string|null,
     *     notes?:string|null,
     *     items:list<array{purchase_item_id:int, quantity:float|string}>
     * }  $data
     */
    public function create(array $data): PurchaseReturn
    {
        if (empty($data['items'])) {
            throw new InvalidArgumentException('A purchase return must include at least one item.');
        }

        return DB::transaction(function () use ($data) {
            $purchase = Purchase::query()
                ->with('items')
                ->whereKey($data['purchase_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $locationId = (int) ($data['location_id'] ?? $purchase->location_id);
            if ($locationId !== (int) $purchase->location_id) {
                throw new InvalidArgumentException('Purchase returns must remove stock from the original purchase location.');
            }

            ProvinceScope::assertSameProvince(
                $data['user'] ?? null,
                (int) $purchase->location_id,
                'You can only return purchases from your own province.'
            );

            $totalAmount = 0.0;
            $normalizedItems = [];

            foreach ($data['items'] as $item) {
                /** @var PurchaseItem|null $purchaseItem */
                $purchaseItem = $purchase->items->firstWhere('id', (int) $item['purchase_item_id']);
                if (! $purchaseItem) {
                    throw new InvalidArgumentException('purchase_item_id does not belong to this purchase.');
                }

                $purchaseItem = PurchaseItem::query()->whereKey($purchaseItem->id)->lockForUpdate()->firstOrFail();

                $quantity = (float) $item['quantity'];
                if ($quantity <= 0) {
                    throw new InvalidArgumentException('Return quantity must be greater than zero.');
                }

                $returnable = (float) $purchaseItem->quantity - (float) $purchaseItem->returned_quantity;
                if ($quantity > $returnable + 0.00001) {
                    throw new InvalidArgumentException(
                        "Return quantity exceeds returnable quantity for purchase item {$purchaseItem->id}."
                    );
                }

                $lineTotal = round($quantity * (float) $purchaseItem->unit_price, 2);
                $totalAmount += $lineTotal;

                $normalizedItems[] = [
                    'purchase_item' => $purchaseItem,
                    'quantity' => $quantity,
                    'unit' => $purchaseItem->unit,
                    'unit_price' => (float) $purchaseItem->unit_price,
                    'line_total' => $lineTotal,
                ];
            }

            $totalAmount = round($totalAmount, 2);

            $purchaseReturn = PurchaseReturn::query()->create([
                'reference_no' => 'PRET-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'purchase_id' => $purchase->id,
                'supplier_id' => $purchase->supplier_id,
                'location_id' => $locationId,
                'user_id' => $data['user']->id,
                'total_amount' => $totalAmount,
                'returned_at' => $data['returned_at'] ?? now(),
                'notes' => $data['notes'] ?? null,
                'status' => 'posted',
            ]);

            foreach ($normalizedItems as $item) {
                /** @var PurchaseItem $purchaseItem */
                $purchaseItem = $item['purchase_item'];

                $purchaseReturn->items()->create([
                    'purchase_item_id' => $purchaseItem->id,
                    'product_variant_id' => $purchaseItem->product_variant_id,
                    'quantity' => $item['quantity'],
                    'unit' => $item['unit'],
                    'unit_price' => $item['unit_price'],
                    'line_total' => $item['line_total'],
                ]);

                $purchaseItem->returned_quantity = round((float) $purchaseItem->returned_quantity + $item['quantity'], 4);
                $purchaseItem->save();

                $this->stockService->apply([
                    'product_variant_id' => $purchaseItem->product_variant_id,
                    'location_id' => $locationId,
                    'type' => StockMovementType::PurchaseReturn,
                    'quantity_change' => -1 * $item['quantity'],
                    'unit' => $item['unit'],
                    'quantity_in_unit' => $item['quantity'],
                    'user' => $data['user'],
                    'notes' => 'Purchase return '.$purchaseReturn->reference_no,
                    'occurred_at' => $purchaseReturn->returned_at,
                    'reference_type' => PurchaseReturn::class,
                    'reference_id' => $purchaseReturn->id,
                ]);
            }

            // Reverse payable first, then paid cash portion on the original purchase.
            $fromRemaining = min($totalAmount, round((float) $purchase->remaining_amount, 2));
            $fromPaid = round($totalAmount - $fromRemaining, 2);

            $purchase->remaining_amount = round((float) $purchase->remaining_amount - $fromRemaining, 2);
            $purchase->paid_amount = round(max(0, (float) $purchase->paid_amount - $fromPaid), 2);
            $purchase->total_amount = round(max(0, (float) $purchase->total_amount - $totalAmount), 2);
            $purchase->save();

            $supplier = Supplier::query()
                ->whereKey($purchase->supplier_id)
                ->lockForUpdate()
                ->firstOrFail();

            // Only reverse what was previously booked as payable.
            $supplier->balance = round((float) $supplier->balance - $fromRemaining, 2);
            $supplier->save();

            return $purchaseReturn->load(['items.variant.product', 'purchase', 'supplier', 'location', 'user']);
        }, attempts: self::DEADLOCK_RETRIES);
    }
}
