<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Models\Location;
use App\Models\User;
use App\Services\Auth\PasswordResetCodeService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(private readonly PasswordResetCodeService $passwordResetCodeService) {}

    public function loginOptions(): JsonResponse
    {
        $claimedByLocation = User::query()
            ->whereNotNull('location_id')
            ->get(['id', 'name', 'email', 'location_id'])
            ->keyBy('location_id');

        $locations = Location::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(function (Location $location) use ($claimedByLocation) {
                $claimedBy = $claimedByLocation->get($location->id);

                return [
                    'id' => $location->id,
                    'name' => $location->name,
                    'code' => $location->code,
                    'available' => $claimedBy === null,
                    'claimed_by' => $claimedBy ? [
                        'id' => $claimedBy->id,
                        'name' => $claimedBy->name,
                        'email' => $claimedBy->email,
                    ] : null,
                ];
            })
            ->values();

        $users = User::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get(['id', 'name', 'email', 'location_id'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'location_id' => $user->location_id,
            ])
            ->values();

        return ApiResponse::success([
            'locations' => $locations,
            'users' => $users,
        ]);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->string('email'))->first();

        if (! $user || ! Hash::check($request->string('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            return ApiResponse::error('This user account is inactive.', null, 403);
        }

        $locationId = (int) $request->integer('location_id');

        DB::transaction(function () use ($user, $locationId) {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->id);

            $location = Location::query()->lockForUpdate()->find($locationId);
            if (! $location || ! $location->is_active) {
                throw ValidationException::withMessages([
                    'location_id' => ['This province is not available.'],
                ]);
            }

            $claimedByOther = User::query()
                ->where('location_id', $locationId)
                ->where('id', '!=', $lockedUser->id)
                ->lockForUpdate()
                ->exists();

            if ($claimedByOther) {
                throw ValidationException::withMessages([
                    'location_id' => ['This province is already taken by another user. Choose a free province.'],
                ]);
            }

            if ($lockedUser->location_id !== null && (int) $lockedUser->location_id !== $locationId) {
                throw ValidationException::withMessages([
                    'location_id' => ['This account is already linked to another province. Sign in with that province.'],
                ]);
            }

            if ($lockedUser->location_id === null) {
                $lockedUser->location_id = $locationId;
                $lockedUser->save();
            }
        });

        $user->refresh()->load('location');

        $deviceName = $request->input('device_name', 'mobile-web');
        $token = $user->createToken($deviceName)->plainTextToken;

        return ApiResponse::success([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->userPayload($user),
        ], 'Logged in successfully');
    }

    public function me(Request $request): JsonResponse
    {
        return ApiResponse::success($this->userPayload($request->user()->loadMissing('location')));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return ApiResponse::success(null, 'Logged out successfully');
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->fill($request->validated());
        $user->save();

        return ApiResponse::success($this->userPayload($user->fresh()->loadMissing('location')), 'Profile updated');
    }

    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->password = $request->validated('password');
        $user->save();

        $this->revokeOtherTokens($request);

        return ApiResponse::success(null, 'Password updated. Other devices were signed out.');
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $result = $this->passwordResetCodeService->sendCode($request->validated('email'));

        if ($result === null) {
            return ApiResponse::success(null, PasswordResetCodeService::GENERIC_MESSAGE);
        }

        $code = $result['code'] ?? null;
        if (is_string($code) && $code !== '') {
            $message = ($result['mailed'] ?? false)
                ? 'A confirmation code was emailed. It is also shown here so you can continue: '.$code
                : 'Email delivery failed, so use this confirmation code: '.$code;

            return ApiResponse::success(['code' => $code], $message);
        }

        return ApiResponse::success(null, PasswordResetCodeService::GENERIC_MESSAGE);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $data = $request->validated();

        $this->passwordResetCodeService->resetPassword(
            $data['email'],
            $data['code'],
            $data['password']
        );

        return ApiResponse::success(null, 'Password updated. You can sign in with your new password.');
    }

    private function revokeOtherTokens(Request $request): void
    {
        $user = $request->user();
        if (! $user) {
            return;
        }

        $current = $user->currentAccessToken();
        $currentId = $current instanceof PersonalAccessToken
            ? $current->id
            : (is_object($current) && isset($current->id) ? $current->id : null);

        PersonalAccessToken::query()
            ->where('tokenable_type', $user->getMorphClass())
            ->where('tokenable_id', $user->getKey())
            ->when($currentId !== null, fn ($query) => $query->where('id', '!=', $currentId))
            ->delete();
    }

    /**
     * @return array{id:int,name:string,email:string,phone:?string,is_active:bool,role:string,location_id:?int,location:?array{id:int,name:string,code:string}}
     */
    private function userPayload(User $user): array
    {
        $location = $user->relationLoaded('location') ? $user->location : $user->location()->first();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => (bool) $user->is_active,
            'role' => ($user->role instanceof UserRole ? $user->role : UserRole::tryFrom((string) $user->role))?->value
                ?? UserRole::Staff->value,
            'location_id' => $user->location_id,
            'location' => $location ? [
                'id' => $location->id,
                'name' => $location->name,
                'code' => $location->code,
            ] : null,
        ];
    }
}
