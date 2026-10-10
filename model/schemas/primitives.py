from pydantic import BaseModel, Field


class Span(BaseModel):
    start: int = Field(..., ge=0, description="0-based start character offset (inclusive)")
    end: int = Field(..., ge=0, description="0-based end character offset (exclusive)")


SourceSpan = Span


class Source(BaseModel):
    id: str = Field(..., min_length=1, description="Caller-supplied opaque ID")
    title: str = Field(..., min_length=1, max_length=500, description="Human-readable title")
    text: str = Field(..., min_length=1, max_length=200000, description="Plaintext of document")
