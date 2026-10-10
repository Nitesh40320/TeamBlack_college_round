from typing import List, Optional
from pydantic import BaseModel, Field
from model.schemas.primitives import Source


class AuditRequest(BaseModel):
    question: Optional[str] = Field(default=None, max_length=2000, description="Optional user prompt")
    answer: str = Field(..., min_length=1, max_length=50000, description="The AI-generated text to audit")
    sources: List[Source] = Field(..., min_length=1, max_length=20, description="1-20 source documents")
