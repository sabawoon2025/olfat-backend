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

class LocationInvoiceProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_location_invoice_profile_can_be_saved_and_returned(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $location = Location::factory()->create([
            'name' => 'Kabul',
            'code' => 'kabul',
        ]);

        $profile = [
            'legal_name' => 'Olfat Trading — Kabul',
            'tagline' => 'Kabul Branch Invoice',
            'logo_url' => '/assets/images/logo.svg',
            'phone' => '0700111222',
            'whatsapp' => '93700111222',
            'address_line1' => 'Kabul Main Shop',
            'footer_note' => 'Thank you from Kabul.',
            'terms' => 'Returns within 48 hours.',
        ];

        $response = $this->putJson('/api/v1/locations/'.$location->id, [
            'invoice_profile' => $profile,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.invoice_profile.legal_name', 'Olfat Trading — Kabul')
            ->assertJsonPath('data.invoice_profile.whatsapp', '93700111222')
            ->assertJsonPath('data.invoice_profile.footer_note', 'Thank you from Kabul.');

        $this->assertDatabaseHas('locations', [
            'id' => $location->id,
        ]);

        $location->refresh();
        $this->assertSame('Olfat Trading — Kabul', $location->invoice_profile['legal_name'] ?? null);
        $this->assertSame('93700111222', $location->invoice_profile['whatsapp'] ?? null);
    }

    public function test_sale_show_includes_compact_location_invoice_profile(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $location = Location::factory()->create([
            'name' => 'Kabul',
            'code' => 'kabul',
            'invoice_profile' => [
                'legal_name' => 'Olfat Trading — Kabul',
                'whatsapp' => '93700111222',
                'phone' => '',
                'footer_note' => 'Kabul thanks you.',
            ],
        ]);
        $customer = Customer::factory()->create(['phone' => '0700000001']);
        $variant = ProductVariant::factory()->create();

        app(StockService::class)->apply([
            'product_variant_id' => $variant->id,
            'location_id' => $location->id,
            'type' => StockMovementType::Adjustment,
            'quantity_change' => 10,
            'user' => $user,
            'notes' => 'test seed',
        ]);

        $create = $this->postJson('/api/v1/sales', [
            'customer_id' => $customer->id,
            'location_id' => $location->id,
            'paid_amount' => 100,
            'items' => [
                [
                    'product_variant_id' => $variant->id,
                    'quantity' => 1,
                    'unit_price' => 100,
                ],
            ],
        ]);

        $create->assertCreated();
        $saleId = $create->json('data.id');

        $response = $this->getJson('/api/v1/sales/'.$saleId);

        $response->assertOk()
            ->assertJsonPath('data.location', 'Kabul')
            ->assertJsonPath('data.invoice_profile.legal_name', 'Olfat Trading — Kabul')
            ->assertJsonPath('data.invoice_profile.whatsapp', '93700111222')
            ->assertJsonPath('data.invoice_profile.footer_note', 'Kabul thanks you.')
            ->assertJsonMissingPath('data.invoice_profile.phone');
    }
}
