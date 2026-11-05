import time
import httpx
from app.services.ssrf import validate_safe_url
from app.schemas.credential import (
    DEFAULT_PROVIDER_MODELS,
    ProviderCatalogItem,
    ProviderTestResult,
)

PROVIDER_CATALOG: list[ProviderCatalogItem] = [
    ProviderCatalogItem(
        id="openai",
        name="OpenAI",
        description="Official OpenAI models including GPT-4o, GPT-4o-mini, and reasoning models.",
        default_model="gpt-4o-mini",
        suggested_models=["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo", "o3-mini"],
        requires_base_url=False,
        default_base_url="https://api.openai.com/v1",
    ),
    ProviderCatalogItem(
        id="gemini",
        name="Google Gemini",
        description="Google Gemini models with large context windows and multimodal capabilities.",
        default_model="gemini-1.5-flash",
        suggested_models=["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
        requires_base_url=False,
        default_base_url="https://generativelanguage.googleapis.com/v1beta/openai",
    ),
    ProviderCatalogItem(
        id="groq",
        name="Groq",
        description="Ultra-fast LPU inference hosting open models like Llama 3 and Mixtral.",
        default_model="llama-3.3-70b-versatile",
        suggested_models=["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
        requires_base_url=False,
        default_base_url="https://api.groq.com/openai/v1",
    ),
    ProviderCatalogItem(
        id="deepseek",
        name="DeepSeek",
        description="Advanced coding and reasoning models with exceptional price-performance.",
        default_model="deepseek-chat",
        suggested_models=["deepseek-chat", "deepseek-reasoner"],
        requires_base_url=False,
        default_base_url="https://api.deepseek.com",
    ),
    ProviderCatalogItem(
        id="openrouter",
        name="OpenRouter",
        description="Unified gateway to hundreds of open-source and proprietary AI models.",
        default_model="openai/gpt-4o-mini",
        suggested_models=[
            "openai/gpt-4o-mini",
            "anthropic/claude-3.5-sonnet",
            "meta-llama/llama-3.3-70b-instruct",
            "google/gemini-2.0-flash-exp:free",
        ],
        requires_base_url=False,
        default_base_url="https://openrouter.ai/api/v1",
    ),
    ProviderCatalogItem(
        id="anthropic",
        name="Anthropic",
        description="Claude models specialized in nuanced analysis, complex writing, and coding.",
        default_model="claude-3-5-sonnet-latest",
        suggested_models=["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
        requires_base_url=False,
        default_base_url="https://api.anthropic.com/v1",
    ),
    ProviderCatalogItem(
        id="custom",
        name="Custom (OpenAI-Compatible)",
        description="Self-hosted vLLM, Ollama, LM Studio, LocalAI, or corporate gateways.",
        default_model="default",
        suggested_models=["default"],
        requires_base_url=True,
        default_base_url=None,
    ),
]


class ProviderValidator:
    async def test_connection(
        self,
        provider: str,
        api_key: str,
        model_name: str | None = None,
        base_url: str | None = None,
    ) -> ProviderTestResult:
        prov = provider.lower().strip()
        key = api_key.strip()
        if not key:
            return ProviderTestResult(
                success=False,
                message="API key cannot be empty.",
                provider=prov,
                model=model_name,
            )

        model = (model_name or "").strip() or DEFAULT_PROVIDER_MODELS.get(prov, "default")
        start_time = time.perf_counter()

        try:
            if prov == "openai":
                return await self._test_openai(key, model, start_time)
            elif prov == "gemini":
                return await self._test_gemini(key, model, start_time)
            elif prov == "groq":
                return await self._test_groq(key, model, start_time)
            elif prov == "deepseek":
                return await self._test_deepseek(key, model, start_time)
            elif prov == "openrouter":
                return await self._test_openrouter(key, model, start_time)
            elif prov == "anthropic":
                return await self._test_anthropic(key, model, start_time)
            elif prov == "custom":
                return await self._test_custom(key, model, base_url, start_time)
            else:
                return ProviderTestResult(
                    success=False,
                    message=f"Unsupported provider: {prov}",
                    provider=prov,
                    model=model,
                )
        except Exception as exc:
            latency = int((time.perf_counter() - start_time) * 1000)
            return ProviderTestResult(
                success=False,
                message=f"Unexpected error validating connection: {exc}",
                provider=prov,
                model=model,
                latency_ms=latency,
            )

    async def _test_openai(self, key: str, model: str, start_time: float) -> ProviderTestResult:
        if not (key.startswith("sk-") or key.startswith("sk-proj-")):
            pass  # Warning only, don't hard reject to support newer key schemes
        url = "https://api.openai.com/v1/models"
        headers = {"Authorization": f"Bearer {key}"}
        return await self._make_get_test(url, headers, "openai", model, start_time)

    async def _test_gemini(self, key: str, model: str, start_time: float) -> ProviderTestResult:
        # Gemini provides a lightweight GET models endpoint with query param key
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
        return await self._make_get_test(url, {}, "gemini", model, start_time)

    async def _test_groq(self, key: str, model: str, start_time: float) -> ProviderTestResult:
        url = "https://api.groq.com/openai/v1/models"
        headers = {"Authorization": f"Bearer {key}"}
        return await self._make_get_test(url, headers, "groq", model, start_time)

    async def _test_deepseek(self, key: str, model: str, start_time: float) -> ProviderTestResult:
        url = "https://api.deepseek.com/models"
        headers = {"Authorization": f"Bearer {key}"}
        return await self._make_get_test(url, headers, "deepseek", model, start_time)

    async def _test_openrouter(self, key: str, model: str, start_time: float) -> ProviderTestResult:
        url = "https://openrouter.ai/api/v1/auth/key"
        headers = {"Authorization": f"Bearer {key}"}
        return await self._make_get_test(url, headers, "openrouter", model, start_time)

    async def _test_anthropic(self, key: str, model: str, start_time: float) -> ProviderTestResult:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        # Minimal probe: send a 1-token prompt to verify authentication & model
        payload = {
            "model": model,
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "ping"}],
        }
        timeout = httpx.Timeout(10.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.post(url, headers=headers, json=payload)
                latency = int((time.perf_counter() - start_time) * 1000)
                if res.status_code == 200:
                    return ProviderTestResult(
                        success=True,
                        message=f"Connected successfully to Anthropic (model: {model}).",
                        provider="anthropic",
                        model=model,
                        latency_ms=latency,
                    )
                return self._parse_http_error(res, "anthropic", model, latency)
            except httpx.TimeoutException:
                return ProviderTestResult(
                    success=False,
                    message="Connection to Anthropic timed out after 10 seconds.",
                    provider="anthropic",
                    model=model,
                )
            except httpx.RequestError as exc:
                return ProviderTestResult(
                    success=False,
                    message=f"Network error connecting to Anthropic: {exc}",
                    provider="anthropic",
                    model=model,
                )

    async def _test_custom(
        self, key: str, model: str, base_url: str | None, start_time: float
    ) -> ProviderTestResult:
        if not base_url:
            return ProviderTestResult(
                success=False,
                message="Base URL is required for custom OpenAI-compatible endpoints.",
                provider="custom",
                model=model,
            )

        try:
            safe_url = validate_safe_url(base_url)
        except ValueError as err:
            return ProviderTestResult(
                success=False,
                message=f"SSRF validation blocked custom URL: {err}",
                provider="custom",
                model=model,
            )

        headers = {"Authorization": f"Bearer {key}"}
        # Try /models on custom base URL
        probe_url = f"{safe_url}/models"
        timeout = httpx.Timeout(8.0, connect=4.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.get(probe_url, headers=headers)
                latency = int((time.perf_counter() - start_time) * 1000)
                if res.status_code == 200:
                    return ProviderTestResult(
                        success=True,
                        message=f"Connected successfully to custom provider at {safe_url}.",
                        provider="custom",
                        model=model,
                        latency_ms=latency,
                    )
                # If /models returns 404/405, try a minimal chat completion
                if res.status_code in (404, 405):
                    chat_url = f"{safe_url}/chat/completions"
                    chat_res = await client.post(
                        chat_url,
                        headers=headers,
                        json={"model": model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
                    )
                    latency = int((time.perf_counter() - start_time) * 1000)
                    if chat_res.status_code == 200:
                        return ProviderTestResult(
                            success=True,
                            message=f"Connected successfully to custom provider at {safe_url}.",
                            provider="custom",
                            model=model,
                            latency_ms=latency,
                        )
                    return self._parse_http_error(chat_res, "custom", model, latency)
                return self._parse_http_error(res, "custom", model, latency)
            except httpx.TimeoutException:
                return ProviderTestResult(
                    success=False,
                    message=f"Connection to custom provider at {safe_url} timed out.",
                    provider="custom",
                    model=model,
                )
            except httpx.RequestError as exc:
                return ProviderTestResult(
                    success=False,
                    message=f"Network error connecting to custom provider: {exc}",
                    provider="custom",
                    model=model,
                )

    async def _make_get_test(
        self, url: str, headers: dict[str, str], provider: str, model: str, start_time: float
    ) -> ProviderTestResult:
        timeout = httpx.Timeout(8.0, connect=4.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.get(url, headers=headers)
                latency = int((time.perf_counter() - start_time) * 1000)
                if res.status_code == 200:
                    return ProviderTestResult(
                        success=True,
                        message=f"Connected successfully to {provider.capitalize()} (latency: {latency}ms).",
                        provider=provider,
                        model=model,
                        latency_ms=latency,
                    )
                return self._parse_http_error(res, provider, model, latency)
            except httpx.TimeoutException:
                return ProviderTestResult(
                    success=False,
                    message=f"Connection to {provider} timed out after 8 seconds.",
                    provider=provider,
                    model=model,
                )
            except httpx.RequestError as exc:
                return ProviderTestResult(
                    success=False,
                    message=f"Network error reaching {provider}: {exc}",
                    provider=provider,
                    model=model,
                )

    def _parse_http_error(
        self, response: httpx.Response, provider: str, model: str, latency: int
    ) -> ProviderTestResult:
        status = response.status_code
        detail = ""
        try:
            body = response.json()
            if isinstance(body, dict):
                error_obj = body.get("error")
                if isinstance(error_obj, dict):
                    detail = error_obj.get("message") or str(error_obj)
                elif isinstance(error_obj, str):
                    detail = error_obj
                else:
                    detail = body.get("detail") or body.get("message") or response.text[:200]
        except Exception:
            detail = response.text[:200]

        if status in (401, 403):
            msg = f"Authentication failed ({status}): Invalid or unauthorized API key. {detail}".strip()
        elif status == 429:
            msg = f"Rate limit or quota exceeded ({status}). Check your provider billing or limits. {detail}".strip()
        elif status == 404:
            msg = f"Resource or model not found ({status}). Verify model '{model}'. {detail}".strip()
        else:
            msg = f"Provider returned error status {status}: {detail}".strip()

        return ProviderTestResult(
            success=False,
            message=msg,
            provider=provider,
            model=model,
            latency_ms=latency,
        )


provider_validator = ProviderValidator()

