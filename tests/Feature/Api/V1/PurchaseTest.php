<?php

namespace Tests\Feature\Api\V1;

use App\Models\Location;
use App\Models\ProductVariant;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PurchaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_purchase_increases_stock_and_supplier_payable(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $supplier = Supplier::factory()->create(['balance' => 0]);
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create(['base_unit' => 'kg']);

        $response = $this->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'location_id' => $location->id,
            'paid_amount' => 100,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 10,
                    'unit_price' => 50,
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_amount', '500.00')
            ->assertJsonPath('data.paid_amount', '100.00')
            ->assertJsonPath('data.remaining_amount', '400.00')
            ->assertJsonPath('data.user_id', $user->id);

        $this->assertDatabaseHas('stock_balances', [
            'product_variant_id' => $variant->id,
            'location_id' => $location->id,
            'quantity' => 10,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $variant->id,
            'location_id' => $location->id,
            'type' => 'purchase',
            'quantity_change' => 10,
            'user_id' => $user->id,
        ]);

        $this->assertSame('400.00', $supplier->fresh()->balance);
    }

    public function test_fully_paid_purchase_does_not_increase_supplier_balance(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $supplier = Supplier::factory()->create(['balance' => 25]);
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();

        $this->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'location_id' => $location->id,
            'paid_amount' => 200,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 4,
                    'unit_price' => 50,
                ],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.remaining_amount', '0.00');

        // Party balances are rebuilt from open purchase remainings (fully paid => 0).
        $this->assertSame('0.00', $supplier->fresh()->balance);
        $this->assertSame(1, StockMovement::query()->where('type', 'purchase')->count());
        $this->assertSame(4.0, (float) StockBalance::query()->first()->quantity);
    }

    public function test_frontend_total_is_ignored_backend_calculates(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $supplier = Supplier::factory()->create();
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();

        $response = $this->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'location_id' => $location->id,
            'total_amount' => 1,
            'remaining_amount' => 1,
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 2,
                    'unit_price' => 30,
                    'line_total' => 999,
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.total_amount', '60.00')
            ->assertJsonPath('data.remaining_amount', '60.00')
            ->assertJsonPath('data.items.0.line_total', '60.00');
    }

    public function test_paid_amount_cannot_exceed_total(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/v1/purchases', [
            'supplier_id' => Supplier::factory()->create()->id,
            'location_id' => Location::factory()->create()->id,
            'paid_amount' => 1000,
            'items' => [
                [
                    'product_variant_id' => ProductVariant::factory()->create()->id,
                    'quantity' => 1,
                    'unit_price' => 50,
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_can_list_and_show_purchases(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $create = $this->postJson('/api/v1/purchases', [
            'supplier_id' => Supplier::factory()->create()->id,
            'location_id' => Location::factory()->create()->id,
            'items' => [
                [
                    'product_variant_id' => ProductVariant::factory()->create()->id,
                    'quantity' => 1,
                    'unit_price' => 10,
                ],
            ],
        ]);

        $create->assertCreated();
        $id = $create->json('data.id');

        $this->getJson('/api/v1/purchases')->assertOk()->assertJsonPath('success', true);
        $this->getJson('/api/v1/purchases/'.$id)
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonStructure(['data' => ['items', 'supplier', 'location', 'user']]);
    }
}
