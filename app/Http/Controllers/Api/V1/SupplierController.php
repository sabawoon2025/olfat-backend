<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Supplier\StoreSupplierRequest;
use App\Http\Requests\Supplier\UpdateSupplierRequest;
use App\Models\Supplier;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query()->orderBy('name');

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        return ApiResponse::success($query->paginate($request->integer('per_page', 20)));
    }

    public function store(StoreSupplierRequest $request): JsonResponse
    {
        $supplier = new Supplier($request->validated());
        $supplier->created_by = $request->user()->id;
        $supplier->balance = 0;
        $supplier->balance_usd = 0;
        $supplier->save();

        return ApiResponse::success($supplier->fresh(), 'Supplier created', 201);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return ApiResponse::success($supplier);
    }

    public function update(UpdateSupplierRequest $request, Supplier $supplier): JsonResponse
    {
        // Balance is never updated from this endpoint — purchases/payments own it.
        $supplier->fill($request->validated());
        $supplier->save();

        return ApiResponse::success($supplier->fresh(), 'Supplier updated');
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        if ($supplier->purchases()->exists() || $supplier->payments()->exists()) {
            return ApiResponse::error(
                'Supplier has purchases or payments and cannot be deleted. Deactivate instead.',
                null,
                422
            );
        }

        if (round((float) $supplier->balance, 2) != 0.0 || round((float) $supplier->balance_usd, 2) != 0.0) {
            return ApiResponse::error(
                'Supplier still has an open balance and cannot be deleted.',
                null,
                422
            );
        }

        $supplier->delete();

        return ApiResponse::success(null, 'Supplier deleted');
    }
}
