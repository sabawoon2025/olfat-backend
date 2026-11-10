<?php

namespace Tests\Feature\Api\V1;

use App\Enums\StockMovementType;
use App\Models\Customer;
use App\Models\Location;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\Stock\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SaleBillResourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_show_returns_flattened_bill_shape_with_names_and_raw_amounts(): void
    {
        $user = User::factory()->create(['name' => 'Fatima Saleh']);
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create([
            'name' => 'Ahmad Karimi',
            'phone' => '0700000001',
            'address' => 'Kabul, Afghanistan',
        ]);
        $location = Location::factory()->create(['name' => 'Kabul', 'code' => 'kbl']);
        $variant = ProductVariant::factory()->create([
            'name' => '20kg',
            'base_unit' => 'kg',
        ]);

        $this->seedStock($variant->id, $location->id, $user, 10);

        $create = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'paid_amount' => 50,
            'notes' => 'Delivered at the shop.',
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 2,
                    'unit_price' => 100,
                ],
            ],
        ]);

        $create->assertCreated();
        $saleId = $create->json('data.id');

        $response = $this->getJson('/api/v1/sales/'.$saleId);

        $response->assertOk()
            ->assertJsonPath('data.id', $saleId)
            ->assertJsonPath('data.customer', 'Ahmad Karimi')
            ->assertJsonPath('data.customer_phone', '0700000001')
            ->assertJsonPath('data.customer_address', 'Kabul, Afghanistan')
            ->assertJsonPath('data.location', 'Kabul')
            ->assertJsonPath('data.location_code', 'kbl')
            ->assertJsonPath('data.seller', 'Fatima Saleh')
            ->assertJsonPath('data.payment_type', 'mixed')
            ->assertJsonPath('data.notes', 'Delivered at the shop.')
            ->assertJsonPath('data.total', '200.00')
            ->assertJsonPath('data.total_raw', 200)
            ->assertJsonPath('data.paid', '50.00')
            ->assertJsonPath('data.paid_raw', 50)
            ->assertJsonPath('data.remaining', '150.00')
            ->assertJsonPath('data.remaining_raw', 150)
            ->assertJsonPath('data.items.0.variant', '20kg')
            ->assertJsonPath('data.items.0.unit', 'kg')
            ->assertJsonPath('data.items.0.quantity_raw', 2)
            ->assertJsonPath('data.items.0.unit_price_raw', 100)
            ->assertJsonPath('data.items.0.line_total_raw', 200);
    }

    public function test_show_includes_previous_unpaid_from_earlier_credit_sales(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create(['name' => 'Repeat Buyer']);
        $location = Location::factory()->create(['name' => 'Kabul']);
        $variant = ProductVariant::factory()->create(['name' => '20kg']);
        $this->seedStock($variant->id, $location->id, $user, 50);

        $first = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 2, 'unit_price' => 50],
            ],
        ])->assertCreated()->json('data');

        $second = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'paid_amount' => 10,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 1, 'unit_price' => 40],
            ],
        ])->assertCreated()->json('data');

        $this->getJson('/api/v1/sales/'.$second['id'])
            ->assertOk()
            ->assertJsonPath('data.kind', 'sale')
            ->assertJsonPath('data.total_raw', 40)
            ->assertJsonPath('data.paid_raw', 10)
            ->assertJsonPath('data.remaining_raw', 30)
            ->assertJsonPath('data.previous_unpaid_raw', 100)
            ->assertJsonPath('data.previous_unpaid_afn_raw', 100)
            ->assertJsonPath('data.previous_unpaid_usd_raw', 0)
            ->assertJsonPath('data.total_outstanding_raw', 130)
            ->assertJsonPath('data.total_outstanding_afn_raw', 130)
            ->assertJsonPath('data.total_outstanding_usd_raw', 0);

        $this->getJson('/api/v1/sales/'.$first['id'])
            ->assertOk()
            ->assertJsonPath('data.previous_unpaid_raw', 30)
            ->assertJsonPath('data.previous_unpaid_afn_raw', 30)
            ->assertJsonPath('data.previous_unpaid_usd_raw', 0);
    }

    public function test_show_keeps_afn_and_usd_previous_unpaid_separate(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $customer = Customer::factory()->create();
        $location = Location::factory()->create();
        $variant = ProductVariant::factory()->create();
        $this->seedStock($variant->id, $location->id, $user, 100);

        $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'currency' => 'AFN',
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 2, 'unit_price' => 50],
            ],
        ])->assertCreated();

        $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'currency' => 'USD',
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 1, 'unit_price' => 20],
            ],
        ])->assertCreated();

        $usdBill = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'currency' => 'USD',
            'paid_amount' => 5,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 1, 'unit_price' => 15],
            ],
        ])->assertCreated()->json('data');

        $this->getJson('/api/v1/sales/'.$usdBill['id'])
            ->assertOk()
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.remaining_raw', 10)
            ->assertJsonPath('data.previous_unpaid_afn_raw', 100)
            ->assertJsonPath('data.previous_unpaid_usd_raw', 20)
            ->assertJsonPath('data.previous_unpaid_raw', 20)
            ->assertJsonPath('data.total_outstanding_afn_raw', 100)
            ->assertJsonPath('data.total_outstanding_usd_raw', 30)
            ->assertJsonPath('data.total_outstanding_raw', 30);
    }

    public function test_show_returns_404_for_missing_sale(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/sales/999999')->assertNotFound();
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
