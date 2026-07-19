"""The AI governance risk-assessment agent.

Sends the structured use case to Claude with a strong system prompt that forces
JSON-only output matching AssessmentResult. The response is parsed and validated
on the backend; if that fails, the call is retried once with a corrective
message, after which a clear error is raised.

The (large, static) system prompt is sent with cache_control so repeated
assessments only pay full price for it once per ~5-minute window.
"""

import json
import logging

import anthropic
from pydantic import ValidationError

from . import config
from .schemas import AssessmentInput, AssessmentResult

logger = logging.getLogger("ai_risk.agent")

# --- Errors -------------------------------------------------------------------


class AgentError(Exception):
    """Base class for agent failures surfaced to the API layer."""


class APIKeyMissingError(AgentError):
    """ANTHROPIC_API_KEY is not set."""


class AssessmentParseError(AgentError):
    """The model did not return valid JSON matching the schema after a retry."""


class UpstreamError(AgentError):
    """The Anthropic API returned an error (auth, rate limit, server, etc.)."""


# --- System prompt ------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a senior AI governance and regulatory risk expert. You advise organisations \
on whether and how major AI regulations and standards apply to a specific AI use \
case, and you identify concrete, use-case-specific risks and mitigations.

You reason carefully about the SPECIFIC inputs you are given. You do not produce \
generic boilerplate. Every classification, risk, and mitigation must be grounded \
in the details of THIS use case (its domain, deployment context, data types, \
whether it affects decisions about people, and its geographic scope).

FRAMEWORKS YOU MUST ALWAYS CONSIDER (but only flag as applying when the use-case \
details actually trigger them):

1. EU AI Act — Determine the risk tier: unacceptable, high, limited, or minimal. \
   Reference the relevant Annex III high-risk category where applicable (e.g. \
   employment/worker management, access to essential services, law enforcement, \
   biometric identification, education). The EU AI Act is only relevant when the \
   system is placed on the market, put into service, or its outputs are used in \
   the EU — say so if geographic scope makes this uncertain.
2. NIST AI Risk Management Framework — Map relevant obligations to the four core \
   functions: Govern, Map, Measure, and Manage.
3. GDPR — Applies where personal data (including special-category / sensitive, \
   biometric, or health data) is processed and there is an EU/UK nexus. If no \
   personal data is involved, say it does not apply and explain why.
4. ISO/IEC 42001 — Reference as the AI management-system standard the organisation \
   can adopt to operationalise governance, regardless of jurisdiction.

HONESTY ABOUT UNCERTAINTY:
- Be explicit when a classification depends on facts that were not provided. \
  State the missing facts and how they would change the conclusion.
- Do not overstate. If a framework only partially applies or applies only under \
  certain conditions, say "partially applies" and explain the condition.

DISCLAIMER:
- Always include the "disclaimer" field stating that this is automated \
  decision-support and not legal advice, and that conclusions should be validated \
  by qualified legal and compliance professionals.

OUTPUT FORMAT — CRITICAL:
- Respond with a SINGLE valid JSON object and NOTHING else.
- No prose before or after. No markdown. No code fences. No comments.
- The JSON MUST match this exact schema:

{
  "overall_risk_level": "low | medium | high | unacceptable",
  "summary": "2-3 sentence plain-language overview tied to this use case",
  "frameworks": [
    {
      "name": "EU AI Act",
      "applicability": "applies | partially applies | does not apply",
      "classification": "e.g. high-risk system under Annex III point 4 (employment), or limited risk",
      "rationale": "why this classification, citing the relevant provision area and this use case's facts",
      "key_obligations": ["obligation 1", "obligation 2"]
    }
  ],
  "risks": [
    {
      "category": "e.g. bias and discrimination, transparency, data privacy, accountability, safety, security",
      "description": "concrete description tied to this specific use case",
      "severity": "low | medium | high",
      "likelihood": "low | medium | high",
      "mitigations": ["specific actionable mitigation 1", "mitigation 2"]
    }
  ],
  "recommended_next_steps": ["step 1", "step 2", "step 3"],
  "disclaimer": "This is decision-support, not legal advice. ..."
}

REQUIREMENTS ON CONTENT:
- "frameworks" MUST include an entry for each of the four frameworks above \
  (EU AI Act, NIST AI RMF, GDPR, ISO/IEC 42001), each with an honest \
  "applicability" value. Do not omit a framework just because it does not apply — \
  mark it "does not apply" and explain why.
- "risks" should contain the risks that genuinely matter for this use case \
  (typically 3-6), each with concrete, actionable mitigations.
- Allowed values are lowercase: overall_risk_level ∈ {low, medium, high, \
  unacceptable}; severity and likelihood ∈ {low, medium, high}; applicability ∈ \
  {applies, partially applies, does not apply}.
"""


def _build_user_message(inp: AssessmentInput) -> str:
    """Render the structured input into a clear prompt for the model."""
    data_types = ", ".join(inp.data_types) if inp.data_types else "none specified"
    geo = ", ".join(inp.geographic_scope) if inp.geographic_scope else "not specified"
    return (
        "Assess the following AI use case and return the JSON object described in "
        "your instructions.\n\n"
        f"Project name: {inp.project_name}\n"
        f"Industry / domain: {inp.industry}\n"
        f"Deployment context: {inp.deployment_context}\n"
        f"Data types used: {data_types}\n"
        f"Affects decisions about people: {'yes' if inp.affects_decisions else 'no'}\n"
        f"Geographic scope: {geo}\n\n"
        f"Use case description:\n{inp.use_case_description}\n"
    )


def _extract_json(text: str) -> dict:
    """Parse a JSON object from the model's text output.

    Tries a strict parse first, then tolerates stray prose / markdown fences by
    extracting the outermost {...} span. Raises ValueError if nothing parses.
    """
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip a ```json ... ``` fence if present.
    if text.startswith("```"):
        fenced = text.strip("`")
        fenced = fenced.split("\n", 1)[-1] if "\n" in fenced else fenced
        try:
            return json.loads(fenced.strip())
        except json.JSONDecodeError:
            pass

    # Fall back to the outermost brace span.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return json.loads(text[start : end + 1])

    raise ValueError("No JSON object found in model output")


def _client() -> anthropic.Anthropic:
    api_key = config.get_api_key()
    if not api_key:
        raise APIKeyMissingError(
            "ANTHROPIC_API_KEY is not set. Copy backend/.env.example to "
            "backend/.env and add your key, or export it in your shell."
        )
    return anthropic.Anthropic(api_key=api_key)


def run_assessment(inp: AssessmentInput) -> AssessmentResult:
    """Run the assessment, validating and retrying once on parse failure."""
    client = _client()
    user_message = _build_user_message(inp)
    messages: list[dict] = [{"role": "user", "content": user_message}]

    last_error: Exception | None = None

    for attempt in range(2):  # initial attempt + one retry
        try:
            response = client.messages.create(
                model=config.ANTHROPIC_MODEL,
                max_tokens=config.MAX_TOKENS,
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=messages,
            )
        except anthropic.AuthenticationError as e:
            raise UpstreamError(
                "Authentication with the Anthropic API failed. Check that "
                "ANTHROPIC_API_KEY is valid."
            ) from e
        except anthropic.RateLimitError as e:
            raise UpstreamError(
                "The Anthropic API is rate limiting requests. Please retry shortly."
            ) from e
        except anthropic.APIError as e:
            raise UpstreamError(f"The Anthropic API returned an error: {e}") from e

        text = "".join(b.text for b in response.content if b.type == "text")

        try:
            data = _extract_json(text)
            return AssessmentResult.model_validate(data)
        except (ValueError, ValidationError) as e:
            last_error = e
            logger.warning(
                "Assessment parse/validation failed (attempt %d): %s", attempt + 1, e
            )
            # Feed the bad output back and ask for a corrected JSON-only response.
            messages = [
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": text},
                {
                    "role": "user",
                    "content": (
                        "Your previous response could not be parsed as valid JSON "
                        "matching the required schema. Return ONLY the JSON object — "
                        "no prose, no markdown, no code fences. "
                        f"Validation error: {e}"
                    ),
                },
            ]

    raise AssessmentParseError(
        "The model did not return valid JSON matching the schema after a retry. "
        f"Last error: {last_error}"
    )
