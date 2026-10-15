<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\StorePurchaseRequest;
use App\Models\Purchase;
use App\Services\Purchase\PurchaseService;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Throwable;

class PurchaseController extends Controller
{
    public function __construct(private readonly PurchaseService $purchaseService) {}

    public function index(Request $request): JsonResponse
    {
        $query = Purchase::query()
            ->with(['supplier', 'location', 'user', 'items.variant.product'])
            ->latest('purchased_at')
            ->latest('id');

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->integer('supplier_id'));
        }

        if ($request->filled('location_id')) {
            $query->where('location_id', $request->integer('location_id'));
        }

        if ($request->filled('product_id')) {
            $productId = $request->integer('product_id');
            $query->whereHas('items.variant', fn ($q) => $q->where('product_id', $productId));
        }

        if ($request->filled('product_variant_id')) {
            $variantId = $request->integer('product_variant_id');
            $query->whereHas('items', fn ($q) => $q->where('product_variant_id', $variantId));
        }

        if ($request->filled('from')) {
            $query->where('purchased_at', '>=', $request->date('from')->startOfDay());
        }

        if ($request->filled('to')) {
            $query->where('purchased_at', '<=', $request->date('to')->endOfDay());
        }

        return ApiResponse::success($query->paginate(Pagination::perPage($request)));
    }

    public function store(StorePurchaseRequest $request): JsonResponse
    {
        try {
            $purchase = $this->purchaseService->create([
                ...$request->validated(),
                'user' => $request->user(),
            ]);
        } catch (InvalidArgumentException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        } catch (Throwable $e) {
            report($e);

            return ApiResponse::error('Purchase could not be created.', null, 500);
        }

        return ApiResponse::success($purchase, 'Purchase created', 201);
    }

    public function show(Purchase $purchase): JsonResponse
    {
        return ApiResponse::success(
            $purchase->load(['items.variant.product', 'supplier', 'location', 'user'])
        );
    }
}
