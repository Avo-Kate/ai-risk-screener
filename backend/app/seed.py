"""Seed the database with one example assessment.

This lets you see the result and list views immediately, without spending an API
call. Safe to run repeatedly: it only inserts the example if no assessment with
the same project name exists. Can be run standalone:

    python -m app.seed
"""

from datetime import datetime, timezone

from .database import SessionLocal, init_db
from .models import Assessment

EXAMPLE_PROJECT_NAME = "Example: Automated CV Screening Tool"

EXAMPLE_INPUT = {
    "project_name": EXAMPLE_PROJECT_NAME,
    "use_case_description": (
        "An internal tool that uses an LLM to screen and rank job applicants' CVs "
        "for shortlisting. It scores candidates against the job description and "
        "surfaces a ranked list to recruiters, who make the final interview "
        "decision. It processes names, contact details, education and employment "
        "history, and may infer protected characteristics indirectly."
    ),
    "industry": "HR/recruitment",
    "deployment_context": "internal tool",
    "data_types": ["personal data", "sensitive personal data"],
    "affects_decisions": True,
    "geographic_scope": ["EU", "UK"],
}

EXAMPLE_RESULT = {
    "overall_risk_level": "high",
    "summary": (
        "An AI system that ranks job applicants for shortlisting is a high-risk "
        "use case under the EU AI Act (Annex III, employment) and engages GDPR "
        "because it processes personal data to support decisions about people. "
        "The dominant risks are discriminatory bias, lack of transparency to "
        "candidates, and insufficient human oversight of the ranking."
    ),
    "frameworks": [
        {
            "name": "EU AI Act",
            "applicability": "applies",
            "classification": "High-risk system under Annex III, point 4 (employment, workers management and access to self-employment)",
            "rationale": (
                "The system is used for recruitment and the selection of natural "
                "persons, which Annex III explicitly designates as high-risk. With "
                "an EU/UK deployment scope, the high-risk obligations are engaged."
            ),
            "key_obligations": [
                "Establish a risk management system and data governance to detect and mitigate bias (Art. 9-10)",
                "Maintain technical documentation, logging, and ensure effective human oversight (Art. 11-14)",
                "Ensure transparency and provide information to deployers; register the system before use",
            ],
        },
        {
            "name": "NIST AI Risk Management Framework",
            "applicability": "applies",
            "classification": "Voluntary framework; maps across all four functions for a consequential hiring use case",
            "rationale": (
                "NIST AI RMF is jurisdiction-agnostic and directly relevant to a "
                "high-impact decision-support system, providing structure for "
                "governance and measurement of fairness."
            ),
            "key_obligations": [
                "Govern: assign accountability for the model and define an acceptable-use policy",
                "Map: document context, affected groups, and protected attributes at risk",
                "Measure: run disparate-impact and accuracy testing across demographic groups",
                "Manage: monitor in production and define escalation and rollback procedures",
            ],
        },
        {
            "name": "GDPR",
            "applicability": "applies",
            "classification": "Processing of personal data for a decision with legal or similarly significant effect (Art. 22 adjacent)",
            "rationale": (
                "The tool processes candidates' personal data in the EU/UK. Because "
                "it supports significant decisions about individuals, a DPIA is "
                "required and Article 22 safeguards on automated decision-making "
                "must be considered even though a human makes the final call."
            ),
            "key_obligations": [
                "Complete a Data Protection Impact Assessment (DPIA) before deployment",
                "Define a lawful basis, minimise data, and set retention limits for applicant data",
                "Provide candidates with transparency notices and a route to human review",
            ],
        },
        {
            "name": "ISO/IEC 42001",
            "applicability": "partially applies",
            "classification": "Management-system standard; adoption is voluntary but recommended",
            "rationale": (
                "ISO/IEC 42001 is not legally mandated, but adopting it gives the "
                "organisation an auditable AI management system that operationalises "
                "the EU AI Act and GDPR obligations above."
            ),
            "key_obligations": [
                "Establish an AI management system with defined roles and policies",
                "Maintain an AI risk register and conduct periodic internal audits",
            ],
        },
    ],
    "risks": [
        {
            "category": "bias and discrimination",
            "description": (
                "The model may learn and amplify historical hiring biases, "
                "disadvantaging candidates by gender, ethnicity, age, or disability, "
                "including via proxy features in CVs (e.g. names, locations, career gaps)."
            ),
            "severity": "high",
            "likelihood": "high",
            "mitigations": [
                "Run disparate-impact testing across protected groups before and during deployment",
                "Remove or mask proxy variables and evaluate counterfactual fairness",
                "Keep a human-in-the-loop with authority and training to override rankings",
            ],
        },
        {
            "category": "transparency",
            "description": (
                "Candidates may not know an AI ranked them, and recruiters may not "
                "understand why a candidate was scored low, undermining contestability."
            ),
            "severity": "medium",
            "likelihood": "high",
            "mitigations": [
                "Publish a candidate-facing transparency notice describing the AI's role",
                "Provide recruiters with per-candidate explanations of the main ranking factors",
            ],
        },
        {
            "category": "data privacy",
            "description": (
                "Sensitive personal data is processed and could be retained longer "
                "than necessary or used beyond the original recruitment purpose."
            ),
            "severity": "high",
            "likelihood": "medium",
            "mitigations": [
                "Define and enforce retention and deletion schedules for applicant data",
                "Restrict access with role-based controls and log all access",
            ],
        },
        {
            "category": "accountability",
            "description": (
                "Without clear ownership, no one is responsible for monitoring model "
                "drift or handling candidate complaints about unfair outcomes."
            ),
            "severity": "medium",
            "likelihood": "medium",
            "mitigations": [
                "Assign a named owner accountable for the system's outcomes",
                "Establish a documented appeals and human-review process for candidates",
            ],
        },
    ],
    "recommended_next_steps": [
        "Complete a DPIA and an EU AI Act high-risk conformity gap analysis before go-live",
        "Commission independent bias testing and document the results",
        "Define and implement a human-oversight protocol with recruiter training",
        "Stand up an AI risk register and assign clear accountability for the system",
    ],
    "disclaimer": (
        "This assessment is automated decision-support, not legal advice. Validate "
        "all findings with qualified legal and compliance professionals before "
        "relying on them."
    ),
}


def seed_example(db) -> bool:
    """Insert the example assessment if it is not already present.

    Returns True if a row was inserted, False if it already existed.
    """
    existing = (
        db.query(Assessment)
        .filter(Assessment.project_name == EXAMPLE_PROJECT_NAME)
        .first()
    )
    if existing:
        return False

    record = Assessment(
        created_at=datetime.now(timezone.utc),
        project_name=EXAMPLE_PROJECT_NAME,
        overall_risk_level=EXAMPLE_RESULT["overall_risk_level"],
        summary=EXAMPLE_RESULT["summary"],
        input_json=EXAMPLE_INPUT,
        result_json=EXAMPLE_RESULT,
    )
    db.add(record)
    db.commit()
    return True


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        inserted = seed_example(db)
        print("Seeded example assessment." if inserted else "Example already present; nothing to do.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
