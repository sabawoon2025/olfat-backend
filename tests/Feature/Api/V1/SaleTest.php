<?php

namespace Tests\Feature\Api\V1;

use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Location;
use App\Models\ProductVariant;
use App\Models\StockBalance;
use App\Models\User;
use App\Services\Stock\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_sale_decreases_stock_and_increases_customer_receivable(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create(['balance' => 0]);
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create(['base_unit' => 'kg']);

        $this->seedStock($variant->id, $location->id, $user, 20);

        $response = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'paid_amount' => 50,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 5,
                    'unit_price' => 40,
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.total_amount', '200.00')
            ->assertJsonPath('data.paid_amount', '50.00')
            ->assertJsonPath('data.remaining_amount', '150.00')
            ->assertJsonPath('data.payment_type', 'mixed')
            ->assertJsonPath('data.user_id', $user->id);

        $this->assertMatchesRegularExpression(
            '/^INV-'.now()->format('Y').'-\d{4}$/',
            (string) $response->json('data.reference_no')
        );

        $this->assertDatabaseHas('stock_balances', [
            'product_variant_id' => $variant->id,
            'location_id' => $location->id,
            'quantity' => 15,
        ]);

        $this->assertSame('150.00', $customer->fresh()->balance);
    }

    public function test_cash_sale_does_not_change_customer_balance(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create(['balance' => 10]);
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();

        $this->seedStock($variant->id, $location->id, $user, 5);

        $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'paid_amount' => 100,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 2,
                    'unit_price' => 50,
                ],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.payment_type', 'cash')
            ->assertJsonPath('data.remaining_amount', '0.00');

        $this->assertSame('10.00', $customer->fresh()->balance);
    }

    public function test_sale_fails_when_stock_is_insufficient(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create(['name' => 'Kabul']);
        $variant = ProductVariant::factory()->create(['base_unit' => 'sacks']);
        $this->seedStock($variant->id, $location->id, $user, 2);

        $response = $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 5,
                    'unit_price' => 10,
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertStringContainsString('You have only 2 sacks in Kabul', (string) $response->json('message'));
        $this->assertSame(2.0, (float) StockBalance::query()->first()->quantity);
    }

    public function test_sale_cannot_use_stock_from_another_province(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $kabul = Location::factory()->create(['name' => 'Kabul']);
        $ghazni = Location::factory()->create(['name' => 'Ghazni']);
        $variant = ProductVariant::factory()->create(['base_unit' => 'sacks']);

        $this->seedStock($variant->id, $kabul->id, $user, 20);
        $this->seedStock($variant->id, $ghazni->id, $user, 30);

        $response = $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $kabul->id,
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 25,
                    'unit_price' => 10,
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
        $this->assertStringContainsString('You have only 20 sacks in Kabul', (string) $response->json('message'));

        $this->assertDatabaseHas('stock_balances', [
            'product_variant_id' => $variant->id,
            'location_id' => $kabul->id,
            'quantity' => 20,
        ]);
        $this->assertDatabaseHas('stock_balances', [
            'product_variant_id' => $variant->id,
            'location_id' => $ghazni->id,
            'quantity' => 30,
        ]);
    }

    public function test_frontend_totals_are_ignored(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();
        $this->seedStock($variant->id, $location->id, $user, 10);

        $response = $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $location->id,
            'total_amount' => 1,
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 3,
                    'unit_price' => 25,
                    'line_total' => 999,
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.total_amount', '75.00')
            ->assertJsonPath('data.payment_type', 'credit')
            ->assertJsonPath('data.items.0.line_total', '75.00');
    }

    public function test_can_list_and_show_sales(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();
        $this->seedStock($variant->id, $location->id, $user, 3);

        $create = $this->postJson('/api/v1/sales', [
            'customer_id' => Customer::factory()->create()->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 1,
                    'unit_price' => 12,
                ],
            ],
        ]);

        $create->assertCreated();
        $id = $create->json('data.id');

        $this->getJson('/api/v1/sales')->assertOk();

        // The show endpoint returns the flattened bill shape used by
        // public/pages/bill.html: customer/location/seller as display names,
        // *_raw numeric fields, and a flat items list.
        $this->getJson('/api/v1/sales/'.$id)
            ->assertOk()
            ->assertJsonPath('data.id', $id)
            ->assertJsonStructure(['data' => [
                'reference_no',
                'date',
                'customer',
                'customer_phone',
                'customer_address',
                'location',
                'seller',
                'payment_type',
                'total',
                'total_raw',
                'paid',
                'paid_raw',
                'remaining',
                'remaining_raw',
                'items',
            ]]);
    }

    private function seedStock(int $variantId, int $locationId, User $user, float $qty): void
    {
        app(StockService::class)->apply([
            'product_variant_id' => $variantId,
            'location_id' => $locationId,
            'type' => StockMovementType::Adjustment,
            'quantity_change' => $qty,
            'user' => $user,
            'notes' => 'test seed',
        ]);
    }
}
