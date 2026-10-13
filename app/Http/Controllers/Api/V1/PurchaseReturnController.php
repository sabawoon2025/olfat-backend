<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\StorePurchaseReturnRequest;
use App\Models\PurchaseReturn;
use App\Services\Purchase\PurchaseReturnService;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class PurchaseReturnController extends Controller
{
    public function __construct(private readonly PurchaseReturnService $purchaseReturnService) {}

    public function index(Request $request): JsonResponse
    {
        $query = PurchaseReturn::query()
            ->with(['purchase', 'supplier', 'location', 'user', 'items.variant.product'])
            ->withCount('items')
            ->latest('returned_at')
            ->latest('id');

        if ($request->filled('purchase_id')) {
            $query->where('purchase_id', $request->integer('purchase_id'));
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->integer('supplier_id'));
        }

        if ($request->filled('location_id')) {
            $query->where('location_id', $request->integer('location_id'));
        }

        return ApiResponse::success($query->paginate(Pagination::perPage($request)));
    }

    public function store(StorePurchaseReturnRequest $request): JsonResponse
    {
        try {
            $purchaseReturn = $this->purchaseReturnService->create([
                ...$request->validated(),
                'user' => $request->user(),
            ]);
        } catch (InvalidArgumentException|RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        } catch (Throwable $e) {
            report($e);

            return ApiResponse::error('Purchase return could not be created.', null, 500);
        }

        return ApiResponse::success($purchaseReturn, 'Purchase return created', 201);
    }

    public function show(PurchaseReturn $purchaseReturn): JsonResponse
    {
        return ApiResponse::success(
            $purchaseReturn->load(['items.variant', 'purchase', 'supplier', 'location', 'user'])
        );
    }
}
