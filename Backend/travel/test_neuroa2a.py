from unittest.mock import AsyncMock, patch

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

    @override_settings(NEUROA2A_SHARED_TOKEN="secret", NEUROA2A_TRAVEL_USER_ID=1)
    def test_rejects_missing_bearer_token(self):
        response = self.client.post(
            self.url,
            {"user_prompt": "Find hotels in Nairobi"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["status"], "error")

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_routes_structured_travel_search(self):
        with override_settings(NEUROA2A_TRAVEL_USER_ID=str(self.user.id)):
            with patch(
                "travel.neuroa2a.route_intent",
                new=AsyncMock(
                    return_value={
                        "status": "success",
                        "data": {
                            "results": [{"name": "Nairobi Hotel", "price_ksh": 12000}],
                            "metadata": {"provider": "fallback"},
                        },
                    }
                ),
            ) as route_intent:
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
        route_intent.assert_awaited_once()

    @override_settings(NEUROA2A_SHARED_TOKEN="secret")
    def test_rejects_stateful_travel_action(self):
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

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "error")
        self.assertIn("supports travel searches only", response.data["result"])
