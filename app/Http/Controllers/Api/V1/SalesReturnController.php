<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sale\StoreSalesReturnRequest;
use App\Models\SalesReturn;
use App\Services\Sale\SalesReturnService;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class SalesReturnController extends Controller
{
    public function __construct(private readonly SalesReturnService $salesReturnService) {}

    public function index(Request $request): JsonResponse
    {
        $query = SalesReturn::query()
            ->with(['sale', 'customer', 'location', 'user', 'items.variant.product'])
            ->withCount('items')
            ->latest('returned_at')
            ->latest('id');

        if ($request->filled('sale_id')) {
            $query->where('sale_id', $request->integer('sale_id'));
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->integer('customer_id'));
        }

        if ($request->filled('location_id')) {
            $query->where('location_id', $request->integer('location_id'));
        }

        return ApiResponse::success($query->paginate(Pagination::perPage($request)));
    }

    public function store(StoreSalesReturnRequest $request): JsonResponse
    {
        try {
            $salesReturn = $this->salesReturnService->create([
                ...$request->validated(),
                'user' => $request->user(),
            ]);
        } catch (InvalidArgumentException|RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        } catch (Throwable $e) {
            report($e);

            return ApiResponse::error('Sales return could not be created.', null, 500);
        }

        return ApiResponse::success($salesReturn, 'Sales return created', 201);
    }

    public function show(SalesReturn $salesReturn): JsonResponse
    {
        return ApiResponse::success(
            $salesReturn->load(['items.variant.product', 'sale', 'customer', 'location', 'user'])
        );
    }
}
