import json
import logging
import httpx
from openai import AsyncOpenAI
from app.services.llm_resolver import ResolvedLLMConfig

logger = logging.getLogger(__name__)


class LLMService:
    async def answer_from_context(
        self,
        question: str,
        contexts: list[dict],
        llm_config: ResolvedLLMConfig | None = None,
    ) -> str:
        if not contexts:
            return (
                "I couldn't find any indexed document passages for this question. "
                "Upload a supported document and wait until its status is 'ready'."
            )

        if llm_config is None or not llm_config.api_key:
            excerpts = "\n\n".join(
                f"• {item['filename']} (chunk {item['chunk_index']}): {item['content'][:700]}"
                for item in contexts[:4]
            )
            return (
                "No AI provider API key is configured. You can add your OpenAI, Gemini, Groq, "
                "DeepSeek, OpenRouter, Anthropic, or Custom API key in Settings → API Keys.\n\n"
                "Retrieved passages from your knowledge base preview:\n\n" + excerpts
            )

        joined_context = "\n\n".join(
            f"[Source: {item['filename']} | chunk {item['chunk_index']}]\n{item['content']}"
            for item in contexts
        )
        system_content = (
            "Answer using only the supplied document context. If the context does not support an answer, "
            "say so. Cite sources using their filename in square brackets. Do not invent facts.\n\n"
            f"DOCUMENT CONTEXT:\n{joined_context}"
        )

        if llm_config.provider == "anthropic":
            return await self._call_anthropic_chat(
                system_prompt=system_content,
                user_prompt=question,
                llm_config=llm_config,
            )

        # OpenAI, Gemini, Groq, DeepSeek, OpenRouter, Custom
        client_kwargs = {"api_key": llm_config.api_key}
        if llm_config.base_url:
            client_kwargs["base_url"] = llm_config.base_url

        client = AsyncOpenAI(**client_kwargs)
        response = await client.chat.completions.create(
            model=llm_config.model,
            temperature=0.2,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": question},
            ],
        )
        return response.choices[0].message.content or "The model returned an empty response."

    async def extract_document_fields(
        self,
        filename: str,
        text: str,
        instructions: str,
        fields: list[str],
        llm_config: ResolvedLLMConfig | None = None,
    ) -> dict:
        requested = fields or ["document_type", "key_entities", "important_dates", "amounts", "summary"]

        if llm_config is None or not llm_config.api_key:
            return {
                "mode": "preview",
                "filename": filename,
                "requested_fields": requested,
                "instructions": instructions,
                "extracted_text_preview": text[:10000],
                "warning": (
                    "No AI provider API key is configured. "
                    "Configure an API key in Settings → API Keys to enable structured AI extraction."
                ),
            }

        system_content = (
            "Extract requested fields from the supplied document. Return ONLY valid JSON with no markdown wrapping. "
            "Do not guess or invent missing values; use null or an empty array when unsupported. "
            "Include evidence snippets for important extracted values when possible."
        )
        user_content = (
            f"Filename: {filename}\nInstructions: {instructions or 'Extract the requested information.'}\n"
            f"Requested fields: {json.dumps(requested)}\nDOCUMENT TEXT:\n{text[:50000]}"
        )

        if llm_config.provider == "anthropic":
            raw_text = await self._call_anthropic_chat(
                system_prompt=system_content,
                user_prompt=user_content,
                llm_config=llm_config,
            )
            return self._parse_json_response(raw_text)

        client_kwargs = {"api_key": llm_config.api_key}
        if llm_config.base_url:
            client_kwargs["base_url"] = llm_config.base_url

        client = AsyncOpenAI(**client_kwargs)
        try:
            response = await client.chat.completions.create(
                model=llm_config.model,
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user_content},
                ],
            )
            content = response.choices[0].message.content or "{}"
            return self._parse_json_response(content)
        except Exception:
            # Fallback without response_format in case custom or older provider does not support it
            response = await client.chat.completions.create(
                model=llm_config.model,
                temperature=0,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": user_content},
                ],
            )
            content = response.choices[0].message.content or "{}"
            return self._parse_json_response(content)

    async def _call_anthropic_chat(
        self, system_prompt: str, user_prompt: str, llm_config: ResolvedLLMConfig
    ) -> str:
        headers = {
            "x-api-key": llm_config.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        url = f"{llm_config.base_url or 'https://api.anthropic.com/v1'}/messages"
        payload = {
            "model": llm_config.model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        timeout = httpx.Timeout(30.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code != 200:
                raise RuntimeError(f"Anthropic API call failed with status {res.status_code}: {res.text}")
            data = res.json()
            parts = [item.get("text", "") for item in data.get("content", []) if item.get("type") == "text"]
            return "".join(parts) or "The model returned an empty response."

    def _parse_json_response(self, text: str) -> dict:
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {"raw_model_output": text, "warning": "Model output was not valid JSON."}


llm_service = LLMService()
