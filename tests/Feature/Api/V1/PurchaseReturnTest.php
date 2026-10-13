<?php

namespace Tests\Feature\Api\V1;

use App\Models\Location;
use App\Models\ProductVariant;
use App\Models\PurchaseItem;
use App\Models\StockBalance;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PurchaseReturnTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_return_reduces_stock_and_supplier_balance(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $supplier = Supplier::factory()->create(['balance' => 0]);
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create(['base_unit' => 'kg']);

        $purchase = $this->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 10,
                    'unit_price' => 50,
                ],
            ],
        ])->assertCreated();

        $purchaseId = $purchase->json('data.id');
        $purchaseItemId = $purchase->json('data.items.0.id');
        $this->assertSame('500.00', $supplier->fresh()->balance);
        $this->assertSame(10.0, (float) StockBalance::query()->first()->quantity);

        $returnResponse = $this->postJson('/api/v1/purchase-returns', [
            'purchase_id' => $purchaseId,
            'items' => [
                [
                    'purchase_item_id' => $purchaseItemId,
                    'quantity' => 4,
                ],
            ],
        ]);

        $returnResponse->assertCreated()
            ->assertJsonPath('data.total_amount', '200.00')
            ->assertJsonPath('data.purchase_id', $purchaseId);

        $this->assertSame(6.0, (float) StockBalance::query()->first()->quantity);
        $this->assertSame('300.00', $supplier->fresh()->balance);
        $this->assertSame(4.0, (float) PurchaseItem::query()->find($purchaseItemId)->returned_quantity);
    }

    public function test_cannot_return_more_than_purchased(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();

        $purchase = $this->postJson('/api/v1/purchases', [
            'supplier_id' => Supplier::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 3,
                    'unit_price' => 10,
                ],
            ],
        ])->assertCreated();

        $this->postJson('/api/v1/purchase-returns', [
            'purchase_id' => $purchase->json('data.id'),
            'items' => [
                [
                    'purchase_item_id' => $purchase->json('data.items.0.id'),
                    'quantity' => 5,
                ],
            ],
        ])->assertStatus(422);
    }
}
