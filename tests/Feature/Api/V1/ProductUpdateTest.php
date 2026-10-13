<?php

namespace Tests\Feature\Api\V1;

use App\Enums\ProductModule;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_update_and_deactivate_product(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $product = Product::factory()->create([
            'module' => ProductModule::Tea,
            'name' => 'Green Tea',
            'is_active' => true,
        ]);

        $this->putJson('/api/v1/products/'.$product->id, [
            'name' => 'Green Tea Premium',
            'description' => 'Updated notes',
            'is_active' => false,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Green Tea Premium')
            ->assertJsonPath('data.description', 'Updated notes')
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Green Tea Premium',
            'is_active' => false,
        ]);
    }

    public function test_inactive_products_can_be_filtered_out(): void
    {
        Sanctum::actingAs(User::factory()->create());

        Product::factory()->create([
            'module' => ProductModule::Tea,
            'name' => 'Active Tea',
            'is_active' => true,
        ]);
        Product::factory()->create([
            'module' => ProductModule::Tea,
            'name' => 'Inactive Tea',
            'is_active' => false,
        ]);

        $response = $this->getJson('/api/v1/products?module=tea&is_active=1&per_page=50');

        $response->assertOk();
        $names = collect($response->json('data.data') ?? $response->json('data'))
            ->pluck('name')
            ->all();

        $this->assertContains('Active Tea', $names);
        $this->assertNotContains('Inactive Tea', $names);
    }
}
