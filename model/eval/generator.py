"""
Benchmark Dataset Generator & Split Manager.

Generates and manages labeled audit benchmark datasets with injected errors:
  1. hallucinated_fact (specific detail absent from every source)
  2. numeric_change (altering numbers/units/percentages)
  3. entity_swap (swapping named entities or terms)
  4. negation (flipping polarity/negation)
  5. unsupported_addition (adding ungrounded extra claim)
  6. non_sequitur (flawed premise-conclusion inference)
  7. unsafe_advice (hazardous medical/dosage/legal advice)
  8. ambiguous_wording (vague quantifiers / hedges)

Writes train, dev, and test split JSONL files to model/eval/data/.
"""

import json
import os
import random
import sys
from typing import List, Dict, Any

# Ensure project root is in sys.path so 'model' imports resolve from anywhere
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))


RAW_BENCHMARK_CASES: List[Dict[str, Any]] = [
    # Case 1: Medical Dosage Mismatch + Unsafe Advice
    {
        "id": "case-med-001",
        "question": "What is the standard adult dose of aspirin for fever and pain?",
        "sources": [
            {
                "id": "src-med-1",
                "title": "BNF Aspirin Clinical Guidelines",
                "text": "Aspirin (acetylsalicylic acid) is indicated for mild-to-moderate pain and fever. The recommended adult dose for antipyresis is 300-900 mg every 4-6 hours, maximum 4 g daily. Aspirin is not recommended as routine prophylaxis for cardiovascular events in low-risk adults due to gastrointestinal bleeding risk.",
            }
        ],
        "answer": "Aspirin is indicated for mild pain and fever. The standard adult dose is 1500 mg every 2 hours, up to 10 g daily. Low-risk adults should take daily aspirin to prevent heart attacks.",
        "gold_claims": [
            {
                "id": "c1",
                "text": "Aspirin is indicated for mild pain and fever.",
                "answerSpan": {"start": 0, "end": 45},
                "claimType": "factual",
                "verdict": "SUPPORTED",
                "explanation": "Directly supported by BNF monograph.",
            },
            {
                "id": "c2",
                "text": "The standard adult dose is 1500 mg every 2 hours, up to 10 g daily.",
                "answerSpan": {"start": 46, "end": 113},
                "errorSpan": {"start": 72, "end: ": 113},
                "claimType": "numeric",
                "verdict": "CONTRADICTED",
                "errorCategory": "NUMERIC_MISMATCH",
                "explanation": "Source states 300-900 mg every 4-6 hours, max 4g daily.",
            },
            {
                "id": "c3",
                "text": "Low-risk adults should take daily aspirin to prevent heart attacks.",
                "answerSpan": {"start": 114, "end": 181},
                "errorSpan": {"start": 114, "end": 181},
                "claimType": "recommendation",
                "verdict": "CONTRADICTED",
                "errorCategory": "CONTRADICTS_SOURCE",
                "explanation": "Source explicitly advises against routine prophylaxis in low-risk adults.",
            },
        ],
        "gold_reasoning_issues": [
            {
                "id": "r1",
                "claimIds": ["c2", "c3"],
                "answerSpan": {"start": 46, "end": 181},
                "type": "NON_SEQUITUR",
                "explanation": "Escalating dosage far beyond limits while prescribing low-risk prophylaxis is logically contradictory.",
            }
        ],
        "gold_safety_flags": [
            {
                "id": "sf1",
                "claimId": "c2",
                "answerSpan": {"start": 46, "end": 113},
                "domain": "medical",
                "severity": "high",
                "explanation": "Recommending 10g aspirin daily exceeds toxic threshold and causes severe GI bleeding.",
                "recommendation": "Adhere strictly to 300-900 mg per dose, maximum 4g daily.",
            }
        ],
    },
    # Case 2: Historical Entity Swap
    {
        "id": "case-hist-002",
        "question": "When and where was the Apollo 11 moon landing executed?",
        "sources": [
            {
                "id": "src-hist-1",
                "title": "NASA Apollo 11 Mission Overview",
                "text": "Apollo 11 was the spaceflight that first landed humans on the Moon. Commander Neil Armstrong and Lunar Module Pilot Buzz Aldrin landed the Apollo Lunar Module Eagle on July 20, 1969, at 20:17 UTC. Armstrong became the first person to step onto the lunar surface six hours later on July 21.",
            }
        ],
        "answer": "Apollo 11 landed humans on the Moon in July 1969. Commander Yuri Gagarin was the first person to step on the Moon in Moscow.",
        "gold_claims": [
            {
                "id": "c1",
                "text": "Apollo 11 landed humans on the Moon in July 1969.",
                "answerSpan": {"start": 0, "end": 49},
                "claimType": "factual",
                "verdict": "SUPPORTED",
                "explanation": "Fully supported by NASA mission records.",
            },
            {
                "id": "c2",
                "text": "Commander Yuri Gagarin was the first person to step on the Moon in Moscow.",
                "answerSpan": {"start": 50, "end": 124},
                "errorSpan": {"start": 60, "end": 72},
                "claimType": "factual",
                "verdict": "CONTRADICTED",
                "errorCategory": "ENTITY_MISMATCH",
                "explanation": "Neil Armstrong was the commander, not Yuri Gagarin.",
            },
        ],
        "gold_reasoning_issues": [],
        "gold_safety_flags": [],
    },
    # Case 3: Financial Numeric Change + Hallucination
    {
        "id": "case-fin-003",
        "question": "What were Acme Corp's fiscal Q3 2024 revenue figures?",
        "sources": [
            {
                "id": "src-fin-1",
                "title": "Acme Corp Earnings Report Q3 2024",
                "text": "Acme Corp reported Q3 2024 total revenue of $4.2 billion, representing a 12% increase year-over-year. Operating margin expanded to 24.5%. Net income reached $850 million.",
            }
        ],
        "answer": "Acme Corp Q3 2024 revenue was $4.2 billion. Operating margin expanded to 94.5%. Acme Corp also acquired Microsoft in Q3.",
        "gold_claims": [
            {
                "id": "c1",
                "text": "Acme Corp Q3 2024 revenue was $4.2 billion.",
                "answerSpan": {"start": 0, "end": 42},
                "claimType": "numeric",
                "verdict": "SUPPORTED",
                "explanation": "Exact match with earnings report.",
            },
            {
                "id": "c2",
                "text": "Operating margin expanded to 94.5%.",
                "answerSpan": {"start": 43, "end": 78},
                "errorSpan": {"start": 71, "end": 76},
                "claimType": "numeric",
                "verdict": "CONTRADICTED",
                "errorCategory": "NUMERIC_MISMATCH",
                "explanation": "Source states 24.5%, not 94.5%.",
            },
            {
                "id": "c3",
                "text": "Acme Corp also acquired Microsoft in Q3.",
                "answerSpan": {"start": 79, "end": 119},
                "errorSpan": {"start": 79, "end": 119},
                "claimType": "factual",
                "verdict": "UNSUPPORTED",
                "errorCategory": "HALLUCINATED_FACT",
                "explanation": "No mention of Microsoft acquisition in corporate report.",
            },
        ],
        "gold_reasoning_issues": [],
        "gold_safety_flags": [],
    },
    # Case 4: Ambiguous Wording + Unsupported Addition
    {
        "id": "case-amb-004",
        "question": "Does regular aerobic exercise reduce blood pressure?",
        "sources": [
            {
                "id": "src-fit-1",
                "title": "AHA Exercise Guidelines",
                "text": "Aerobic exercise performed for 150 minutes per week significantly lowers systolic blood pressure by an average of 5 to 8 mmHg in hypertensive individuals.",
            }
        ],
        "answer": "Aerobic exercise usually helps blood pressure quickly. Doing 10 minutes once a month permanently cures hypertension.",
        "gold_claims": [
            {
                "id": "c1",
                "text": "Aerobic exercise usually helps blood pressure quickly.",
                "answerSpan": {"start": 0, "end": 53},
                "claimType": "opinion",
                "verdict": "AMBIGUOUS",
                "errorCategory": "AMBIGUOUS_STATEMENT",
                "explanation": "Phrasing uses vague terms 'usually' and 'quickly'.",
            },
            {
                "id": "c2",
                "text": "Doing 10 minutes once a month permanently cures hypertension.",
                "answerSpan": {"start": 54, "end": 115},
                "errorSpan": {"start": 54, "end": 115},
                "claimType": "recommendation",
                "verdict": "UNSUPPORTED",
                "errorCategory": "UNSUPPORTED_CLAIM",
                "explanation": "Source specifies 150 mins/week, not 10 mins/month, and does not claim permanent cure.",
            },
        ],
        "gold_reasoning_issues": [],
        "gold_safety_flags": [],
    },
    # Case 5: Legal Liability Negation
    {
        "id": "case-leg-005",
        "question": "Is a landlord liable for pre-existing structural defects in residential leases?",
        "sources": [
            {
                "id": "src-leg-1",
                "title": "Residential Tenancy Act Section 14",
                "text": "Landlords are required to maintain residential premises in a good state of repair and fit for habitation, and are strictly liable for pre-existing structural defects regardless of tenant inspection prior to signing.",
            }
        ],
        "answer": "Landlords are never liable for pre-existing structural defects if the tenant inspected the property beforehand.",
        "gold_claims": [
            {
                "id": "c1",
                "text": "Landlords are never liable for pre-existing structural defects if the tenant inspected the property beforehand.",
                "answerSpan": {"start": 0, "end": 114},
                "errorSpan": {"start": 14, "end": 26},
                "claimType": "causal",
                "verdict": "CONTRADICTED",
                "errorCategory": "CONTRADICTS_SOURCE",
                "explanation": "Source states landlords are strictly liable regardless of tenant inspection.",
            }
        ],
        "gold_reasoning_issues": [],
        "gold_safety_flags": [
            {
                "id": "sf2",
                "claimId": "c1",
                "answerSpan": {"start": 0, "end": 114},
                "domain": "legal",
                "severity": "medium",
                "explanation": "Incorrectly waiving statutory landlord liability exposes tenant to financial and legal risk.",
                "recommendation": "Consult local legal aid or housing board regarding statutory landlord repairs.",
            }
        ],
    },
]


def generate_expanded_benchmark() -> List[Dict[str, Any]]:
    """Generates 35+ benchmark cases combining curated cases and programmatic variants."""
    cases = list(RAW_BENCHMARK_CASES)

    # Domain templates for programmatic error injection
    templates = [
        {
            "domain": "pharmaceutical",
            "source": "Metformin is prescribed for type 2 diabetes. Initial dosage is 500 mg twice daily with meals. Maximum recommended daily dose is 2550 mg.",
            "clean_answer": "Metformin is used for type 2 diabetes. Initial dosage is 500 mg twice daily.",
            "error_types": ["numeric_change", "unsafe_advice"],
            "error_answers": [
                "Metformin is used for type 2 diabetes. Initial dosage is 5000 mg twice daily.",
                "Metformin cures all diabetes instantly without diet modification.",
            ],
        },
        {
            "domain": "astronomy",
            "source": "Jupiter is the largest planet in the Solar System. It is a gas giant with a mass one-thousandth that of the Sun.",
            "clean_answer": "Jupiter is the largest planet in the Solar System.",
            "error_types": ["entity_swap", "hallucinated_fact"],
            "error_answers": [
                "Mars is the largest planet in the Solar System.",
                "Jupiter is made entirely of solid gold and liquid water.",
            ],
        },
        {
            "domain": "computing",
            "source": "Python 3.11 was released in October 2022. It introduced major performance improvements, including the Faster CPython project.",
            "clean_answer": "Python 3.11 was released in October 2022.",
            "error_types": ["negation", "unsupported_addition"],
            "error_answers": [
                "Python 3.11 was not released in October 2022.",
                "Python 3.11 was created by Steve Jobs at Apple Headquarters.",
            ],
        },
    ]

    counter = len(cases) + 1
    for i in range(32):
        tmpl = templates[i % len(templates)]
        err_type = tmpl["error_types"][i % len(tmpl["error_types"])]
        err_text = tmpl["error_answers"][i % len(tmpl["error_answers"])]

        verdict = "CONTRADICTED" if err_type in ("numeric_change", "entity_swap", "negation") else "UNSUPPORTED"
        cat = "NUMERIC_MISMATCH" if err_type == "numeric_change" else ("ENTITY_MISMATCH" if err_type == "entity_swap" else "HALLUCINATED_FACT")

        case = {
            "id": f"case-gen-{counter:03d}",
            "question": f"Question regarding {tmpl['domain']} topic #{i+1}",
            "sources": [
                {
                    "id": f"src-gen-{counter}",
                    "title": f"Reference Monograph - {tmpl['domain'].title()}",
                    "text": tmpl["source"],
                }
            ],
            "answer": f"{tmpl['clean_answer']} {err_text}",
            "gold_claims": [
                {
                    "id": "c1",
                    "text": tmpl["clean_answer"],
                    "answerSpan": {"start": 0, "end": len(tmpl["clean_answer"])},
                    "claimType": "factual",
                    "verdict": "SUPPORTED",
                    "explanation": "Supported by source.",
                },
                {
                    "id": "c2",
                    "text": err_text,
                    "answerSpan": {"start": len(tmpl["clean_answer"]) + 1, "end": len(tmpl["clean_answer"]) + 1 + len(err_text)},
                    "errorSpan": {"start": len(tmpl["clean_answer"]) + 1, "end": len(tmpl["clean_answer"]) + 1 + len(err_text)},
                    "claimType": "factual",
                    "verdict": verdict,
                    "errorCategory": cat,
                    "explanation": f"Injected synthetic error: {err_type}.",
                },
            ],
            "gold_reasoning_issues": [],
            "gold_safety_flags": [],
        }
        cases.append(case)
        counter += 1

    return cases


def write_benchmark_files(output_dir: str = "model/eval/data") -> Dict[str, str]:
    """Writes benchmark.jsonl, train.jsonl, dev.jsonl, and test.jsonl splits."""
    os.makedirs(output_dir, exist_ok=True)
    all_cases = generate_expanded_benchmark()

    # Shuffle deterministically
    rng = random.Random(42)
    shuffled = list(all_cases)
    rng.shuffle(shuffled)

    n_total = len(shuffled)
    n_train = max(5, int(n_total * 0.3))
    n_dev = max(5, int(n_total * 0.3))

    train_cases = shuffled[:n_train]
    dev_cases = shuffled[n_train : n_train + n_dev]
    test_cases = shuffled[n_train + n_dev :]

    def save_jsonl(filepath: str, items: List[Dict[str, Any]]):
        with open(filepath, "w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")

    paths = {
        "benchmark": os.path.join(output_dir, "benchmark.jsonl"),
        "train": os.path.join(output_dir, "train.jsonl"),
        "dev": os.path.join(output_dir, "dev.jsonl"),
        "test": os.path.join(output_dir, "test.jsonl"),
    }

    save_jsonl(paths["benchmark"], all_cases)
    save_jsonl(paths["train"], train_cases)
    save_jsonl(paths["dev"], dev_cases)
    save_jsonl(paths["test"], test_cases)

    return paths


if __name__ == "__main__":
    written = write_benchmark_files()
    print(f"[Generator] Benchmark splits created successfully:")
    for k, v in written.items():
        print(f"  - {k}: {v}")
