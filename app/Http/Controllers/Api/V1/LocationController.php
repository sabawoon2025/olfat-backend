<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Location\StoreLocationRequest;
use App\Http\Requests\Location\UpdateLocationRequest;
use App\Models\Location;
use App\Support\ApiResponse;
use App\Support\InvoiceProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

class LocationController extends Controller
{
    public function index(): JsonResponse
    {
        $locations = Location::query()
            ->orderBy('name')
            ->get($this->locationColumns());

        return ApiResponse::success($locations);
    }

    public function store(StoreLocationRequest $request): JsonResponse
    {
        $data = $request->validated();
        if (array_key_exists('invoice_profile', $data)) {
            $data['invoice_profile'] = InvoiceProfile::sanitize($data['invoice_profile'] ?? []);
        }

        $location = Location::query()->create($data);

        return ApiResponse::success($location, 'Location created', 201);
    }

    public function show(Location $location): JsonResponse
    {
        return ApiResponse::success($location);
    }

    public function update(UpdateLocationRequest $request, Location $location): JsonResponse
    {
        $data = $request->validated();
        if (array_key_exists('invoice_profile', $data)) {
            $data['invoice_profile'] = InvoiceProfile::sanitize($data['invoice_profile'] ?? []);
        }

        $location->fill($data);
        $location->save();

        return ApiResponse::success($location->fresh(), 'Location updated');
    }

    public function destroy(Location $location): JsonResponse
    {
        if ($location->stockBalances()->where('quantity', '!=', 0)->exists()) {
            return ApiResponse::error(
                'Cannot delete a location that still has stock.',
                null,
                422
            );
        }

        if ($location->stockMovements()->exists()) {
            return ApiResponse::error(
                'Cannot delete a location with stock history. Deactivate it instead.',
                null,
                422
            );
        }

        $location->delete();

        return ApiResponse::success(null, 'Location deleted');
    }

    /**
     * @return list<string>
     */
    private function locationColumns(): array
    {
        $columns = ['id', 'name', 'code', 'is_active', 'created_at', 'updated_at'];

        if (Schema::hasColumn('locations', 'invoice_profile')) {
            $columns[] = 'invoice_profile';
        }

        return $columns;
    }
}
