<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Worker;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Worker::query()->orderBy('name');

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

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $worker = Worker::query()->create([
            ...$data,
            'created_by' => $request->user()->id,
        ]);

        return ApiResponse::success($worker, 'Worker created', 201);
    }

    public function show(Worker $worker): JsonResponse
    {
        return ApiResponse::success($worker);
    }

    public function update(Request $request, Worker $worker): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $worker->fill($data)->save();

        return ApiResponse::success($worker->fresh(), 'Worker updated');
    }

    public function destroy(Worker $worker): JsonResponse
    {
        // Hard delete fails when worker_payments exist (FK restrict). Match
        // customers/suppliers: deactivate so payment history stays intact.
        $worker->is_active = false;
        $worker->save();

        return ApiResponse::success($worker->fresh(), 'Worker deactivated');
    }
}
