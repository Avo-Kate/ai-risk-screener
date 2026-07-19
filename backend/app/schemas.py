"""Pydantic schemas.

Two groups:

1. Request/response schemas for the HTTP API (AssessmentInput, AssessmentRecord,
   AssessmentSummary).
2. The strict schema the agent's JSON must validate against before it is saved
   (AssessmentResult and its parts). If the model returns something that does not
   satisfy these, validation fails and the agent retries once.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# --- Controlled vocabularies (kept in sync with the frontend form) ------------

Industry = Literal[
    "healthcare",
    "finance",
    "HR/recruitment",
    "law enforcement",
    "education",
    "marketing",
    "other",
]
DeploymentContext = Literal[
    "internal tool",
    "customer-facing",
    "public sector",
    "safety-critical",
]
DataType = Literal[
    "personal data",
    "sensitive personal data",
    "biometric data",
    "financial data",
    "health data",
    "none",
]
GeographicScope = Literal["EU", "US", "UK", "global"]

RISK_LEVELS = {"low", "medium", "high", "unacceptable"}
SEVERITY_LEVELS = {"low", "medium", "high"}
APPLICABILITY = {"applies", "partially applies", "does not apply"}


# --- API input ----------------------------------------------------------------


class AssessmentInput(BaseModel):
    """The structured use-case description submitted from the form."""

    project_name: str = Field(default="Untitled project", max_length=255)
    use_case_description: str = Field(min_length=10, max_length=8000)
    industry: Industry
    deployment_context: DeploymentContext
    data_types: list[DataType] = Field(default_factory=list)
    affects_decisions: bool
    geographic_scope: list[GeographicScope] = Field(default_factory=list)

    @field_validator("project_name")
    @classmethod
    def _default_blank_name(cls, v: str) -> str:
        v = (v or "").strip()
        return v or "Untitled project"


# --- Agent output schema (validated before saving) ---------------------------


def _normalize(value: str) -> str:
    return str(value).strip().lower()


class Framework(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    applicability: str
    classification: str
    rationale: str
    key_obligations: list[str] = Field(default_factory=list)

    @field_validator("applicability")
    @classmethod
    def _check_applicability(cls, v: str) -> str:
        norm = _normalize(v)
        if norm not in APPLICABILITY:
            raise ValueError(
                f"applicability must be one of {sorted(APPLICABILITY)}, got {v!r}"
            )
        return norm


class Risk(BaseModel):
    model_config = ConfigDict(extra="ignore")

    category: str
    description: str
    severity: str
    likelihood: str
    mitigations: list[str] = Field(default_factory=list)

    @field_validator("severity", "likelihood")
    @classmethod
    def _check_levels(cls, v: str) -> str:
        norm = _normalize(v)
        if norm not in SEVERITY_LEVELS:
            raise ValueError(
                f"severity/likelihood must be one of {sorted(SEVERITY_LEVELS)}, got {v!r}"
            )
        return norm


class AssessmentResult(BaseModel):
    """The exact shape the agent must return (plus a disclaimer field)."""

    model_config = ConfigDict(extra="ignore")

    overall_risk_level: str
    summary: str
    frameworks: list[Framework]
    risks: list[Risk]
    recommended_next_steps: list[str] = Field(default_factory=list)
    # The system prompt requires a decision-support disclaimer. Optional in
    # validation with a fallback so a missing disclaimer never blocks a save.
    disclaimer: str = Field(
        default=(
            "This assessment is automated decision-support, not legal advice. "
            "Validate findings with qualified legal and compliance professionals."
        )
    )

    @field_validator("overall_risk_level")
    @classmethod
    def _check_overall(cls, v: str) -> str:
        norm = _normalize(v)
        if norm not in RISK_LEVELS:
            raise ValueError(
                f"overall_risk_level must be one of {sorted(RISK_LEVELS)}, got {v!r}"
            )
        return norm


# --- API responses ------------------------------------------------------------


class AssessmentSummary(BaseModel):
    """A row in the 'past assessments' list."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_name: str
    overall_risk_level: str
    summary: str
    created_at: datetime


class AssessmentRecord(BaseModel):
    """A full saved assessment, returned when opening one."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    project_name: str
    overall_risk_level: str
    summary: str
    created_at: datetime
    input: AssessmentInput
    result: AssessmentResult


class ErrorResponse(BaseModel):
    detail: str
