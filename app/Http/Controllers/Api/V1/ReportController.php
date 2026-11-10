<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Report\ReportService;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reportService) {}

    public function sales(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reportService->salesSummary(
                $this->dateOrNull($request->input('from')),
                $this->dateOrNull($request->input('to')),
                $request->filled('location_id') ? $request->integer('location_id') : null,
                $request->filled('product_id') ? $request->integer('product_id') : null,
            )
        );
    }

    public function purchases(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reportService->purchasesSummary(
                $this->dateOrNull($request->input('from')),
                $this->dateOrNull($request->input('to')),
                $request->filled('location_id') ? $request->integer('location_id') : null,
                $request->filled('product_id') ? $request->integer('product_id') : null,
            )
        );
    }

    public function stock(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reportService->stockReport(
                $request->filled('location_id') ? $request->integer('location_id') : null,
                $request->input('module'),
            )
        );
    }

    public function stockMovements(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reportService->stockMovementsReport(
                $this->dateOrNull($request->input('from')),
                $this->dateOrNull($request->input('to')),
                $request->filled('location_id') ? $request->integer('location_id') : null,
                $request->input('type'),
            )
        );
    }

    public function financial(Request $request): JsonResponse
    {
        return ApiResponse::success($this->reportService->financialDebts());
    }

    public function workers(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reportService->workerPaymentsReport(
                $this->dateOrNull($request->input('from')),
                $this->dateOrNull($request->input('to')),
                $request->filled('worker_id') ? $request->integer('worker_id') : null,
                $request->filled('location_id') ? $request->integer('location_id') : null,
            )
        );
    }

    public function damagedStock(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reportService->damagedStockReport(
                $this->dateOrNull($request->input('from')),
                $this->dateOrNull($request->input('to')),
                $request->filled('location_id') ? $request->integer('location_id') : null,
            )
        );
    }

    public function salesReturns(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reportService->salesReturnsReport(
                $this->dateOrNull($request->input('from')),
                $this->dateOrNull($request->input('to')),
                $request->filled('location_id') ? $request->integer('location_id') : null,
            )
        );
    }

    public function homeExpenses(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reportService->homeExpensesReport(
                $this->dateOrNull($request->input('from')),
                $this->dateOrNull($request->input('to')),
                $request->input('category'),
            )
        );
    }

    public function profitLoss(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->reportService->profitLoss(
                $this->dateOrNull($request->input('from') ?? $request->input('date_from')),
                $this->dateOrNull($request->input('to') ?? $request->input('date_to')),
                $request->filled('location_id') ? $request->integer('location_id') : null,
                $request->filled('product_id') ? $request->integer('product_id') : null,
            )
        );
    }

    private function dateOrNull(mixed $value): ?Carbon
    {
        if (! $value) {
            return null;
        }

        return Carbon::parse($value);
    }
}
