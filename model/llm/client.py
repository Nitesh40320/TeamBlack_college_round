from typing import Any, Dict, Optional, Type, Union
from pydantic import BaseModel
from model.llm.json_repair import repair_and_parse_json
from model.llm.providers import BaseLLMProvider, get_llm_provider
from model.logging_config import logger


class LLMClient:
    def __init__(
        self,
        provider: Optional[BaseLLMProvider] = None,
        provider_name: Optional[str] = None,
    ):
        self.provider = provider or get_llm_provider(provider_name)

    async def generate_json(
        self,
        prompt: str,
        schema: Union[Type[BaseModel], Dict[str, Any]],
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        """Generate structured JSON response from LLM with automatic repair and retries."""
        schema_info = ""
        if isinstance(schema, type) and issubclass(schema, BaseModel):
            schema_info = f"\nReturn valid JSON matching this schema:\n{schema.model_json_schema()}"
        elif isinstance(schema, dict):
            schema_info = f"\nReturn valid JSON matching this schema:\n{schema}"

        full_prompt = f"{prompt}\n{schema_info}\nOutput strictly raw JSON without markdown formatting."
        current_prompt = full_prompt

        last_exception: Optional[Exception] = None

        for attempt in range(1, max_retries + 1):
            try:
                raw_response = await self.provider.generate(current_prompt)
                parsed_data = repair_and_parse_json(raw_response)

                if isinstance(schema, type) and issubclass(schema, BaseModel):
                    # Validate against Pydantic model
                    validated = schema.model_validate(parsed_data)
                    return validated.model_dump()
                return parsed_data
            except Exception as exc:
                last_exception = exc
                logger.warning(
                    f"Attempt {attempt}/{max_retries} failed to produce valid JSON: {exc}"
                )
                current_prompt = (
                    f"{full_prompt}\n\nYour previous response failed validation with error: {exc}. "
                    "Please fix the formatting and return valid raw JSON."
                )

        raise RuntimeError(
            f"Failed to generate valid JSON after {max_retries} retries: {last_exception}"
        ) from last_exception
