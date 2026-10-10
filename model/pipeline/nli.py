"""
Cross-Encoder NLI (Natural Language Inference) module.

Scores (premise_passage, hypothesis_claim) pairs for:
  - entailment
  - neutral
  - contradiction

Loaded once at startup (lazy singleton), forced CPU-safe.
Supports batched execution and graceful fallback if model weights are unavailable.
"""

import re
from typing import List, Tuple, Literal, Optional
from pydantic import BaseModel, Field

from model.config import settings

# Try importing transformers / torch
try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False


class NLIScore(BaseModel):
    entailment: float = Field(..., ge=0.0, le=1.0)
    neutral: float = Field(..., ge=0.0, le=1.0)
    contradiction: float = Field(..., ge=0.0, le=1.0)
    label: Literal["entailment", "neutral", "contradiction"]


_NLI_MODEL = None
_NLI_TOKENIZER = None


def _get_nli_model_and_tokenizer():
    global _NLI_MODEL, _NLI_TOKENIZER
    if not HAS_TRANSFORMERS:
        return None, None

    if _NLI_MODEL is None or _NLI_TOKENIZER is None:
        try:
            model_name = settings.NLI_MODEL_NAME
            _NLI_TOKENIZER = AutoTokenizer.from_pretrained(model_name)
            _NLI_MODEL = AutoModelForSequenceClassification.from_pretrained(model_name)
            # Ensure CPU execution
            _NLI_MODEL.to("cpu")
            _NLI_MODEL.eval()
        except Exception:
            _NLI_MODEL = None
            _NLI_TOKENIZER = None

    return _NLI_MODEL, _NLI_TOKENIZER


def _heuristic_nli_score(premise: str, hypothesis: str) -> NLIScore:
    """
    Heuristic NLI scoring for fallback when neural NLI weights are unavailable.
    Detects exact matches, numeric contradictions, and key word overlaps.
    """
    prem_clean = premise.lower().strip()
    hyp_clean = hypothesis.lower().strip()

    # Substring / exact match check
    if hyp_clean in prem_clean or prem_clean in hyp_clean:
        return NLIScore(entailment=0.92, neutral=0.05, contradiction=0.03, label="entailment")

    # Extract numbers
    prem_nums = set(re.findall(r'\b\d+(?:\.\d+)?\b', prem_clean))
    hyp_nums = set(re.findall(r'\b\d+(?:\.\d+)?\b', hyp_clean))

    # Explicit numeric contradiction check
    if prem_nums and hyp_nums and prem_nums != hyp_nums:
        # Check if numbers overlap at all
        if not (prem_nums & hyp_nums):
            return NLIScore(entailment=0.05, neutral=0.10, contradiction=0.85, label="contradiction")

    # Explicit negation contradiction check
    negations = {"not", "no", "never", "cannot", "prohibited", "against"}
    hyp_words = set(re.findall(r'\w+', hyp_clean))
    prem_words = set(re.findall(r'\w+', prem_clean))

    hyp_has_neg = bool(hyp_words & negations)
    prem_has_neg = bool(prem_words & negations)

    overlap = len(hyp_words & prem_words) / max(len(hyp_words), 1)

    if hyp_has_neg != prem_has_neg and overlap > 0.4:
        return NLIScore(entailment=0.08, neutral=0.12, contradiction=0.80, label="contradiction")

    if overlap > 0.6:
        return NLIScore(entailment=0.78, neutral=0.18, contradiction=0.04, label="entailment")
    elif overlap > 0.3:
        return NLIScore(entailment=0.45, neutral=0.45, contradiction=0.10, label="neutral")
    else:
        return NLIScore(entailment=0.10, neutral=0.80, contradiction=0.10, label="neutral")


def score_nli_pairs(pairs: List[Tuple[str, str]], batch_size: int = 16) -> List[NLIScore]:
    """
    Batched NLI scoring for a list of (premise, hypothesis) pairs.
    """
    if not pairs:
        return []

    model, tokenizer = _get_nli_model_and_tokenizer()

    if model is None or tokenizer is None:
        # Fallback to heuristic scoring
        return [_heuristic_nli_score(p, h) for p, h in pairs]

    results: List[NLIScore] = []

    try:
        for i in range(0, len(pairs), batch_size):
            batch = pairs[i : i + batch_size]
            premises = [p for p, h in batch]
            hypotheses = [h for p, h in batch]

            inputs = tokenizer(
                premises,
                hypotheses,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt"
            )

            with torch.no_grad():
                outputs = model(**inputs)
                logits = outputs.logits
                probs = torch.softmax(logits, dim=-1).cpu().tolist()

            # Map logits to labels according to model id2label
            id2label = getattr(model.config, "id2label", {0: "contradiction", 1: "neutral", 2: "entailment"})

            for p_list in probs:
                label_prob_map = {}
                for idx, prob in enumerate(p_list):
                    l_str = str(id2label.get(idx, idx)).lower()
                    if "entail" in l_str:
                        label_prob_map["entailment"] = prob
                    elif "contra" in l_str:
                        label_prob_map["contradiction"] = prob
                    else:
                        label_prob_map["neutral"] = prob

                ent = round(float(label_prob_map.get("entailment", 0.0)), 4)
                neu = round(float(label_prob_map.get("neutral", 0.0)), 4)
                con = round(float(label_prob_map.get("contradiction", 0.0)), 4)

                max_label: Literal["entailment", "neutral", "contradiction"] = "neutral"
                if ent >= neu and ent >= con:
                    max_label = "entailment"
                elif con >= ent and con >= neu:
                    max_label = "contradiction"

                results.append(NLIScore(entailment=ent, neutral=neu, contradiction=con, label=max_label))

    except Exception:
        # If model inference fails, fallback gracefully to heuristic scoring
        return [_heuristic_nli_score(p, h) for p, h in pairs]

    return results
