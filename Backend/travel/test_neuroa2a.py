"""Regression tests for NeuroA2A travel endpoint (v2 - LLM-first architecture).

Covers:
- Auth (missing token, invalid token, unconfigured endpoint).
- Structured passthrough (caller-supplied action + params).
- LLM extraction (primary intent path).
- Deterministic fallback (when LLM returns None).
- Trip planning (create_itinerary -> safe search handoff).
- Booking/payment safety (must NOT book; must hand off).
- Missing-slot clarification (contextual questions, never generic).
- Provider no-results -> successful agent response.
- All required prompts from the acceptance criteria.
"""
from unittest.mock import AsyncMock, Mock, patch

import os

from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

User = get_user_model()


class NeuroA2ATravelRunTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="neuroa2a_travel",
            email="neuroa2a@example.com",
            password="pass123",
        )
        self.url = "/api/neuroa2a/travel/run/"

    # ------------------------------------------------------------------
    # Auth tests
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret", NEUROA2A_TRAVEL_USER_ID=1)
    def test_rejects_missing_bearer_token(self):
        response = self.client.post(
            self.url,
            {"user_prompt": "Find hotels in Nairobi"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["status"], "error")

    # ------------------------------------------------------------------
    # Structured passthrough
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_routes_structured_travel_search(self):
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_hotels_connector.TravelHotelsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"name": "Nairobi Hotel", "price_ksh": 12000}],
                        "metadata": {"provider": "fallback"},
                    }
                ),
            ) as fetch_hotels:
                response = self.client.post(
                    self.url,
                    {
                        "task_id": "tsk_123",
                        "user_prompt": "Find hotels in Nairobi",
                        "context": {
                            "action": "search_hotels",
                            "parameters": {
                                "location": "Nairobi",
                                "check_in_date": "2026-08-10",
                                "check_out_date": "2026-08-12",
                                "guests": 1,
                            },
                        },
                        "timeout_seconds": 30,
                    },
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("Found 1 hotels option", response.data["result"])
        fetch_hotels.assert_awaited_once()

    # ------------------------------------------------------------------
    # Safety tests
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_stateful_travel_action_returns_search_only_guidance(self):
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            response = self.client.post(
                self.url,
                {
                    "user_prompt": "Book this hotel",
                    "context": {
                        "action": "book_travel_item",
                        "parameters": {"item_id": "1"},
                    },
                },
                HTTP_AUTHORIZATION="Bearer secret",
                format="json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("search-only", response.data["result"])

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_booking_flight_prompt_returns_handoff_not_books(self):
        """'Book the cheapest flight to Kisumu tomorrow' must NOT book."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ) as llm_extract:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "Book the cheapest flight to Kisumu tomorrow"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        result = str(response.data["result"]).lower()
        self.assertIn("search-only", result)
        # Must NOT contain booking confirmation language
        self.assertNotIn("booked", result)
        self.assertNotIn("confirmed", result.replace("unconfirmed", ""))
        # Booking pre-scan caught it before any LLM call
        llm_extract.assert_not_awaited()

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_pay_for_flight_prompt_returns_handoff(self):
        """'Pay for my flight to Mombasa' must hand off."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ) as llm_extract:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "Pay for my flight to Mombasa tomorrow"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("search-only", response.data["result"])
        llm_extract.assert_not_awaited()

    # ------------------------------------------------------------------
    # Trip planning
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_trip_planning_intent_runs_safe_searches(self):
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_hotels_connector.TravelHotelsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"name": "Nairobi Hotel", "price_ksh": 12000}],
                        "metadata": {"provider": "fallback"},
                    }
                ),
            ) as fetch_hotels, patch(
                "orchestration.connectors.travel_events_connector.TravelEventsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"name": "Nairobi Tour"}],
                        "metadata": {"provider": "fallback"},
                    }
                ),
            ) as fetch_events:
                response = self.client.post(
                    self.url,
                    {
                        "user_prompt": "Plan a Nairobi trip",
                        "context": {
                            "action": "create_itinerary",
                            "parameters": {
                                "destination": "Nairobi",
                                "start_date": "2026-08-10",
                                "end_date": "2026-08-12",
                                "guests": 1,
                            },
                        },
                    },
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("safe travel searches", response.data["result"])
        fetch_hotels.assert_awaited_once()
        fetch_events.assert_awaited_once()

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_prompt_only_trip_planning_uses_deterministic_fallback(self):
        """Prompt-only 'Plan a Nairobi trip' hits LLM first (returns None),
        then falls back to deterministic parser."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_hotels_connector.TravelHotelsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"name": "Nairobi Hotel", "price_ksh": 12000}],
                        "metadata": {"provider": "fallback"},
                    }
                ),
            ) as fetch_hotels, patch(
                "orchestration.connectors.travel_events_connector.TravelEventsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"name": "Nairobi Tour"}],
                        "metadata": {"provider": "fallback"},
                    }
                ),
            ) as fetch_events, patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ) as llm_extract:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "Plan a Nairobi trip from 2026-08-10 to 2026-08-12"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("safe travel searches", response.data["result"])
        fetch_hotels.assert_awaited_once()
        fetch_events.assert_awaited_once()
        llm_extract.assert_awaited_once()

    # ------------------------------------------------------------------
    # Flight prompts (acceptance criteria)
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_prompt_only_flight_request_uses_fallback_parser(self):
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_flights_connector.TravelFlightsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"airline": "Kenya Airways", "price_ksh": 9500}],
                        "metadata": {"provider": "amadeus"},
                    }
                ),
            ) as fetch_flights, patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ) as llm_extract:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "I need a local flight from Nairobi to Kisumu on August 10, 2026"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("Found 1 flights option", response.data["result"])
        fetch_flights.assert_awaited_once()
        self.assertEqual(fetch_flights.await_args.args[0]["origin"], "Nairobi")
        self.assertEqual(fetch_flights.await_args.args[0]["destination"], "Kisumu")
        self.assertEqual(fetch_flights.await_args.args[0]["departure_date"], "2026-08-10")
        llm_extract.assert_awaited_once()

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_prompt_only_travel_request_can_use_llm_parser(self):
        llm = Mock()
        llm.generate_text = AsyncMock(return_value='{"action":"search_flights"}')
        llm.extract_json.return_value = {
            "action": "search_flights",
            "confidence": 0.95,
            "parameters": {
                "origin": "Nairobi",
                "destination": "Kisumu",
                "departure_date": "2026-08-10",
                "passengers": 1,
            },
            "missing_slots": [],
            "clarifying_question": "",
            "raw_query": "Can you get me an air ticket to the lakeside on August 10, 2026",
        }

        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch("travel.neuroa2a.get_llm_client", return_value=llm), patch(
                "orchestration.connectors.travel_flights_connector.TravelFlightsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"airline": "Kenya Airways", "price_ksh": 9500}],
                        "metadata": {"provider": "amadeus"},
                    }
                ),
            ) as fetch_flights:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "Can you get me an air ticket to the lakeside on August 10, 2026"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        fetch_flights.assert_awaited_once()
        llm.generate_text.assert_awaited_once()

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_shorthand_flight_route_with_relative_date_searches(self):
        """'Need to fly Nairobi to Kisumu next month' -> flight search."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_flights_connector.TravelFlightsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"airline": "Kenya Airways", "price_ksh": 9500}],
                        "metadata": {"provider": "amadeus"},
                    }
                ),
            ) as fetch_flights, patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ) as llm_extract:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "Need to fly Nairobi to Kisumu next month"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        fetch_flights.assert_awaited_once()
        self.assertEqual(fetch_flights.await_args.args[0]["origin"], "Nairobi")
        self.assertEqual(fetch_flights.await_args.args[0]["destination"], "Kisumu")
        self.assertRegex(fetch_flights.await_args.args[0]["departure_date"], r"^20\d{2}-\d{2}-01$")
        llm_extract.assert_awaited_once()

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_destination_only_flight_with_typo_tomorrow_defaults_origin(self):
        """'can you get me a flight to kisumu tommorow?' -> flight search with inferred origin."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_flights_connector.TravelFlightsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"airline": "Kenya Airways", "price_ksh": 9500}],
                        "metadata": {"provider": "amadeus"},
                    }
                ),
            ) as fetch_flights, patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ) as llm_extract:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "can you get me a flight to kisumu tommorow?"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("Found 1 flights option", response.data["result"])
        fetch_flights.assert_awaited_once()
        self.assertEqual(fetch_flights.await_args.args[0]["origin"], "Nairobi")
        self.assertEqual(fetch_flights.await_args.args[0]["destination"], "kisumu")
        self.assertRegex(fetch_flights.await_args.args[0]["departure_date"], r"^20\d{2}-\d{2}-\d{2}$")
        llm_extract.assert_awaited_once()

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_travel_prompt_misclassified_as_general_chat_uses_fallback(self):
        """An LLM general_chat miss on a travel prompt should not return generic guidance."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_flights_connector.TravelFlightsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"airline": "Kenya Airways", "price_ksh": 9500}],
                        "metadata": {"provider": "amadeus"},
                    }
                ),
            ) as fetch_flights, patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(
                    return_value={
                        "action": "general_chat",
                        "confidence": 0.8,
                        "parameters": {},
                        "missing_slots": [],
                        "clarifying_question": "",
                        "raw_query": "can you get me a flight to kisumu tommorow?",
                    }
                ),
            ):
                response = self.client.post(
                    self.url,
                    {"user_prompt": "can you get me a flight to kisumu tommorow?"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("Found 1 flights option", response.data["result"])
        fetch_flights.assert_awaited_once()

    # ------------------------------------------------------------------
    # Hotel / stay prompts (acceptance criteria)
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_stay_prompt_with_next_weekend_searches_hotels(self):
        """'Find me somewhere to stay in Nairobi next weekend' -> hotel search."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_hotels_connector.TravelHotelsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"name": "Nairobi Hotel", "price_ksh": 12000}],
                        "metadata": {"provider": "fallback"},
                    }
                ),
            ) as fetch_hotels, patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ) as llm_extract:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "Find me somewhere to stay in Nairobi next weekend"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        fetch_hotels.assert_awaited_once()
        self.assertEqual(fetch_hotels.await_args.args[0]["location"], "Nairobi")
        self.assertTrue(fetch_hotels.await_args.args[0]["check_in_date"])
        self.assertTrue(fetch_hotels.await_args.args[0]["check_out_date"])
        llm_extract.assert_awaited_once()

    # ------------------------------------------------------------------
    # Beach trip / trip planning (acceptance criteria)
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_open_ended_beach_trip_uses_trip_planning_searches(self):
        """'I want a beach trip in Kenya in August 2026' -> trip planning."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_hotels_connector.TravelHotelsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"name": "Beach Stay", "price_ksh": 20000}],
                        "metadata": {"provider": "fallback"},
                    }
                ),
            ) as fetch_hotels, patch(
                "orchestration.connectors.travel_events_connector.TravelEventsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"name": "Coastal Tour"}],
                        "metadata": {"provider": "fallback"},
                    }
                ),
            ) as fetch_events, patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ) as llm_extract:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "I want a beach trip in Kenya in August 2026"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("safe travel searches", response.data["result"])
        fetch_hotels.assert_awaited_once()
        self.assertEqual(fetch_hotels.await_args.args[0]["location"], "Kenya")
        fetch_events.assert_awaited_once()
        llm_extract.assert_awaited_once()

    # ------------------------------------------------------------------
    # Events / things-to-do (acceptance criteria)
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_things_to_do_prompt_searches_events(self):
        """'What can I do in Nairobi on August 10, 2026?' -> events search."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_events_connector.TravelEventsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [{"name": "Nairobi Tour"}],
                        "metadata": {"provider": "fallback"},
                    }
                ),
            ) as fetch_events, patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ) as llm_extract:
                response = self.client.post(
                    self.url,
                    {"user_prompt": "What can I do in Nairobi on August 10, 2026?"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        fetch_events.assert_awaited_once()
        self.assertEqual(fetch_events.await_args.args[0]["location"], "Nairobi")
        self.assertEqual(fetch_events.await_args.args[0]["start_date"], "2026-08-10")
        llm_extract.assert_awaited_once()

    # ------------------------------------------------------------------
    # Provider errors -> success
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_provider_no_results_is_successful_agent_response(self):
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "orchestration.connectors.travel_hotels_connector.TravelHotelsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [],
                        "metadata": {"error": "No hotel offers returned from Amadeus."},
                    }
                ),
            ):
                response = self.client.post(
                    self.url,
                    {
                        "user_prompt": "Find hotels in Nairobi",
                        "context": {
                            "action": "search_hotels",
                            "parameters": {
                                "location": "Nairobi",
                                "check_in_date": "2026-08-10",
                                "check_out_date": "2026-08-12",
                                "guests": 1,
                            },
                        },
                    },
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("No hotel offers returned", response.data["result"])

    # ------------------------------------------------------------------
    # Missing-slot clarification (never generic)
    # ------------------------------------------------------------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_missing_origin_for_flight_returns_contextual_question(self):
        """Missing origin should return a helpful question, not generic text."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(
                    return_value={
                        "action": "search_flights",
                        "confidence": 0.9,
                        "parameters": {"destination": "Kisumu"},
                        "missing_slots": ["origin", "departure_date"],
                        "clarifying_question": "",
                        "raw_query": "flight to Kisumu",
                    }
                ),
            ):
                response = self.client.post(
                    self.url,
                    {"user_prompt": "flight to Kisumu"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        result = str(response.data["result"])
        self.assertIn("Kisumu", result)
        self.assertNotIn("Please include the search type", result)

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_missing_dates_for_hotel_returns_contextual_question(self):
        """Missing dates should ask specifically for check-in/check-out."""
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(
                    return_value={
                        "action": "search_hotels",
                        "confidence": 0.9,
                        "parameters": {"location": "Mombasa"},
                        "missing_slots": ["check_in_date", "check_out_date"],
                        "clarifying_question": "",
                        "raw_query": "hotels in Mombasa",
                    }
                ),
            ):
                response = self.client.post(
                    self.url,
                    {"user_prompt": "hotels in Mombasa"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        result = str(response.data["result"])
        self.assertIn("check-in", result.lower())


# ------------------------------------------------------------------
# Ticketmaster connector unit tests
# ------------------------------------------------------------------

from unittest import IsolatedAsyncioTestCase


class TicketmasterConnectorTests(IsolatedAsyncioTestCase):
    """Unit tests for the Ticketmaster Discovery API connector."""

    def setUp(self):
        from orchestration.connectors.travel_events_connector import TravelEventsConnector
        self.connector = TravelEventsConnector()

    # -- Event parsing -------------------------------------------------------

    def test_parses_ticketmaster_event_with_full_data(self):
        event = {
            "id": "abc123",
            "name": "Kenya Jazz Festival",
            "url": "https://ticketmaster.com/e/abc123",
            "dates": {
                "start": {
                    "dateTime": "2026-08-10T18:00:00Z",
                    "localDate": "2026-08-10",
                    "localTime": "21:00:00",
                }
            },
            "_embedded": {
                "venues": [
                    {
                        "name": "Safari Park Hotel",
                        "city": {"name": "Nairobi"},
                        "country": {"countryCode": "KE"},
                    }
                ]
            },
            "classifications": [
                {"segment": {"name": "Music"}}
            ],
            "priceRanges": [
                {"min": 3500, "max": 5000, "currency": "KES"}
            ],
            "images": [
                {"url": "https://example.com/img.jpg"}
            ],
        }
        result = self.connector._parse_ticketmaster_event(event, 0)

        self.assertEqual(result["id"], "event_abc123")
        self.assertEqual(result["provider"], "Ticketmaster")
        self.assertEqual(result["title"], "Kenya Jazz Festival")
        self.assertEqual(result["category"], "music")
        self.assertEqual(result["start_datetime"], "2026-08-10T18:00:00Z")
        self.assertEqual(result["location"], "Safari Park Hotel, Nairobi")
        self.assertEqual(result["venue"], "Safari Park Hotel")
        self.assertEqual(result["price_ksh"], 3500)
        self.assertEqual(result["ticket_url"], "https://ticketmaster.com/e/abc123")
        self.assertEqual(result["image_url"], "https://example.com/img.jpg")
        self.assertEqual(result["rating"], 4.5)
        self.assertEqual(result["attendees"], 0)

    def test_parses_event_with_local_date_only(self):
        event = {
            "id": "def456",
            "name": "Local Event",
            "url": "",
            "dates": {
                "start": {
                    "localDate": "2026-09-15",
                    "localTime": "20:00:00",
                }
            },
            "_embedded": {
                "venues": [{"name": "TBA"}]
            },
            "classifications": [],
            "priceRanges": [],
            "images": [],
        }
        result = self.connector._parse_ticketmaster_event(event, 0)

        self.assertEqual(result["title"], "Local Event")
        self.assertEqual(result["start_datetime"], "2026-09-15T20:00:00Z")
        self.assertEqual(result["price_ksh"], 0)

    def test_parses_event_with_non_kes_currency_sets_price_zero(self):
        event = {
            "id": "ghi789",
            "name": "USD Event",
            "url": "",
            "dates": {"start": {"dateTime": "2026-10-01T19:00:00Z"}},
            "_embedded": {"venues": []},
            "classifications": [],
            "priceRanges": [{"min": 50, "max": 100, "currency": "USD"}],
            "images": [],
        }
        result = self.connector._parse_ticketmaster_event(event, 0)

        self.assertEqual(result["price_ksh"], 0)

    def test_parses_event_with_no_venue_gracefully(self):
        event = {
            "id": "jkl012",
            "name": "No Venue Event",
            "url": "",
            "dates": {"start": {"dateTime": "2026-10-10T12:00:00Z"}},
            "classifications": [],
            "images": [],
        }
        result = self.connector._parse_ticketmaster_event(event, 0)

        self.assertEqual(result["title"], "No Venue Event")
        self.assertEqual(result["venue"], "TBA")
        self.assertIn("TBA", result["location"])

    # -- API error handling ------------------------------------------------

    @patch.dict(os.environ, {}, clear=True)
    async def test_missing_api_key_returns_clean_error(self):
        from orchestration.connectors.travel_events_connector import TravelEventsConnector
        conn = TravelEventsConnector()

        results, error = await conn._search_ticketmaster(
            "Nairobi", None, None, "all"
        )

        self.assertEqual(results, [])
        self.assertEqual(error, "TICKETMASTER_API_KEY not set")

    @patch.dict(os.environ, {"TICKETMASTER_API_KEY": "test-key"})
    async def test_provider_401_returns_clean_auth_error(self):
        from unittest.mock import AsyncMock, MagicMock, patch as async_patch
        from orchestration.connectors.travel_events_connector import TravelEventsConnector

        conn = TravelEventsConnector()

        mock_response = MagicMock()
        mock_response.status = 401

        mock_session = MagicMock()
        mock_session.get = MagicMock()
        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        mock_response.text = AsyncMock(return_value='{"error":"Unauthorized"}')

        with async_patch("aiohttp.ClientSession", return_value=mock_session):
            results, error = await conn._search_ticketmaster(
                "Nairobi", None, None, "all"
            )

        self.assertEqual(results, [])
        self.assertIn("401", error)
        self.assertIn("TICKETMASTER_API_KEY", error)

    @patch.dict(os.environ, {"TICKETMASTER_API_KEY": "test-key"})
    async def test_provider_404_returns_clean_error(self):
        from unittest.mock import AsyncMock, MagicMock, patch as async_patch
        from orchestration.connectors.travel_events_connector import TravelEventsConnector

        conn = TravelEventsConnector()

        mock_response = MagicMock()
        mock_response.status = 404

        mock_session = MagicMock()
        mock_session.get = MagicMock()
        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        mock_response.text = AsyncMock(return_value="Not Found")

        with async_patch("aiohttp.ClientSession", return_value=mock_session):
            results, error = await conn._search_ticketmaster(
                "Nairobi", None, None, "all"
            )

        self.assertEqual(results, [])
        self.assertIn("404", error)

    @patch.dict(os.environ, {"TICKETMASTER_API_KEY": "test-key"})
    async def test_provider_429_returns_rate_limit_error(self):
        from unittest.mock import AsyncMock, MagicMock, patch as async_patch
        from orchestration.connectors.travel_events_connector import TravelEventsConnector

        conn = TravelEventsConnector()

        mock_response = MagicMock()
        mock_response.status = 429

        mock_session = MagicMock()
        mock_session.get = MagicMock()
        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        mock_response.text = AsyncMock(return_value='{"error":"Rate limit exceeded"}')

        with async_patch("aiohttp.ClientSession", return_value=mock_session):
            results, error = await conn._search_ticketmaster(
                "Nairobi", None, None, "all"
            )

        self.assertEqual(results, [])
        self.assertIn("rate limit", error.lower())

    @patch.dict(os.environ, {"TICKETMASTER_API_KEY": "test-key"})
    async def test_no_embedded_events_returns_clean_empty(self):
        from unittest.mock import AsyncMock, MagicMock, patch as async_patch
        from orchestration.connectors.travel_events_connector import TravelEventsConnector

        conn = TravelEventsConnector()

        mock_response = MagicMock()
        mock_response.status = 200

        mock_session = MagicMock()
        mock_session.get = MagicMock()
        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        # Ticketmaster returns _links but no _embedded when no results
        mock_response.text = AsyncMock(
            return_value='{"_links":{"self":{"href":"..."}},"page":{"size":20,"totalElements":0}}'
        )

        with async_patch("aiohttp.ClientSession", return_value=mock_session):
            results, error = await conn._search_ticketmaster(
                "Nairobi", None, None, "all"
            )

        self.assertEqual(results, [])
        self.assertIsNone(error)

    # -- Location mapping ----------------------------------------------------

    def test_city_to_country_code_nairobi(self):
        from orchestration.connectors.travel_events_connector import _city_to_country_code
        self.assertEqual(_city_to_country_code("Nairobi"), "KE")
        self.assertEqual(_city_to_country_code("nAIROBI"), "KE")

    def test_city_to_country_code_unknown(self):
        from orchestration.connectors.travel_events_connector import _city_to_country_code
        self.assertIsNone(_city_to_country_code("UnknownCity"))

    # -- Fallback events -----------------------------------------------------

    def test_fallback_events_returns_data_for_known_city(self):
        results = self.connector._get_fallback_events("Nairobi", "all")

        self.assertIsInstance(results, list)
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["provider"], "Ticketmaster")
        for r in results:
            self.assertIn("title", r)
            self.assertIn("category", r)
            self.assertIn("start_datetime", r)
            self.assertIn("price_ksh", r)

    def test_fallback_events_filters_by_category(self):
        results = self.connector._get_fallback_events("Nairobi", "music")

        self.assertGreater(len(results), 0)
        for r in results:
            self.assertEqual(r["category"], "music")

    def test_fallback_events_unknown_city_returns_nairobi_defaults(self):
        results = self.connector._get_fallback_events("Zanzibar", "all")

        self.assertGreater(len(results), 0)

    # -- _fetch integration (no API key) ------------------------------------

    async def test_fetch_without_api_key_returns_fallback(self):
        with override_settings(TRAVEL_ALLOW_FALLBACK=True):
            result = await self.connector._fetch(
                {"location": "Nairobi"},
                {},
            )

        self.assertIn("results", result)
        self.assertIn("metadata", result)
        self.assertGreater(len(result["results"]), 0)
        self.assertEqual(result["metadata"]["provider"], "ticketmaster")

    async def test_fetch_without_location_returns_error(self):
        result = await self.connector._fetch(
            {"location": ""},
            {},
        )

        self.assertEqual(result["results"], [])
        self.assertIn("location", str(result["metadata"].get("error", "")))

    # -- NeuroA2A integration: events prompt uses Ticketmaster ---------------

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    async def test_neuro_events_prompt_uses_ticketmaster_not_eventbrite(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient

        User = get_user_model()
        client = APIClient()
        user = await sync_to_async(User.objects.create_user)(
            username="neuro_tm_test",
            email="neuro_tm@example.com",
            password="pass123",
        )

        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(user.id)):
            with patch(
                "orchestration.connectors.travel_events_connector.TravelEventsConnector._fetch",
                new=AsyncMock(
                    return_value={
                        "results": [
                            {
                                "id": "event_abc",
                                "provider": "Ticketmaster",
                                "title": "Nairobi Tour",
                                "category": "music",
                                "start_datetime": "2026-08-10T18:00:00Z",
                                "end_datetime": "",
                                "location": "Nairobi",
                                "venue": "KICC",
                                "price_ksh": 1000,
                                "ticket_url": "https://ticketmaster.com/e/abc",
                                "image_url": "",
                                "rating": 4.5,
                                "attendees": 0,
                            }
                        ],
                        "metadata": {"provider": "ticketmaster"},
                    }
                ),
            ) as fetch_events, patch(
                "travel.neuroa2a._llm_extract_travel_intent",
                new=AsyncMock(return_value=None),
            ):
                response = await sync_to_async(client.post)(
                    "/api/neuroa2a/travel/run/",
                    {"user_prompt": "What can I do in Nairobi on August 10, 2026?"},
                    HTTP_AUTHORIZATION="Bearer secret",
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        result = str(response.data["result"])
        self.assertIn("Found 1 events option", result)
        fetch_events.assert_awaited_once()
