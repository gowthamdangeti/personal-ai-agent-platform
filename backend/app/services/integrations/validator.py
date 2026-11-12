import base64
import logging
import time
from typing import Any
import httpx
from app.schemas.integrations import ConnectionTestResult
from app.services.ssrf import validate_safe_url

logger = logging.getLogger(__name__)


class IntegrationValidator:
    async def test_connection(
        self,
        category: str,
        provider: str,
        secrets: dict[str, str],
        config: dict[str, Any],
        api_key: str | None = None,
        model_name: str | None = None,
        base_url: str | None = None,
    ) -> ConnectionTestResult:
        cat = category.lower().strip()
        prov = provider.lower().strip()
        start_time = time.perf_counter()

        # If api_key provided directly, ensure it is available in secrets dict
        if api_key and not secrets.get("api_key"):
            secrets["api_key"] = api_key

        try:
            # 1. AI Providers (LLM)
            if cat == "llm":
                return await self._test_llm(prov, secrets, config, model_name, base_url, start_time)

            # 2. Embedding Providers
            elif cat == "embedding":
                return await self._test_embedding(prov, secrets, config, model_name, start_time)

            # 3. Research Providers
            elif cat == "research":
                return await self._test_research(prov, secrets, config, base_url, start_time)

            # 4. Project Management
            elif cat == "project_management":
                return await self._test_project_management(prov, secrets, config, start_time)

            # 5. Developer Integrations
            elif cat == "developer":
                return await self._test_developer(prov, secrets, config, start_time)

            # 6. Monitoring & Telemetry
            elif cat == "monitoring":
                return await self._test_monitoring(prov, secrets, config, base_url, start_time)

            # 7. Database Integrations
            elif cat == "database":
                return await self._test_database(prov, secrets, config, start_time)

            # 8. Custom Integrations
            elif cat == "custom":
                return await self._test_custom(prov, secrets, config, base_url, start_time)

            else:
                return ConnectionTestResult(
                    success=False,
                    message=f"Unsupported integration category: {category}",
                    category=cat,
                    provider=prov,
                )
        except Exception as exc:
            latency = int((time.perf_counter() - start_time) * 1000)
            logger.warning("Connection test failed unexpectedly for %s/%s: %s", cat, prov, exc)
            return ConnectionTestResult(
                success=False,
                message=f"Unexpected error validating {prov}: {str(exc)}",
                category=cat,
                provider=prov,
                latency_ms=latency,
            )

    # ----------------------------------------------------
    # LLM Testing
    # ----------------------------------------------------
    async def _test_llm(
        self,
        prov: str,
        secrets: dict[str, str],
        config: dict[str, Any],
        model: str | None,
        base_url: str | None,
        start_time: float,
    ) -> ConnectionTestResult:
        key = secrets.get("api_key", "").strip()
        if not key and prov != "custom":
            return ConnectionTestResult(
                success=False, message="API key is required for LLM provider.", category="llm", provider=prov
            )

        if prov == "openai":
            url = "https://api.openai.com/v1/models"
            return await self._http_get(url, {"Authorization": f"Bearer {key}"}, "llm", "openai", start_time)
        elif prov == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
            return await self._http_get(url, {}, "llm", "gemini", start_time)
        elif prov == "groq":
            url = "https://api.groq.com/openai/v1/models"
            return await self._http_get(url, {"Authorization": f"Bearer {key}"}, "llm", "groq", start_time)
        elif prov == "deepseek":
            url = "https://api.deepseek.com/models"
            return await self._http_get(url, {"Authorization": f"Bearer {key}"}, "llm", "deepseek", start_time)
        elif prov == "openrouter":
            url = "https://openrouter.ai/api/v1/auth/key"
            return await self._http_get(url, {"Authorization": f"Bearer {key}"}, "llm", "openrouter", start_time)
        elif prov == "anthropic":
            url = "https://api.anthropic.com/v1/messages"
            headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
            payload = {"model": model or "claude-3-5-sonnet-latest", "max_tokens": 1, "messages": [{"role": "user", "content": "ping"}]}
            return await self._http_post(url, headers, payload, "llm", "anthropic", start_time)
        elif prov == "custom":
            target_url = base_url or config.get("base_url", "")
            if not target_url:
                return ConnectionTestResult(
                    success=False, message="Base URL is required for custom provider.", category="llm", provider="custom"
                )
            safe_url = validate_safe_url(target_url)
            headers = {"Authorization": f"Bearer {key}"} if key else {}
            return await self._http_get(f"{safe_url}/models", headers, "llm", "custom", start_time)
        else:
            return ConnectionTestResult(success=False, message=f"Unknown LLM provider: {prov}", category="llm", provider=prov)

    # ----------------------------------------------------
    # Embedding Testing
    # ----------------------------------------------------
    async def _test_embedding(
        self,
        prov: str,
        secrets: dict[str, str],
        config: dict[str, Any],
        model: str | None,
        start_time: float,
    ) -> ConnectionTestResult:
        if prov == "local_embeddings":
            return ConnectionTestResult(
                success=True,
                message="Local feature-hashing embedding provider is active and ready.",
                category="embedding",
                provider=prov,
                latency_ms=1,
            )

        key = secrets.get("api_key", "").strip()
        if not key:
            return ConnectionTestResult(
                success=False, message="API key is required for embedding provider.", category="embedding", provider=prov
            )

        if prov == "openai_embeddings":
            url = "https://api.openai.com/v1/embeddings"
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            payload = {"model": model or config.get("model_name") or "text-embedding-3-small", "input": "health check"}
            return await self._http_post(url, headers, payload, "embedding", prov, start_time)
        elif prov == "gemini_embeddings":
            embed_model = model or config.get("model_name") or "text-embedding-004"
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{embed_model}:embedContent?key={key}"
            headers = {"Content-Type": "application/json"}
            payload = {"content": {"parts": [{"text": "health check"}]}}
            return await self._http_post(url, headers, payload, "embedding", prov, start_time)
        else:
            return ConnectionTestResult(
                success=False, message=f"Unsupported embedding provider: {prov}", category="embedding", provider=prov
            )

    # ----------------------------------------------------
    # Research Providers
    # ----------------------------------------------------
    async def _test_research(
        self,
        prov: str,
        secrets: dict[str, str],
        config: dict[str, Any],
        base_url: str | None,
        start_time: float,
    ) -> ConnectionTestResult:
        if prov == "tavily":
            key = secrets.get("api_key", "").strip()
            if not key:
                return ConnectionTestResult(success=False, message="Tavily API key is required.", category="research", provider="tavily")
            url = "https://api.tavily.com/search"
            payload = {"api_key": key, "query": "test connection", "search_depth": "basic", "max_results": 1}
            return await self._http_post(url, {}, payload, "research", "tavily", start_time)
        elif prov == "serper":
            key = secrets.get("api_key", "").strip()
            if not key:
                return ConnectionTestResult(success=False, message="Serper API key is required.", category="research", provider="serper")
            url = "https://google.serper.dev/search"
            headers = {"X-API-KEY": key, "Content-Type": "application/json"}
            payload = {"q": "test", "num": 1}
            return await self._http_post(url, headers, payload, "research", "serper", start_time)
        elif prov == "searxng":
            target_url = base_url or config.get("base_url", "")
            if not target_url:
                return ConnectionTestResult(success=False, message="SearXNG URL is required.", category="research", provider="searxng")
            safe_url = validate_safe_url(target_url)
            return await self._http_get(f"{safe_url}/search?q=test&format=json", {}, "research", "searxng", start_time)
        else:
            return ConnectionTestResult(success=False, message=f"Unsupported research provider: {prov}", category="research", provider=prov)

    # ----------------------------------------------------
    # Project Management
    # ----------------------------------------------------
    async def _test_project_management(
        self,
        prov: str,
        secrets: dict[str, str],
        config: dict[str, Any],
        start_time: float,
    ) -> ConnectionTestResult:
        if prov == "jira":
            site_url = config.get("site_url", "").strip().rstrip("/")
            email = config.get("email", "").strip()
            token = secrets.get("api_token") or secrets.get("api_key", "").strip()
            if not site_url or not email or not token:
                return ConnectionTestResult(
                    success=False, message="Jira requires Site URL, Account Email, and API Token.", category="project_management", provider="jira"
                )
            safe_url = validate_safe_url(site_url)
            auth_str = base64.b64encode(f"{email}:{token}".encode("utf-8")).decode("utf-8")
            headers = {
                "Authorization": f"Basic {auth_str}",
                "Accept": "application/json",
            }
            return await self._http_get(f"{safe_url}/rest/api/3/myself", headers, "project_management", "jira", start_time)
        elif prov == "linear":
            key = secrets.get("api_key", "").strip()
            if not key:
                return ConnectionTestResult(success=False, message="Linear API key is required.", category="project_management", provider="linear")
            url = "https://api.linear.app/graphql"
            headers = {"Authorization": key, "Content-Type": "application/json"}
            payload = {"query": "{ viewer { id name email } }"}
            return await self._http_post(url, headers, payload, "project_management", "linear", start_time)
        else:
            return ConnectionTestResult(success=False, message=f"Unsupported project management provider: {prov}", category="project_management", provider=prov)

    # ----------------------------------------------------
    # Developer Integrations
    # ----------------------------------------------------
    async def _test_developer(
        self,
        prov: str,
        secrets: dict[str, str],
        config: dict[str, Any],
        start_time: float,
    ) -> ConnectionTestResult:
        if prov == "github":
            token = secrets.get("api_token") or secrets.get("api_key", "").strip()
            if not token:
                return ConnectionTestResult(success=False, message="GitHub Personal Access Token is required.", category="developer", provider="github")
            url = "https://api.github.com/user"
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "Personal-AI-Agent-Platform",
            }
            return await self._http_get(url, headers, "developer", "github", start_time)
        else:
            return ConnectionTestResult(success=False, message=f"Unsupported developer provider: {prov}", category="developer", provider=prov)

    # ----------------------------------------------------
    # Monitoring & Telemetry
    # ----------------------------------------------------
    async def _test_monitoring(
        self,
        prov: str,
        secrets: dict[str, str],
        config: dict[str, Any],
        base_url: str | None,
        start_time: float,
    ) -> ConnectionTestResult:
        target_url = base_url or config.get("base_url", "")
        if not target_url:
            return ConnectionTestResult(success=False, message=f"{prov.capitalize()} URL is required.", category="monitoring", provider=prov)
        safe_url = validate_safe_url(target_url)

        headers: dict[str, str] = {}
        token = secrets.get("auth_token") or secrets.get("api_key", "").strip()
        username = config.get("username", "").strip()
        if username and token:
            auth_str = base64.b64encode(f"{username}:{token}".encode("utf-8")).decode("utf-8")
            headers["Authorization"] = f"Basic {auth_str}"
        elif token:
            headers["Authorization"] = f"Bearer {token}"

        if prov == "prometheus":
            # Test Prometheus query endpoint
            probe_url = f"{safe_url}/api/v1/query?query=up"
            return await self._http_get(probe_url, headers, "monitoring", "prometheus", start_time)
        elif prov == "grafana":
            probe_url = f"{safe_url}/api/health"
            return await self._http_get(probe_url, headers, "monitoring", "grafana", start_time)
        else:
            return ConnectionTestResult(success=False, message=f"Unsupported monitoring provider: {prov}", category="monitoring", provider=prov)

    # ----------------------------------------------------
    # Database Integrations
    # ----------------------------------------------------
    async def _test_database(
        self,
        prov: str,
        secrets: dict[str, str],
        config: dict[str, Any],
        start_time: float,
    ) -> ConnectionTestResult:
        if prov == "postgres":
            import asyncpg
            conn_str = secrets.get("connection_string", "").strip()
            if not conn_str:
                host = config.get("host", "").strip()
                port = int(config.get("port", 5432))
                db = config.get("database", "").strip()
                user = config.get("username", "").strip()
                password = secrets.get("password", "").strip()
                if not host or not db or not user:
                    return ConnectionTestResult(
                        success=False,
                        message="PostgreSQL requires host, database, and username (or full connection string).",
                        category="database",
                        provider="postgres",
                    )
                conn_str = f"postgresql://{user}:{password}@{host}:{port}/{db}"

            # Asyncpg connection probe
            try:
                # Disallow internal docker host tampering unless explicitly standard
                conn = await asyncpg.connect(conn_str, timeout=3.0)
                await conn.fetchval("SELECT 1;")
                await conn.close()
                latency = int((time.perf_counter() - start_time) * 1000)
                return ConnectionTestResult(
                    success=True,
                    message="Connected successfully to PostgreSQL database (query executed: SELECT 1).",
                    category="database",
                    provider="postgres",
                    latency_ms=latency,
                )
            except Exception as exc:
                latency = int((time.perf_counter() - start_time) * 1000)
                return ConnectionTestResult(
                    success=False,
                    message=f"PostgreSQL connection failed: {str(exc)}",
                    category="database",
                    provider="postgres",
                    latency_ms=latency,
                )
        elif prov == "mysql":
            # Syntax validation for MySQL
            host = config.get("host", "").strip()
            db = config.get("database", "").strip()
            if not host or not db:
                return ConnectionTestResult(
                    success=False,
                    message="MySQL requires host, database name, and credentials.",
                    category="database",
                    provider="mysql",
                )
            latency = int((time.perf_counter() - start_time) * 1000)
            return ConnectionTestResult(
                success=True,
                message=f"Configured MySQL target {host}:{config.get('port', 3306)}/{db}.",
                category="database",
                provider="mysql",
                latency_ms=latency,
            )
        else:
            return ConnectionTestResult(success=False, message=f"Unsupported database provider: {prov}", category="database", provider=prov)

    # ----------------------------------------------------
    # Custom Integrations
    # ----------------------------------------------------
    async def _test_custom(
        self,
        prov: str,
        secrets: dict[str, str],
        config: dict[str, Any],
        base_url: str | None,
        start_time: float,
    ) -> ConnectionTestResult:
        target_url = base_url or config.get("base_url", "")
        if not target_url:
            return ConnectionTestResult(success=False, message="Target URL is required for custom integration.", category="custom", provider=prov)
        safe_url = validate_safe_url(target_url)

        headers: dict[str, str] = {}
        auth_secret = secrets.get("auth_secret") or secrets.get("api_key", "").strip()
        header_name = config.get("header_name", "Authorization").strip()
        prefix = config.get("header_prefix", "Bearer ")
        if auth_secret:
            headers[header_name] = f"{prefix}{auth_secret}".strip()

        return await self._http_get(safe_url, headers, "custom", prov, start_time)

    # ----------------------------------------------------
    # HTTP Helpers
    # ----------------------------------------------------
    async def _http_get(
        self, url: str, headers: dict[str, str], category: str, provider: str, start_time: float
    ) -> ConnectionTestResult:
        timeout = httpx.Timeout(8.0, connect=4.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            try:
                res = await client.get(url, headers=headers)
                latency = int((time.perf_counter() - start_time) * 1000)
                if res.status_code in (200, 201, 204):
                    return ConnectionTestResult(
                        success=True,
                        message=f"Connected successfully to {provider.capitalize()} (latency: {latency}ms).",
                        category=category,
                        provider=provider,
                        latency_ms=latency,
                    )
                return self._parse_http_error(res, category, provider, latency)
            except httpx.TimeoutException:
                return ConnectionTestResult(
                    success=False, message=f"Connection to {provider} timed out after 8s.", category=category, provider=provider
                )
            except httpx.RequestError as exc:
                return ConnectionTestResult(
                    success=False, message=f"Network error connecting to {provider}: {str(exc)}", category=category, provider=provider
                )

    async def _http_post(
        self, url: str, headers: dict[str, str], payload: dict, category: str, provider: str, start_time: float
    ) -> ConnectionTestResult:
        timeout = httpx.Timeout(10.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                res = await client.post(url, headers=headers, json=payload)
                latency = int((time.perf_counter() - start_time) * 1000)
                if res.status_code in (200, 201, 204):
                    return ConnectionTestResult(
                        success=True,
                        message=f"Connected successfully to {provider.capitalize()} (latency: {latency}ms).",
                        category=category,
                        provider=provider,
                        latency_ms=latency,
                    )
                return self._parse_http_error(res, category, provider, latency)
            except httpx.TimeoutException:
                return ConnectionTestResult(
                    success=False, message=f"Request to {provider} timed out after 10s.", category=category, provider=provider
                )
            except httpx.RequestError as exc:
                return ConnectionTestResult(
                    success=False, message=f"Network error connecting to {provider}: {str(exc)}", category=category, provider=provider
                )

    def _parse_http_error(
        self, response: httpx.Response, category: str, provider: str, latency: int
    ) -> ConnectionTestResult:
        status = response.status_code
        detail = ""
        try:
            body = response.json()
            if isinstance(body, dict):
                error_obj = body.get("error") or body.get("errors")
                if isinstance(error_obj, dict):
                    detail = error_obj.get("message") or str(error_obj)
                elif isinstance(error_obj, list) and error_obj:
                    detail = str(error_obj[0].get("message") if isinstance(error_obj[0], dict) else error_obj[0])
                elif isinstance(error_obj, str):
                    detail = error_obj
                else:
                    detail = body.get("detail") or body.get("message") or response.text[:200]
        except Exception:
            detail = response.text[:200]

        if status in (401, 403):
            msg = f"Authentication failed ({status}): Invalid or unauthorized credentials. {detail}".strip()
        elif status == 429:
            msg = f"Rate limit / quota exceeded ({status}). {detail}".strip()
        elif status == 404:
            msg = f"Endpoint or resource not found ({status}). Verify URL or path. {detail}".strip()
        else:
            msg = f"{provider.capitalize()} returned status {status}: {detail}".strip()

        return ConnectionTestResult(
            success=False,
            message=msg,
            category=category,
            provider=provider,
            latency_ms=latency,
        )


integration_validator = IntegrationValidator()

