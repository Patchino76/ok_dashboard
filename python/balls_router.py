from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import os
import csv

router = APIRouter(prefix="/api", tags=["Balls Data"])


class BallsDataRow(BaseModel):
    MeasureDate: str
    BallsName: str
    MillName: int
    Gross: float
    Operator: str
    IsDosmilane: bool
    Shift: int


def _normalize_ball_type(value: str) -> str:
    return " ".join((value or "").strip().split()).lower()


def _load_balls_items_map() -> Dict[str, Tuple[str, bool]]:
    items_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_data", "balls_items.csv")
    if not os.path.exists(items_path):
        return {}

    mapping: Dict[str, Tuple[str, bool]] = {}
    with open(items_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            item_id_raw = (row.get("Id") or "").strip()
            if not item_id_raw:
                continue

            bg_name = (row.get("BG_Names") or "").strip()
            dosmilane_raw = (row.get("Dosmilane") or "0").strip()
            try:
                is_dosmilane = int(float(dosmilane_raw or 0)) == 1
            except ValueError:
                is_dosmilane = False

            mapping[_normalize_ball_type(item_id_raw)] = (bg_name or item_id_raw, is_dosmilane)

    return mapping


def _parse_balls_date(date_str: str) -> datetime.date:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    raise ValueError("Invalid date format")


def _parse_balls_datetime(value: str) -> datetime:
    raw = (value or "").strip()
    for fmt in (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y",
        "%Y-%m-%d",
    ):
        try:
            parsed = datetime.strptime(raw, fmt)
            if fmt in ("%m/%d/%Y", "%Y-%m-%d"):
                return parsed.replace(hour=0, minute=0, second=0, microsecond=0)
            return parsed
        except ValueError:
            continue
    raise ValueError("Invalid datetime format")


def _shift_from_datetime(dt: datetime) -> int:
    hour = dt.hour
    if 6 <= hour < 14:
        return 1
    if 14 <= hour < 22:
        return 2
    return 3


@router.get("/balls_data", response_model=List[BallsDataRow])
async def get_balls_data(
    date: Optional[str] = Query(None, description="Date filter. Supported: YYYY-MM-DD or M/D/YYYY"),
    start_date: Optional[str] = Query(None, description="Start date for range filter. Supported: YYYY-MM-DD or M/D/YYYY"),
    end_date: Optional[str] = Query(None, description="End date for range filter. Supported: YYYY-MM-DD or M/D/YYYY"),
):
    if not date and not start_date:
        raise HTTPException(
            status_code=400,
            detail="Missing required query parameter. Provide either 'date' or 'start_date' (optionally with 'end_date').",
        )

    requested_date = None
    requested_start = None
    requested_end = None

    if date:
        try:
            requested_date = _parse_balls_date(date)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {date}. Use YYYY-MM-DD or M/D/YYYY.")
    else:
        try:
            requested_start = _parse_balls_date(start_date or "")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid start_date format: {start_date}. Use YYYY-MM-DD or M/D/YYYY.",
            )

        if end_date:
            try:
                requested_end = _parse_balls_date(end_date)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid end_date format: {end_date}. Use YYYY-MM-DD or M/D/YYYY.",
                )
        else:
            requested_end = requested_start

    items_map = _load_balls_items_map()

    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_data", "balls_measures.csv")
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=500, detail=f"Mock data file not found: {csv_path}")

    results: List[BallsDataRow] = []

    try:
        with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                measure_date_raw = (row.get("MeasureDate") or "").strip()
                if not measure_date_raw:
                    continue

                try:
                    row_dt = _parse_balls_datetime(measure_date_raw)
                except ValueError:
                    continue

                row_date = row_dt.date()

                if requested_date is not None:
                    if row_date != requested_date:
                        continue
                else:
                    if requested_start is None or requested_end is None:
                        continue
                    if row_date < requested_start or row_date > requested_end:
                        continue

                balls_name_raw = (row.get("BallsName") or "").strip()
                normalized_balls_name = _normalize_ball_type(balls_name_raw)
                mapped: Optional[Tuple[str, bool]] = items_map.get(normalized_balls_name)
                balls_name_bg = mapped[0] if mapped else balls_name_raw
                is_dosmilane = mapped[1] if mapped else False

                results.append(
                    BallsDataRow(
                        MeasureDate=row_dt.isoformat(),
                        BallsName=balls_name_bg,
                        MillName=int(float((row.get("MillName") or "0").strip() or 0)),
                        Gross=float((row.get("Gross") or "0").strip() or 0),
                        Operator=(row.get("Operator") or "").strip(),
                        IsDosmilane=is_dosmilane,
                        Shift=_shift_from_datetime(row_dt),
                    )
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read balls measures CSV: {str(e)}")

    return results
