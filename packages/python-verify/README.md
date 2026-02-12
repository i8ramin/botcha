# botcha-verify

Server-side verification middleware for BOTCHA JWT tokens.

## Installation

```bash
pip install botcha-verify
```

For FastAPI support:
```bash
pip install "botcha-verify[fastapi]"
```

For Django support:
```bash
pip install "botcha-verify[django]"
```

## Usage

### Standalone Verification

```python
from botcha_verify import verify_botcha_token, VerifyOptions

result = verify_botcha_token(
    token="eyJhbG...",
    secret="your-secret-key",
    options=VerifyOptions(audience="https://api.example.com")
)

if result.valid:
    print(f"Challenge solved in {result.payload.solve_time}ms")
else:
    print(f"Invalid token: {result.error}")
```

### FastAPI

```python
from fastapi import FastAPI, Depends
from botcha_verify.fastapi import BotchaVerify
from botcha_verify import BotchaPayload

app = FastAPI()
botcha = BotchaVerify(secret='your-secret-key')

@app.get('/api/data')
async def get_data(token: BotchaPayload = Depends(botcha)):
    return {"solve_time": token.solve_time}
```

### Django

```python
# settings.py
MIDDLEWARE = [
    # ... other middleware
    'botcha_verify.django.BotchaVerifyMiddleware',
]

BOTCHA_SECRET = 'your-secret-key'
BOTCHA_PROTECTED_PATHS = ['/api/']
BOTCHA_EXCLUDED_PATHS = ['/api/health']

# views.py
def my_view(request):
    if hasattr(request, 'botcha'):
        print(f"Solved in {request.botcha.solve_time}ms")
    return JsonResponse({"data": "protected"})
```

## Token Structure

BOTCHA JWT tokens contain:
- `sub`: Challenge ID
- `iat`: Issued at (Unix timestamp)
- `exp`: Expiry (Unix timestamp)
- `jti`: JWT ID for revocation
- `type`: "botcha-verified"
- `solveTime`: Challenge solve time in milliseconds
- `aud`: (optional) Audience claim
- `client_ip`: (optional) Client IP binding

## License

MIT
