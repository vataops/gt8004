"""
Flask A2A routes for the Calc Agent.
Provides /.well-known/agent.json, /a2a/tasks/send, and /health.
"""

import json

from flask import Flask, request, jsonify

from app.config import settings
from app.tools.math_tools import calculate, unit_convert, random_number, statistics_calc


def _parse_unit_convert(text: str) -> str:
    """Parse natural-language or structured unit conversion request."""
    # Try JSON first
    try:
        data = json.loads(text)
        return unit_convert(
            float(data.get("value", 0)),
            str(data.get("from_unit", data.get("from", ""))),
            str(data.get("to_unit", data.get("to", ""))),
        )
    except (json.JSONDecodeError, TypeError, ValueError):
        pass

    # Simple parse: "100 km to miles" or "100 celsius to fahrenheit"
    parts = text.strip().split()
    if len(parts) >= 4 and parts[-2].lower() in ("to", "in", "->"):
        try:
            value = float(parts[0])
            from_unit = parts[1]
            to_unit = parts[-1]
            return unit_convert(value, from_unit, to_unit)
        except (ValueError, IndexError):
            pass

    return json.dumps({"error": f"Could not parse unit conversion from: {text}"})


def _parse_statistics(text: str) -> str:
    """Parse a list of numbers from text or JSON."""
    # Try JSON first
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return statistics_calc([float(n) for n in data])
        if isinstance(data, dict) and "numbers" in data:
            return statistics_calc([float(n) for n in data["numbers"]])
    except (json.JSONDecodeError, TypeError, ValueError):
        pass

    # Parse comma/space-separated numbers
    import re
    nums = re.findall(r"-?\d+\.?\d*", text)
    if nums:
        return statistics_calc([float(n) for n in nums])

    return json.dumps({"error": f"Could not parse numbers from: {text}"})


def _parse_random(text: str) -> str:
    """Parse random number request from text or JSON."""
    # Try JSON first
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return random_number(
                type=data.get("type", "int"),
                min_val=data.get("min_val", data.get("min", 0)),
                max_val=data.get("max_val", data.get("max", 100)),
            )
    except (json.JSONDecodeError, TypeError, ValueError):
        pass

    # Default random int
    return random_number()


def create_flask_app() -> Flask:
    """Create and configure the Flask app with A2A routes."""
    app = Flask(__name__)

    @app.route("/.well-known/agent.json")
    def agent_card():
        return jsonify({
            "name": settings.agent_name,
            "description": settings.agent_description,
            "url": settings.agent_url,
            "version": settings.agent_version,
            "defaultInputModes": ["text"],
            "defaultOutputModes": ["text"],
            "capabilities": {
                "streaming": False,
                "pushNotifications": False,
                "stateTransitionHistory": False,
            },
            "skills": [
                {
                    "id": "calculate",
                    "name": "calculate",
                    "description": "Evaluate math expressions safely (supports +, -, *, /, **, %, sqrt, abs, trig, log)",
                    "tags": ["math", "calculator"],
                },
                {
                    "id": "unit-convert",
                    "name": "unit-convert",
                    "description": "Convert between units (temperature, length, weight)",
                    "tags": ["conversion", "units"],
                },
                {
                    "id": "random",
                    "name": "random",
                    "description": "Generate random numbers (int, float, or choice from list)",
                    "tags": ["random", "rng"],
                },
                {
                    "id": "statistics",
                    "name": "statistics",
                    "description": "Compute statistics (mean, median, mode, stddev, min, max, sum, count)",
                    "tags": ["statistics", "math"],
                },
            ],
        })

    @app.route("/a2a/tasks/send", methods=["POST"])
    def send_task():
        body = request.get_json()
        if not body:
            return jsonify({"error": "Request body is required"}), 400

        skill_id = body.get("skill_id", "calculate")

        # Extract text from message parts
        text = ""
        if "message" in body and "parts" in body["message"]:
            parts = body["message"]["parts"]
            if parts:
                text = parts[0].get("text", "")

        # Dispatch to the appropriate tool
        handlers = {
            "calculate": lambda t: calculate(t),
            "unit-convert": lambda t: _parse_unit_convert(t),
            "random": lambda t: _parse_random(t),
            "statistics": lambda t: _parse_statistics(t),
        }
        handler = handlers.get(skill_id, handlers["calculate"])

        try:
            result = handler(text)
        except Exception as exc:
            result = json.dumps({"error": str(exc)})

        task_id = body.get("id", "task-001")
        return jsonify({
            "id": task_id,
            "status": {"state": "completed"},
            "artifacts": [
                {
                    "type": "application/json",
                    "parts": [{"type": "text", "text": result}],
                }
            ],
        })

    @app.route("/health")
    def health():
        return jsonify({
            "status": "healthy",
            "agent": settings.agent_name,
            "protocols": ["a2a", "mcp"],
        })

    return app
