<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExternalDebtDirection;
use App\Http\Controllers\Controller;
use App\Models\ExternalDebt;
use App\Services\ExternalDebt\ExternalDebtService;
use App\Support\ApiResponse;
use App\Support\ProvinceScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Throwable;

class ExternalDebtController extends Controller
{
    public function __construct(private readonly ExternalDebtService $debtService) {}

    public function index(Request $request): JsonResponse
    {
        $query = ExternalDebt::query()
            ->with(['party', 'location', 'user'])
            ->latest('opened_at')
            ->latest('id');

        if ($request->filled('external_party_id')) {
            $query->where('external_party_id', $request->integer('external_party_id'));
        }

        if ($request->filled('direction')) {
            $query->where('direction', $request->string('direction'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return ApiResponse::success($query->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'external_party_id' => ['required', 'exists:external_parties,id'],
            'direction' => ['required', Rule::in(ExternalDebtDirection::values())],
            'reason' => ['required', 'string', 'max:255'],
            'original_amount' => ['required', 'numeric', 'gt:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'location_id' => ['required', 'exists:locations,id'],
            'opened_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        try {
            $debt = $this->debtService->create([
                ...$data,
                'user' => $request->user(),
            ]);
        } catch (InvalidArgumentException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        } catch (Throwable $e) {
            report($e);

            return ApiResponse::error('External debt could not be created.', null, 500);
        }

        return ApiResponse::success($debt, 'External debt created', 201);
    }

    public function show(ExternalDebt $externalDebt): JsonResponse
    {
        return ApiResponse::success(
            $externalDebt->load(['party', 'location', 'user', 'payments.location', 'payments.user'])
        );
    }

    public function storePayment(Request $request, ExternalDebt $externalDebt): JsonResponse
    {
        $data = $request->validate([
            'location_id' => ['required', 'exists:locations,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        try {
            ProvinceScope::assertSameProvince(
                $request->user(),
                (int) $externalDebt->location_id,
                'You can only record payments on debts from your own province.'
            );

            $payment = $this->debtService->recordPayment([
                ...$data,
                'external_debt_id' => $externalDebt->id,
                'user' => $request->user(),
            ]);
        } catch (InvalidArgumentException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        } catch (Throwable $e) {
            report($e);

            return ApiResponse::error('External debt payment could not be recorded.', null, 500);
        }

        return ApiResponse::success($payment, 'External debt payment recorded', 201);
    }
}
