"""
Math utility tool functions for the Calc Agent.
All functions return strings for uniform A2A/MCP output.
"""

from __future__ import annotations

import ast
import json
import math
import operator
import random
from statistics import mean, median, mode, stdev
from typing import Union


# ---------------------------------------------------------------------------
# 1. Safe math expression evaluator
# ---------------------------------------------------------------------------

# Allowed binary operators
_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.FloorDiv: operator.floordiv,
}

# Allowed unary operators
_UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}

# Allowed function calls (name -> callable)
_FUNCTIONS = {
    "sqrt": math.sqrt,
    "abs": abs,
    "ceil": math.ceil,
    "floor": math.floor,
    "round": round,
    "log": math.log,
    "log10": math.log10,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "pi": lambda: math.pi,
    "e": lambda: math.e,
}


def _safe_eval(node: ast.AST) -> Union[int, float]:
    """Recursively evaluate an AST node, allowing only safe operations."""
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body)

    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value

    if isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in _BIN_OPS:
            raise ValueError(f"Unsupported operator: {op_type.__name__}")
        left = _safe_eval(node.left)
        right = _safe_eval(node.right)
        if op_type is ast.Div and right == 0:
            raise ValueError("Division by zero")
        if op_type is ast.Pow and abs(right) > 1000:
            raise ValueError("Exponent too large (max 1000)")
        return _BIN_OPS[op_type](left, right)

    if isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in _UNARY_OPS:
            raise ValueError(f"Unsupported unary operator: {op_type.__name__}")
        return _UNARY_OPS[op_type](_safe_eval(node.operand))

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name):
            raise ValueError("Only simple function calls allowed")
        func_name = node.func.id.lower()
        if func_name not in _FUNCTIONS:
            raise ValueError(f"Unknown function: {func_name}")
        args = [_safe_eval(arg) for arg in node.args]
        return _FUNCTIONS[func_name](*args)

    # Allow bare Name nodes for constants like pi, e
    if isinstance(node, ast.Name):
        name = node.id.lower()
        if name in _FUNCTIONS:
            fn = _FUNCTIONS[name]
            # Check if it's a zero-arg constant function
            try:
                return fn()
            except TypeError:
                raise ValueError(f"'{name}' requires arguments")
        raise ValueError(f"Unknown name: {node.id}")

    raise ValueError(f"Unsupported expression node: {type(node).__name__}")


def calculate(expression: str) -> str:
    """
    Safely evaluate a mathematical expression.
    Supports: +, -, *, /, **, %, //, sqrt(), abs(), ceil(), floor(),
              round(), log(), log10(), sin(), cos(), tan(), pi, e.
    Does NOT use eval().
    """
    expression = expression.strip()
    if not expression:
        return json.dumps({"error": "Empty expression"})

    try:
        tree = ast.parse(expression, mode="eval")
        result = _safe_eval(tree)
        # Format nicely: integers stay as int, floats keep precision
        if isinstance(result, float) and result == int(result) and not math.isinf(result):
            result = int(result)
        return json.dumps({"expression": expression, "result": result})
    except (ValueError, TypeError, SyntaxError, ZeroDivisionError) as exc:
        return json.dumps({"expression": expression, "error": str(exc)})


# ---------------------------------------------------------------------------
# 2. Unit converter
# ---------------------------------------------------------------------------

_TEMP_CONVERSIONS = {
    ("celsius", "fahrenheit"): lambda c: c * 9 / 5 + 32,
    ("fahrenheit", "celsius"): lambda f: (f - 32) * 5 / 9,
    ("celsius", "kelvin"): lambda c: c + 273.15,
    ("kelvin", "celsius"): lambda k: k - 273.15,
    ("fahrenheit", "kelvin"): lambda f: (f - 32) * 5 / 9 + 273.15,
    ("kelvin", "fahrenheit"): lambda k: (k - 273.15) * 9 / 5 + 32,
}

# Length: base unit = meters
_LENGTH_TO_METERS = {
    "meters": 1.0,
    "m": 1.0,
    "kilometers": 1000.0,
    "km": 1000.0,
    "miles": 1609.344,
    "mi": 1609.344,
    "feet": 0.3048,
    "ft": 0.3048,
    "inches": 0.0254,
    "in": 0.0254,
    "centimeters": 0.01,
    "cm": 0.01,
    "yards": 0.9144,
    "yd": 0.9144,
}

# Weight: base unit = grams
_WEIGHT_TO_GRAMS = {
    "grams": 1.0,
    "g": 1.0,
    "kilograms": 1000.0,
    "kg": 1000.0,
    "pounds": 453.592,
    "lbs": 453.592,
    "lb": 453.592,
    "ounces": 28.3495,
    "oz": 28.3495,
    "milligrams": 0.001,
    "mg": 0.001,
}

_TEMP_UNITS = {"celsius", "fahrenheit", "kelvin", "c", "f", "k"}
_TEMP_NORMALIZE = {"c": "celsius", "f": "fahrenheit", "k": "kelvin"}


def unit_convert(value: float, from_unit: str, to_unit: str) -> str:
    """
    Convert between units.
    Supports: celsius/fahrenheit/kelvin, km/miles/meters/feet/inches,
              kg/lbs/oz/grams and their abbreviations.
    """
    from_u = from_unit.strip().lower()
    to_u = to_unit.strip().lower()

    # Normalize temperature abbreviations
    from_u = _TEMP_NORMALIZE.get(from_u, from_u)
    to_u = _TEMP_NORMALIZE.get(to_u, to_u)

    if from_u == to_u:
        return json.dumps({"value": value, "from": from_unit, "to": to_unit, "result": value})

    # Temperature
    if from_u in _TEMP_UNITS and to_u in _TEMP_UNITS:
        key = (from_u, to_u)
        if key not in _TEMP_CONVERSIONS:
            return json.dumps({"error": f"Cannot convert {from_unit} to {to_unit}"})
        result = _TEMP_CONVERSIONS[key](value)
        return json.dumps({"value": value, "from": from_unit, "to": to_unit, "result": round(result, 4)})

    # Length
    if from_u in _LENGTH_TO_METERS and to_u in _LENGTH_TO_METERS:
        meters = value * _LENGTH_TO_METERS[from_u]
        result = meters / _LENGTH_TO_METERS[to_u]
        return json.dumps({"value": value, "from": from_unit, "to": to_unit, "result": round(result, 6)})

    # Weight
    if from_u in _WEIGHT_TO_GRAMS and to_u in _WEIGHT_TO_GRAMS:
        grams = value * _WEIGHT_TO_GRAMS[from_u]
        result = grams / _WEIGHT_TO_GRAMS[to_u]
        return json.dumps({"value": value, "from": from_unit, "to": to_unit, "result": round(result, 6)})

    return json.dumps({"error": f"Cannot convert between '{from_unit}' and '{to_unit}'. Supported: temperature (celsius/fahrenheit/kelvin), length (km/miles/meters/feet/inches), weight (kg/lbs/oz/grams)"})


# ---------------------------------------------------------------------------
# 3. Random number generator
# ---------------------------------------------------------------------------

def random_number(type: str = "int", min_val: float = 0, max_val: float = 100) -> str:
    """
    Generate a random number.
    type="int" -> random integer in [min_val, max_val]
    type="float" -> random float in [min_val, max_val]
    type="choice" -> pick from comma-separated list passed as min_val (as string)
    """
    rng_type = type.strip().lower()

    if rng_type == "int":
        result = random.randint(int(min_val), int(max_val))
        return json.dumps({"type": "int", "min": int(min_val), "max": int(max_val), "result": result})

    if rng_type == "float":
        result = random.uniform(float(min_val), float(max_val))
        return json.dumps({"type": "float", "min": float(min_val), "max": float(max_val), "result": round(result, 6)})

    if rng_type == "choice":
        # min_val is expected to be a comma-separated string of choices
        choices = str(min_val).split(",")
        choices = [c.strip() for c in choices if c.strip()]
        if not choices:
            return json.dumps({"error": "No choices provided"})
        result = random.choice(choices)
        return json.dumps({"type": "choice", "choices": choices, "result": result})

    return json.dumps({"error": f"Unknown type '{type}'. Use 'int', 'float', or 'choice'"})


# ---------------------------------------------------------------------------
# 4. Statistics calculator
# ---------------------------------------------------------------------------

def statistics_calc(numbers: list[float]) -> str:
    """
    Compute descriptive statistics for a list of numbers.
    Returns JSON with: mean, median, mode, min, max, stddev, count, sum.
    """
    if not numbers:
        return json.dumps({"error": "Empty list"})

    nums = [float(n) for n in numbers]
    count = len(nums)

    result = {
        "count": count,
        "sum": round(sum(nums), 6),
        "mean": round(mean(nums), 6),
        "median": round(median(nums), 6),
        "min": min(nums),
        "max": max(nums),
    }

    # Mode can fail if no unique mode
    try:
        result["mode"] = mode(nums)
    except Exception:
        result["mode"] = None

    # Stddev requires at least 2 values
    if count >= 2:
        result["stddev"] = round(stdev(nums), 6)
    else:
        result["stddev"] = 0.0

    return json.dumps(result)
