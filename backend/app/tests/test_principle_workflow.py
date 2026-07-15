import unittest
from unittest.mock import patch

from app import main


def compliance_payload(text: str, *, regress_a2: bool = False) -> dict:
    assessments = []
    for principle in main.PRINCIPLE_ORDER:
        status = "Non-Compliant" if principle == "A2" and regress_a2 else "Compliant"
        assessments.append({
            "principle": principle,
            "principle_name": principle,
            "compliance": status,
            "relevant_text_fragment": text,
            "issue_identified": "No issue identified." if status == "Compliant" else "A2 regression",
            "explanation": "Test assessment.",
        })
    return {"output": {"results": {"principle_assessments": assessments}}}


class FakeComplianceAnalyser:
    async def run_async(self, text: str) -> dict:
        return compliance_payload(text, regress_a2=text == "bad candidate")


class FakeWorkflowAnalyser:
    async def run_async(self, attestation: str, principle: str, *, original_attestation: str | None = None) -> dict:
        candidate = original_attestation is not None
        return {"results": {
            "principle": principle,
            "status": "Compliant" if candidate else "Non-Compliant",
            "summary": "Candidate is improved." if candidate else "An issue was found.",
            "relevant_text_fragment": attestation,
            "issue_identified": "No issue identified." if candidate else "Test issue",
            "explanation": "Test explanation.",
            "findings": [],
            "checks": [],
            "metrics": [{"label": "Test metric", "value": "Test value"}],
            "correction_goal": "Apply a minimal correction.",
            "can_correct_without_new_information": True,
            "guidance": "Review the proposal.",
        }}

    async def validate_async(self, attestation: str, principle: str, *, original_attestation: str | None = None) -> dict:
        candidate = original_attestation is not None
        return {"results": {
            "principle": principle,
            "status": "Compliant" if candidate else "Non-Compliant",
            "summary": "Compact validation.",
            "relevant_text_fragment": attestation,
            "issue_identified": "No issue identified." if candidate else "Test issue",
            "explanation": "Compact test explanation.",
            "meaning_preserved": True,
        }}


class FakeCorrector:
    async def run_async(self, attestation: str, compliance_analysis: dict, allowed_principles: list[str]) -> dict:
        return {"results": {
            "decision": "corrected",
            "corrected_attestation": "Objective candidate",
            "correction_mode": "single_attestation",
            "corrected_units": [],
            "applied_principles": allowed_principles,
            "correction_notes": ["Minimal wording correction."],
        }}


class PrincipleWorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_analysis_returns_didactic_details_and_suggestion(self):
        with (
            patch.object(main, "principle_workflow_analyser", FakeWorkflowAnalyser()),
            patch.object(main, "compliance_corrector", FakeCorrector()),
        ):
            response = await main.analyze_b2_workflow(main.InputRequest(input={"attestation": "source"}))

        self.assertEqual(response.output["principle"], "B2")
        self.assertEqual(response.output["status"], "Non-Compliant")
        self.assertEqual(response.output["metrics"][0]["label"], "Test metric")
        self.assertEqual(response.output["suggestions"][0]["text"], "Objective candidate")

    async def test_validation_allows_improvement_without_regression(self):
        with (
            patch.object(main, "principle_workflow_analyser", FakeWorkflowAnalyser()),
            patch.object(main, "compliance_analyser", FakeComplianceAnalyser()),
        ):
            response = await main.validate_d_workflow(main.InputRequest(input={
                "original_attestation": "source",
                "candidate_attestations": ["safe candidate"],
            }))

        self.assertTrue(response.output["can_apply"])
        self.assertTrue(response.output["target_improved_or_preserved"])
        self.assertEqual(response.output["regressions"], [])

    async def test_validation_blocks_regression_in_previous_principle(self):
        with (
            patch.object(main, "principle_workflow_analyser", FakeWorkflowAnalyser()),
            patch.object(main, "compliance_analyser", FakeComplianceAnalyser()),
        ):
            response = await main.validate_d_workflow(main.InputRequest(input={
                "original_attestation": "source",
                "candidate_attestations": ["bad candidate"],
                "protected_principles": ["A2"],
            }))

        self.assertFalse(response.output["can_apply"])
        self.assertEqual(response.output["regressions"][0]["principle"], "A2")

    async def test_b1_requires_multiple_replacement_attestations(self):
        with (
            patch.object(main, "principle_workflow_analyser", FakeWorkflowAnalyser()),
            patch.object(main, "compliance_analyser", FakeComplianceAnalyser()),
        ):
            response = await main.validate_b1_workflow(main.InputRequest(input={
                "original_attestation": "source",
                "candidate_attestations": ["one candidate"],
            }))

        self.assertFalse(response.output["can_apply"])
        self.assertIn("at least two", response.output["warnings"][-1])

    def test_b1_meaning_check_accepts_lossless_split_and_rejects_new_content(self):
        original = "The consignment was inspected and found to comply with the requirements."
        self.assertTrue(main._b1_meaning_preserved(original, [
            "The consignment was inspected.",
            "The consignment was found to comply with the requirements.",
        ]))
        self.assertFalse(main._b1_meaning_preserved(original, [
            "The consignment was officially inspected.",
            "The consignment was found to comply with the requirements.",
        ]))


if __name__ == "__main__":
    unittest.main()
