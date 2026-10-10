from fastapi.testclient import TestClient
from model.main import app

client = TestClient(app)


def test_post_audit_success():
    payload = {
        "question": "What is the adult dose of aspirin?",
        "answer": "Aspirin is commonly used to reduce fever in adults. The standard dose is 1000 mg every 4 hours.",
        "sources": [
            {
                "id": "src-1",
                "title": "BNF Monograph",
                "text": "Aspirin is indicated for mild fever. Recommended adult dose is 300-900 mg.",
            }
        ],
    }
    response = client.post("/v1/audit", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "completed"
    assert len(data["claims"]) == 5
    assert len(data["reasoningIssues"]) >= 1
    assert len(data["safetyFlags"]) >= 1
    assert data["overall"]["grade"] == "F"


def test_post_audit_validation_error():
    # Missing required 'answer' and 'sources'
    response = client.post("/v1/audit", json={"question": "Only question provided"})
    assert response.status_code == 400
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_ERROR"
