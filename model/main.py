from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from contextlib import asynccontextmanager

from model.api import router
from model.config import settings
from model.logging_config import logger
from model.schemas import ErrorDetail, ErrorResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Second Opinion Model Service. Performing model warm-up...")
    try:
        from model.pipeline import score_nli_pairs, retrieve_chunks
        from model.schemas.primitives import Source

        score_nli_pairs([("Warmup premise.", "Warmup hypothesis.")])
        retrieve_chunks(
            "Warmup claim",
            [Source(id="warmup-src", title="Warmup", text="Warmup passage text.")],
        )
        logger.info("Model warm-up completed successfully.")
    except Exception as exc:
        logger.warning("Startup model warm-up notice: %s", exc)
    yield
    logger.info("Shutting down Second Opinion Model Service.")


app = FastAPI(
    title="Second Opinion - Model Service",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.include_router(router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    error_resp = ErrorResponse(
        error=ErrorDetail(
            code="VALIDATION_ERROR",
            message="Request body failed schema validation",
            details=exc.errors(),
        )
    )
    return JSONResponse(status_code=400, content=error_resp.model_dump())


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    code_map = {
        400: "VALIDATION_ERROR",
        404: "NOT_FOUND",
        422: "UNPROCESSABLE_ENTITY",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
        503: "MODEL_UNAVAILABLE",
    }
    error_code = code_map.get(exc.status_code, "HTTP_ERROR")
    error_resp = ErrorResponse(
        error=ErrorDetail(
            code=error_code,
            message=str(exc.detail),
        )
    )
    return JSONResponse(status_code=exc.status_code, content=error_resp.model_dump())


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.url.path}: {exc}", exc_info=True)
    error_resp = ErrorResponse(
        error=ErrorDetail(
            code="INTERNAL_ERROR",
            message="An unexpected server error occurred",
        )
    )
    return JSONResponse(status_code=500, content=error_resp.model_dump())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("model.main:app", host=settings.HOST, port=settings.PORT, reload=True)
