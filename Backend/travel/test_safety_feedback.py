"""Regression tests for travel SafetyScorer + FeedbackCollector.

Charter (see Backend/TESTING.md):
  Owned invariants
    * Known high-risk zones (border/Somalia, slum/Kibera) are flagged "High" by the
      STATIC rules, and the LLM is NOT consulted in that case — so a model answer
      can never downgrade a known-dangerous zone.
    * A low-risk location adopts the LLM's risk_level and appends its advisory.
    * LLM failure degrades gracefully, never raises: assess_location -> static
      result; process_user_reply -> {}; generate_post_trip_questions -> fallback.
    * A late-night (23:/00:/01:.. ) bus/flight itinerary item raises a transfer
      alert; daytime items and non-transport items do not.
  Seam: the LLM client is the only external dependency. It's replaced with a fake
  that honours its inputs (records calls, can simulate failure). No network, no DB
  (SimpleTestCase forbids DB access, enforcing hermeticity).

Converted from the old assertion-free smoke script tests/smoke_safety_feedback.py.
"""
import asyncio

from django.test import SimpleTestCase

from travel.safety_service import SafetyScorer
from travel.feedback_service import FeedbackCollector


def _run(coro):
    """Run a coroutine in a fresh loop (3.12+ safe)."""
    return asyncio.run(coro)


class _FakeLLM:
    """Stand-in LLM client. Records every call (so we can assert it was/wasn't
    consulted) and returns canned text or simulates an outage."""

    def __init__(self, response="", raises=False):
        self.response = response
        self.raises = raises
        self.calls = []

    async def generate_text(self, system_prompt="", user_prompt="", **kwargs):
        self.calls.append({"system": system_prompt, "user": user_prompt, "kwargs": kwargs})
        if self.raises:
            raise RuntimeError("LLM unavailable")
        return self.response


class SafetyScorerLocationTests(SimpleTestCase):
    def _scorer(self, **fake):
        scorer = SafetyScorer()
        scorer.llm_client = _FakeLLM(**fake)
        return scorer

    def test_border_location_flagged_high_and_llm_not_consulted(self):
        # Fails if the static border rule is removed, OR if the `risk_level != High`
        # short-circuit is dropped (the LLM would then be free to downgrade it).
        scorer = self._scorer(response='{"risk_level": "Low", "advisory": "All clear"}')
        res = _run(scorer.assess_location("Somalia Border"))
        self.assertEqual(res["risk_level"], "High")
        self.assertTrue(any("border" in w.lower() for w in res["warnings"]))
        self.assertEqual(scorer.llm_client.calls, [])

    def test_slum_location_flagged_high_and_llm_not_consulted(self):
        scorer = self._scorer(response='{"risk_level": "Low"}')
        res = _run(scorer.assess_location("Kibera Slum Walk"))
        self.assertEqual(res["risk_level"], "High")
        self.assertEqual(scorer.llm_client.calls, [])

    def test_low_risk_location_adopts_llm_assessment(self):
        # Fails if the LLM merge (risk_level + advisory append) is dropped.
        scorer = self._scorer(response='{"risk_level": "Medium", "advisory": "Watch your belongings"}')
        res = _run(scorer.assess_location("Diani Beach"))
        self.assertEqual(len(scorer.llm_client.calls), 1)
        self.assertEqual(res["risk_level"], "Medium")
        self.assertIn("Watch your belongings", res["warnings"])

    def test_llm_failure_falls_back_to_static_low(self):
        # Fails if the try/except around the LLM call is removed.
        scorer = self._scorer(raises=True)
        res = _run(scorer.assess_location("Diani Beach"))
        self.assertEqual(res["risk_level"], "Low")
        self.assertEqual(res["warnings"], [])


class ItineraryLogisticsTests(SimpleTestCase):
    def setUp(self):
        self.scorer = SafetyScorer()
        self.scorer.llm_client = _FakeLLM()  # logistics path is pure heuristic

    def test_late_night_bus_raises_transfer_alert(self):
        items = [
            {"title": "Late Bus", "time": "23:30"},
            {"title": "Morning Tour", "time": "09:00"},
        ]
        alerts = _run(self.scorer.assess_itinerary_logistics(items))
        self.assertEqual(len(alerts), 1)
        self.assertIn("late bus", alerts[0].lower())

    def test_daytime_and_non_transport_items_raise_no_alert(self):
        # Adverse: 09:00 is not late; a 23:30 *dinner* is late but not transport, so
        # the bus/flight title gate must suppress it. Fails if that gate is dropped.
        items = [
            {"title": "Morning Tour", "time": "09:00"},
            {"title": "Late Dinner", "time": "23:30"},
        ]
        alerts = _run(self.scorer.assess_itinerary_logistics(items))
        self.assertEqual(alerts, [])


class FeedbackCollectorTests(SimpleTestCase):
    def _collector(self, **fake):
        collector = FeedbackCollector()
        collector.llm_client = _FakeLLM(**fake)
        return collector

    def test_process_reply_returns_parsed_structured_data(self):
        collector = self._collector(
            response='{"safety_rating": 4, "cost_rating": 2, "overall_rating": 3, '
                     '"tags": ["pricey"], "sentiment": "Neutral"}')
        data = _run(collector.process_user_reply("Great snorkeling but the hotel was pricey."))
        self.assertEqual(data["cost_rating"], 2)
        self.assertEqual(data["sentiment"], "Neutral")

    def test_process_reply_llm_failure_returns_empty_dict(self):
        # Fails if the except-returns-{} guard is removed (caller would get an exception).
        collector = self._collector(raises=True)
        self.assertEqual(_run(collector.process_user_reply("anything")), {})

    def test_generate_questions_falls_back_on_llm_failure(self):
        collector = self._collector(raises=True)
        msg = _run(collector.generate_post_trip_questions("Mombasa", [{"title": "Snorkeling"}]))
        self.assertTrue(msg)
        self.assertIn("trip", msg.lower())
