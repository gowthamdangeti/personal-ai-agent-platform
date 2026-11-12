from app.schemas.integrations import FieldDefinition, IntegrationCatalogItem

INTEGRATION_CATALOG: list[IntegrationCatalogItem] = [
    # ----------------------------------------------------
    # 1. AI PROVIDERS (LLM)
    # ----------------------------------------------------
    IntegrationCatalogItem(
        id="openai",
        name="OpenAI",
        category="llm",
        description="Official OpenAI models including GPT-4o, GPT-4o-mini, and reasoning models.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="API Key", type="password", required=True, placeholder="sk-proj-..."),
        ],
        config_fields=[
            FieldDefinition(name="organization_id", label="Organization ID (Optional)", type="text", placeholder="org-..."),
        ],
        default_model="gpt-4o-mini",
        suggested_models=["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo", "o3-mini"],
        requires_base_url=False,
        default_base_url="https://api.openai.com/v1",
    ),
    IntegrationCatalogItem(
        id="gemini",
        name="Google Gemini",
        category="llm",
        description="Google Gemini models with 1M+ token context windows and multimodal capabilities.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Gemini API Key", type="password", required=True, placeholder="AIzaSy..."),
        ],
        default_model="gemini-1.5-flash",
        suggested_models=["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"],
        requires_base_url=False,
        default_base_url="https://generativelanguage.googleapis.com/v1beta/openai",
    ),
    IntegrationCatalogItem(
        id="groq",
        name="Groq",
        category="llm",
        description="Ultra-fast LPU inference hosting open models like Llama 3 and Mixtral.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Groq API Key", type="password", required=True, placeholder="gsk_..."),
        ],
        default_model="llama-3.3-70b-versatile",
        suggested_models=["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
        requires_base_url=False,
        default_base_url="https://api.groq.com/openai/v1",
    ),
    IntegrationCatalogItem(
        id="deepseek",
        name="DeepSeek",
        category="llm",
        description="Advanced coding and reasoning models with high cost-efficiency.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="DeepSeek API Key", type="password", required=True, placeholder="sk-..."),
        ],
        default_model="deepseek-chat",
        suggested_models=["deepseek-chat", "deepseek-reasoner"],
        requires_base_url=False,
        default_base_url="https://api.deepseek.com",
    ),
    IntegrationCatalogItem(
        id="openrouter",
        name="OpenRouter",
        category="llm",
        description="Unified gateway to hundreds of open-source and proprietary models.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="OpenRouter API Key", type="password", required=True, placeholder="sk-or-..."),
        ],
        default_model="openai/gpt-4o-mini",
        suggested_models=["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.3-70b-instruct"],
        requires_base_url=False,
        default_base_url="https://openrouter.ai/api/v1",
    ),
    IntegrationCatalogItem(
        id="anthropic",
        name="Anthropic",
        category="llm",
        description="Claude models specialized in nuanced analysis, complex writing, and coding.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Anthropic API Key", type="password", required=True, placeholder="sk-ant-..."),
        ],
        default_model="claude-3-5-sonnet-latest",
        suggested_models=["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
        requires_base_url=False,
        default_base_url="https://api.anthropic.com/v1",
    ),
    IntegrationCatalogItem(
        id="custom",
        name="Custom (OpenAI-Compatible)",
        category="llm",
        description="Self-hosted vLLM, Ollama, LM Studio, LocalAI, or corporate gateways.",
        supported_auth_methods=["api_key", "bearer_token"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Bearer Token / API Key", type="password", required=True, placeholder="token-..."),
        ],
        config_fields=[
            FieldDefinition(name="base_url", label="Base URL", type="url", required=True, placeholder="http://my-vllm:8000/v1"),
            FieldDefinition(name="model_name", label="Model Name", type="text", required=True, placeholder="meta-llama/Llama-3-8B-Instruct"),
        ],
        default_model="default",
        suggested_models=["default"],
        requires_base_url=True,
    ),

    # ----------------------------------------------------
    # 2. EMBEDDING PROVIDERS
    # ----------------------------------------------------
    IntegrationCatalogItem(
        id="openai_embeddings",
        name="OpenAI Embeddings",
        category="embedding",
        description="High-performance dense vector embeddings from OpenAI.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="API Key", type="password", required=True, placeholder="sk-..."),
        ],
        config_fields=[
            FieldDefinition(name="model_name", label="Embedding Model", type="text", default="text-embedding-3-small", options=["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"]),
            FieldDefinition(name="dimensions", label="Dimensions", type="number", default=384),
        ],
        default_model="text-embedding-3-small",
        suggested_models=["text-embedding-3-small", "text-embedding-3-large"],
    ),
    IntegrationCatalogItem(
        id="gemini_embeddings",
        name="Google Gemini Embeddings",
        category="embedding",
        description="Google Gemini semantic text embedding models.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Gemini API Key", type="password", required=True, placeholder="AIzaSy..."),
        ],
        config_fields=[
            FieldDefinition(name="model_name", label="Embedding Model", type="text", default="text-embedding-004"),
        ],
        default_model="text-embedding-004",
        suggested_models=["text-embedding-004"],
    ),
    IntegrationCatalogItem(
        id="local_embeddings",
        name="Local Feature-Hashing (Built-in)",
        category="embedding",
        description="Zero-dependency deterministic vector generator for local development and testing.",
        supported_auth_methods=["none"],
        secret_fields=[],
        config_fields=[
            FieldDefinition(name="dimensions", label="Dimensions", type="number", default=384),
        ],
        default_model="local-hash-384",
    ),

    # ----------------------------------------------------
    # 3. RESEARCH & SEARCH PROVIDERS
    # ----------------------------------------------------
    IntegrationCatalogItem(
        id="tavily",
        name="Tavily Search",
        category="research",
        description="Search engine optimized for AI agents and LLM research synthesis.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Tavily API Key", type="password", required=True, placeholder="tvly-..."),
        ],
        config_fields=[
            FieldDefinition(name="search_depth", label="Search Depth", type="select", options=["basic", "advanced"], default="basic"),
            FieldDefinition(name="include_domains", label="Include Domains (comma-separated)", type="text", placeholder="arxiv.org,github.com"),
        ],
    ),
    IntegrationCatalogItem(
        id="serper",
        name="Google Serper",
        category="research",
        description="Fast Google Search API for live web results, news, and scholar articles.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Serper API Key", type="password", required=True, placeholder="serper_key_..."),
        ],
        config_fields=[
            FieldDefinition(name="gl", label="Geographic Location (Country Code)", type="text", default="us"),
            FieldDefinition(name="hl", label="Search Language", type="text", default="en"),
        ],
    ),
    IntegrationCatalogItem(
        id="searxng",
        name="SearXNG",
        category="research",
        description="Self-hosted, privacy-respecting metasearch engine aggregator.",
        supported_auth_methods=["none", "api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Access Token / Secret (Optional)", type="password", required=False),
        ],
        config_fields=[
            FieldDefinition(name="base_url", label="SearXNG Instance URL", type="url", required=True, placeholder="http://localhost:8080"),
        ],
        requires_base_url=True,
    ),

    # ----------------------------------------------------
    # 4. PROJECT MANAGEMENT
    # ----------------------------------------------------
    IntegrationCatalogItem(
        id="jira",
        name="Atlassian Jira Cloud",
        category="project_management",
        description="Sync action items, create tickets, and manage sprints in Jira.",
        supported_auth_methods=["basic_auth_token"],
        secret_fields=[
            FieldDefinition(name="api_token", label="Jira API Token", type="password", required=True, placeholder="ATATT..."),
        ],
        config_fields=[
            FieldDefinition(name="site_url", label="Jira Site URL", type="url", required=True, placeholder="https://your-domain.atlassian.net"),
            FieldDefinition(name="email", label="Atlassian Account Email", type="text", required=True, placeholder="you@company.com"),
            FieldDefinition(name="project_key", label="Default Project Key", type="text", placeholder="ENG"),
            FieldDefinition(name="cloud_id", label="Atlassian Cloud ID (Optional)", type="text"),
        ],
    ),
    IntegrationCatalogItem(
        id="linear",
        name="Linear",
        category="project_management",
        description="Issue tracking and software project workflows with Linear.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Linear Personal API Key", type="password", required=True, placeholder="lin_api_..."),
        ],
        config_fields=[
            FieldDefinition(name="team_key", label="Default Team Key", type="text", placeholder="ENG"),
        ],
    ),

    # ----------------------------------------------------
    # 5. DEVELOPER INTEGRATIONS
    # ----------------------------------------------------
    IntegrationCatalogItem(
        id="github",
        name="GitHub",
        category="developer",
        description="Read repositories, pull requests, diffs, and OpenAPI specs for QA testing.",
        supported_auth_methods=["pat_token"],
        secret_fields=[
            FieldDefinition(name="api_token", label="GitHub Personal Access Token (PAT)", type="password", required=True, placeholder="ghp_... or github_pat_..."),
        ],
        config_fields=[
            FieldDefinition(name="default_org", label="Default Organization / Owner", type="text", placeholder="my-org"),
            FieldDefinition(name="default_repo", label="Default Repository", type="text", placeholder="my-repo"),
        ],
    ),

    # ----------------------------------------------------
    # 6. MONITORING & TELEMETRY
    # ----------------------------------------------------
    IntegrationCatalogItem(
        id="prometheus",
        name="Prometheus",
        category="monitoring",
        description="Query Prometheus time-series metrics for server and cluster diagnostics.",
        supported_auth_methods=["none", "bearer_token", "basic_auth"],
        secret_fields=[
            FieldDefinition(name="auth_token", label="Bearer Token or Password (Optional)", type="password", required=False),
        ],
        config_fields=[
            FieldDefinition(name="base_url", label="Prometheus Server URL", type="url", required=True, placeholder="http://localhost:9090"),
            FieldDefinition(name="username", label="Basic Auth Username (Optional)", type="text"),
        ],
        requires_base_url=True,
    ),
    IntegrationCatalogItem(
        id="grafana",
        name="Grafana",
        category="monitoring",
        description="Interact with Grafana dashboards, alerting channels, and telemetry datasources.",
        supported_auth_methods=["api_key"],
        secret_fields=[
            FieldDefinition(name="api_key", label="Grafana Service Account Token", type="password", required=True, placeholder="glsa_..."),
        ],
        config_fields=[
            FieldDefinition(name="base_url", label="Grafana Instance URL", type="url", required=True, placeholder="http://localhost:3000"),
        ],
        requires_base_url=True,
    ),

    # ----------------------------------------------------
    # 7. EXTERNAL DATABASES
    # ----------------------------------------------------
    IntegrationCatalogItem(
        id="postgres",
        name="External PostgreSQL",
        category="database",
        description="External Postgres database connection for text-to-SQL analytics and reporting.",
        supported_auth_methods=["connection_string", "user_password"],
        secret_fields=[
            FieldDefinition(name="connection_string", label="Full Connection URI (or provide details below)", type="password", placeholder="postgresql+asyncpg://user:pass@host:5432/dbname"),
            FieldDefinition(name="password", label="Database Password", type="password"),
        ],
        config_fields=[
            FieldDefinition(name="host", label="Host", type="text", placeholder="db.company.internal"),
            FieldDefinition(name="port", label="Port", type="number", default=5432),
            FieldDefinition(name="database", label="Database Name", type="text", placeholder="analytics"),
            FieldDefinition(name="username", label="User Name", type="text", placeholder="analyst_ro"),
            FieldDefinition(name="ssl_mode", label="SSL Mode", type="select", options=["disable", "require", "verify-ca", "verify-full"], default="require"),
        ],
    ),
    IntegrationCatalogItem(
        id="mysql",
        name="External MySQL / MariaDB",
        category="database",
        description="External MySQL database for read-only business data analytics.",
        supported_auth_methods=["connection_string", "user_password"],
        secret_fields=[
            FieldDefinition(name="password", label="Database Password", type="password", required=True),
        ],
        config_fields=[
            FieldDefinition(name="host", label="Host", type="text", required=True, placeholder="mysql.company.internal"),
            FieldDefinition(name="port", label="Port", type="number", default=3306),
            FieldDefinition(name="database", label="Database Name", type="text", required=True, placeholder="reports"),
            FieldDefinition(name="username", label="User Name", type="text", required=True, placeholder="ro_user"),
        ],
    ),

    # ----------------------------------------------------
    # 8. CUSTOM INTEGRATIONS
    # ----------------------------------------------------
    IntegrationCatalogItem(
        id="custom_webhook",
        name="Custom HTTP / Webhook",
        category="custom",
        description="Generic HTTP/REST endpoint supporting custom authorization headers.",
        supported_auth_methods=["bearer_token", "api_key_header", "basic_auth"],
        secret_fields=[
            FieldDefinition(name="auth_secret", label="Auth Secret / Token / Key", type="password", required=True),
        ],
        config_fields=[
            FieldDefinition(name="base_url", label="Endpoint URL", type="url", required=True, placeholder="https://api.internal.corp/v1"),
            FieldDefinition(name="header_name", label="Header Name", type="text", default="Authorization", placeholder="Authorization or X-API-Key"),
            FieldDefinition(name="header_prefix", label="Header Prefix", type="text", default="Bearer ", placeholder="Bearer  (with space) or empty"),
        ],
        requires_base_url=True,
    ),
]


def get_catalog_item(provider_id: str) -> IntegrationCatalogItem | None:
    target = provider_id.lower().strip()
    for item in INTEGRATION_CATALOG:
        if item.id.lower() == target:
            return item
    return None


def get_catalog_by_category(category: str) -> list[IntegrationCatalogItem]:
    cat = category.lower().strip()
    return [item for item in INTEGRATION_CATALOG if item.category.lower() == cat]

