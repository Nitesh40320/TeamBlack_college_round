import json
import re
from typing import Any, Dict


def repair_and_parse_json(text: str) -> Dict[str, Any]:
    """Clean LLM output and parse JSON, attempting common repairs if necessary."""
    text = text.strip()

    # 1. Extract block inside markdown code fence if present
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if match:
        text = match.group(1).strip()

    # 2. Extract first '{' or '[' to last '}' or ']'
    start_curly = text.find("{")
    start_bracket = text.find("[")
    
    if start_curly != -1 and (start_bracket == -1 or start_curly < start_bracket):
        end_curly = text.rfind("}")
        if end_curly != -1 and end_curly > start_curly:
            text = text[start_curly : end_curly + 1]
    elif start_bracket != -1:
        end_bracket = text.rfind("]")
        if end_bracket != -1 and end_bracket > start_bracket:
            text = text[start_bracket : end_bracket + 1]

    # Try standard parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Apply regex repairs for trailing commas
    repaired = re.sub(r",\s*([}\]])", r"\1", text)
    
    try:
        return json.loads(repaired)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse or repair JSON from LLM output: {exc}. Original text sample: {text[:200]}") from exc
