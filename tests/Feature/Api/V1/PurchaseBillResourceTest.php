<?php

namespace Tests\Feature\Api\V1;

use App\Models\Location;
use App\Models\ProductVariant;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PurchaseBillResourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_show_includes_previous_unpaid_from_earlier_credit_purchases(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $supplier = Supplier::factory()->create(['name' => 'Kabul Supplies']);
        $location = Location::factory()->create(['name' => 'Kabul']);
        $variant = ProductVariant::factory()->create(['name' => '20kg']);

        $first = $this->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'location_id' => $location->id,
            'paid_amount' => 0,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 2, 'unit_price' => 50],
            ],
        ])->assertCreated()->json('data');

        $second = $this->postJson('/api/v1/purchases', [
            'supplier_id' => $supplier->id,
            'location_id' => $location->id,
            'paid_amount' => 20,
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 1, 'unit_price' => 40],
            ],
        ])->assertCreated()->json('data');

        $this->getJson('/api/v1/purchases/'.$second['id'])
            ->assertOk()
            ->assertJsonPath('data.kind', 'purchase')
            ->assertJsonPath('data.supplier', 'Kabul Supplies')
            ->assertJsonPath('data.customer', 'Kabul Supplies')
            ->assertJsonPath('data.total_raw', 40)
            ->assertJsonPath('data.paid_raw', 20)
            ->assertJsonPath('data.remaining_raw', 20)
            ->assertJsonPath('data.previous_unpaid_raw', 100)
            ->assertJsonPath('data.previous_unpaid_afn_raw', 100)
            ->assertJsonPath('data.previous_unpaid_usd_raw', 0)
            ->assertJsonPath('data.total_outstanding_raw', 120)
            ->assertJsonPath('data.total_outstanding_afn_raw', 120)
            ->assertJsonPath('data.total_outstanding_usd_raw', 0);

        $this->getJson('/api/v1/purchases/'.$first['id'])
            ->assertOk()
            ->assertJsonPath('data.previous_unpaid_raw', 20)
            ->assertJsonPath('data.previous_unpaid_afn_raw', 20)
            ->assertJsonPath('data.previous_unpaid_usd_raw', 0);
    }
}
