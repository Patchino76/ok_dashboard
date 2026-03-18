"""
tools/output_dir.py — Shared mutable output directory state
=============================================================
All tools read get_output_dir() to know where to write files.
The API sets the per-analysis subfolder via set_output_dir tool.
"""

import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_OUTPUT_DIR = os.path.join(BASE_DIR, "output")

# Module-level mutable state — set once per analysis session
_current_output_dir: str = _DEFAULT_OUTPUT_DIR


def get_output_dir() -> str:
    """Return the current output directory (per-analysis subfolder or default)."""
    os.makedirs(_current_output_dir, exist_ok=True)
    return _current_output_dir


def set_output_dir(subdir: str) -> str:
    """Set output to a subfolder of the base output dir. Returns the full path."""
    global _current_output_dir
    _current_output_dir = os.path.join(_DEFAULT_OUTPUT_DIR, subdir)
    os.makedirs(_current_output_dir, exist_ok=True)
    return _current_output_dir


def reset_output_dir() -> None:
    """Reset to the default output directory."""
    global _current_output_dir
    _current_output_dir = _DEFAULT_OUTPUT_DIR
