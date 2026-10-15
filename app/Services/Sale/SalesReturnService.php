<?php

namespace App\Services\Sale;

use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\SalesReturn;
use App\Models\User;
use App\Services\Stock\StockService;
use App\Support\ProvinceScope;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class SalesReturnService
{
    /** Retries for the whole unit of work when the DBMS reports a deadlock. */
    private const DEADLOCK_RETRIES = 3;

    public function __construct(private readonly StockService $stockService) {}

    /**
     * @param  array{
     *     sale_id:int,
     *     location_id?:int|null,
     *     user:User,
     *     returned_at?:\DateTimeInterface|string|null,
     *     notes?:string|null,
     *     items:list<array{sale_item_id:int, quantity:float|string}>
     * }  $data
     */
    public function create(array $data): SalesReturn
    {
        if (empty($data['items'])) {
            throw new InvalidArgumentException('A sales return must include at least one item.');
        }

        return DB::transaction(function () use ($data) {
            $sale = Sale::query()
                ->with('items')
                ->whereKey($data['sale_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $locationId = (int) ($data['location_id'] ?? $sale->location_id);
            if ($locationId !== (int) $sale->location_id) {
                throw new InvalidArgumentException('Sales returns must restock at the original sale location.');
            }

            ProvinceScope::assertSameProvince(
                $data['user'] ?? null,
                (int) $sale->location_id,
                'You can only return sales from your own province.'
            );

            $totalAmount = 0.0;
            $normalizedItems = [];

            foreach ($data['items'] as $item) {
                /** @var SaleItem|null $saleItem */
                $saleItem = $sale->items->firstWhere('id', (int) $item['sale_item_id']);
                if (! $saleItem) {
                    throw new InvalidArgumentException('sale_item_id does not belong to this sale.');
                }

                $saleItem = SaleItem::query()->whereKey($saleItem->id)->lockForUpdate()->firstOrFail();

                $quantity = (float) $item['quantity'];
                if ($quantity <= 0) {
                    throw new InvalidArgumentException('Return quantity must be greater than zero.');
                }

                $returnable = (float) $saleItem->quantity - (float) $saleItem->returned_quantity;
                if ($quantity > $returnable + 0.00001) {
                    throw new InvalidArgumentException(
                        "Return quantity exceeds returnable quantity for sale item {$saleItem->id}."
                    );
                }

                $lineTotal = round($quantity * (float) $saleItem->unit_price, 2);
                $totalAmount += $lineTotal;

                $normalizedItems[] = [
                    'sale_item' => $saleItem,
                    'quantity' => $quantity,
                    'unit' => $saleItem->unit,
                    'unit_price' => (float) $saleItem->unit_price,
                    'line_total' => $lineTotal,
                ];
            }

            $totalAmount = round($totalAmount, 2);

            $salesReturn = SalesReturn::query()->create([
                'reference_no' => 'SRET-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'sale_id' => $sale->id,
                'customer_id' => $sale->customer_id,
                'location_id' => $locationId,
                'user_id' => $data['user']->id,
                'total_amount' => $totalAmount,
                'returned_at' => $data['returned_at'] ?? now(),
                'notes' => $data['notes'] ?? null,
                'status' => 'posted',
            ]);

            foreach ($normalizedItems as $item) {
                /** @var SaleItem $saleItem */
                $saleItem = $item['sale_item'];

                $salesReturn->items()->create([
                    'sale_item_id' => $saleItem->id,
                    'product_variant_id' => $saleItem->product_variant_id,
                    'quantity' => $item['quantity'],
                    'unit' => $item['unit'],
                    'unit_price' => $item['unit_price'],
                    'line_total' => $item['line_total'],
                ]);

                $saleItem->returned_quantity = round((float) $saleItem->returned_quantity + $item['quantity'], 4);
                $saleItem->save();

                $this->stockService->apply([
                    'product_variant_id' => $saleItem->product_variant_id,
                    'location_id' => $locationId,
                    'type' => StockMovementType::SaleReturn,
                    'quantity_change' => $item['quantity'],
                    'unit' => $item['unit'],
                    'quantity_in_unit' => $item['quantity'],
                    'user' => $data['user'],
                    'notes' => 'Sales return '.$salesReturn->reference_no,
                    'occurred_at' => $salesReturn->returned_at,
                    'reference_type' => SalesReturn::class,
                    'reference_id' => $salesReturn->id,
                ]);
            }

            // Reverse receivable first, then paid cash portion on the original sale.
            $fromRemaining = min($totalAmount, round((float) $sale->remaining_amount, 2));
            $fromPaid = round($totalAmount - $fromRemaining, 2);

            $sale->remaining_amount = round((float) $sale->remaining_amount - $fromRemaining, 2);
            $sale->paid_amount = round(max(0, (float) $sale->paid_amount - $fromPaid), 2);
            $sale->total_amount = round(max(0, (float) $sale->total_amount - $totalAmount), 2);
            $sale->payment_type = $this->resolvePaymentType(
                (float) $sale->paid_amount,
                (float) $sale->remaining_amount
            );
            $sale->save();

            $customer = Customer::query()
                ->whereKey($sale->customer_id)
                ->lockForUpdate()
                ->firstOrFail();

            // Only reverse what was previously booked as receivable.
            $customer->balance = round((float) $customer->balance - $fromRemaining, 2);
            $customer->save();

            return $salesReturn->load(['items.variant.product', 'sale', 'customer', 'location', 'user']);
        }, attempts: self::DEADLOCK_RETRIES);
    }

    private function resolvePaymentType(float $paid, float $remaining): string
    {
        if ($remaining <= 0) {
            return 'cash';
        }
        if ($paid <= 0) {
            return 'credit';
        }

        return 'mixed';
    }
}
