<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sale\StoreSaleRequest;
use App\Http\Resources\V1\SaleResource;
use App\Models\Sale;
use App\Services\Sale\SaleService;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class SaleController extends Controller
{
    public function __construct(private readonly SaleService $saleService) {}

    public function index(Request $request): JsonResponse
    {
        $query = Sale::query()
            ->with(['customer', 'location', 'user', 'items.variant.product'])
            ->latest('sold_at')
            ->latest('id');

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->integer('customer_id'));
        }

        if ($request->filled('location_id')) {
            $query->where('location_id', $request->integer('location_id'));
        }

        if ($request->filled('payment_type')) {
            $query->where('payment_type', $request->string('payment_type'));
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
            $query->where('sold_at', '>=', $request->date('from')->startOfDay());
        }

        if ($request->filled('to')) {
            $query->where('sold_at', '<=', $request->date('to')->endOfDay());
        }

        return ApiResponse::success($query->paginate(Pagination::perPage($request)));
    }

    public function store(StoreSaleRequest $request): JsonResponse
    {
        try {
            $sale = $this->saleService->create([
                ...$request->validated(),
                'user' => $request->user(),
            ]);
        } catch (InvalidArgumentException|RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        } catch (Throwable $e) {
            report($e);

            return ApiResponse::error('Sale could not be created.', null, 500);
        }

        return ApiResponse::success($sale, 'Sale created', 201);
    }

    /**
     * Returns the sale in the shape expected by public/pages/bill.html
     * (customer/location/user names, *_raw numeric fields, flat item list).
     */
    public function show(Sale $sale): JsonResponse
    {
        $sale->load(['items.variant.product', 'customer', 'location', 'user']);

        return ApiResponse::success(
            SaleResource::make($sale)->resolve()
        );
    }
}
